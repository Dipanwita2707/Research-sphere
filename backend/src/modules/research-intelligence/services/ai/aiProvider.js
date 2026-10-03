/**
 * AI Provider — Research Intelligence
 *
 * Gemini (primary) with Groq (fallback), called over REST with native fetch.
 *
 *   complete()      one-shot text/JSON generation with a per-tenant DB cache (taxonomy, keywords)
 *   completeJson()  complete() in provider JSON mode, parsed
 *   chatTurn()      one streamed model turn with function calling, used by the chat agent loop
 *
 * Messages passed to chatTurn use a provider-neutral shape:
 *   { role: 'user', content }
 *   { role: 'assistant', content, toolCalls: [{ id, name, args }], _geminiParts? }
 *   { role: 'tool', toolCallId, name, content }   // content: JSON string
 *
 * Env: GEMINI_API_KEY, GROQ_API_KEY, RIP_GEMINI_MODEL, RIP_GROQ_MODEL, RIP_GROQ_REASONING_EFFORT,
 *      RIP_GEMINI_THINKING_BUDGET (optional), RIP_AI_TIMEOUT_MS,
 *      RIP_GROQ_TPM (tokens/minute budget, default 8000; 0 = no client throttle),
 *      RIP_AI_MAX_RETRIES (default 4), RIP_AI_MAX_RETRY_WAIT_MS (total backoff per call, default 60000)
 */

'use strict';

const crypto = require('crypto');
const prisma = require('../../../../shared/config/database');
const tenantContext = require('../../../../shared/tenancy/tenantContext');
const { createModuleLogger } = require('../../../../shared/utils/logger');

const log = createModuleLogger('rip:ai');

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GROQ_BASE = 'https://api.groq.com/openai/v1';

const geminiModel = () => process.env.RIP_GEMINI_MODEL || 'gemini-2.5-flash';
const groqModel = () => process.env.RIP_GROQ_MODEL || 'openai/gpt-oss-120b';
const timeoutMs = () => Number(process.env.RIP_AI_TIMEOUT_MS) || 90000;

class AiUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AiUnavailableError';
    this.statusCode = 503;
    this.isOperational = true;
  }
}

/** Providers with an API key configured, in preference order. */
const availableProviders = () => {
  const list = [];
  if (process.env.GEMINI_API_KEY) list.push('gemini');
  if (process.env.GROQ_API_KEY) list.push('groq');
  return list;
};

const isConfigured = () => availableProviders().length > 0;

const withTimeout = (signal) => {
  const t = AbortSignal.timeout(timeoutMs());
  return signal ? AbortSignal.any([signal, t]) : t;
};

const retryable = (status) => status === 429 || status >= 500;

/** Sleep that ends early (rejecting) when `signal` aborts. */
const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason || new Error('Aborted'));
    const t = setTimeout(() => {
      signal?.removeEventListener?.('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(signal.reason || new Error('Aborted'));
    };
    signal?.addEventListener?.('abort', onAbort, { once: true });
  });

// Retry policy (env-tunable): attempts after the first, longest single wait, total wait budget per call.
const maxRetries = () => Math.max(0, Number(process.env.RIP_AI_MAX_RETRIES ?? 4));
const MAX_SINGLE_WAIT_MS = 30000;
const maxTotalWaitMs = () => Math.max(0, Number(process.env.RIP_AI_MAX_RETRY_WAIT_MS ?? 60000));

/** Parse a duration such as "6.66s", "850ms", "1m30.5s", "2m", or a bare number of seconds. */
function parseDurationMs(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s) * 1000;
  const m = /^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m(?!s))?(?:(\d+(?:\.\d+)?)s)?(?:(\d+(?:\.\d+)?)ms)?$/i.exec(s);
  if (!m || !m.slice(1).some(Boolean)) return null;
  return (Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0)) * 1000 + Number(m[4] || 0);
}

/**
 * How long to wait before retry number `attempt` (0-based). In order of preference:
 *   1. Retry-After header (seconds or HTTP date)
 *   2. x-ratelimit-reset-tokens / x-ratelimit-reset-requests (Groq/OpenAI, e.g. "6.66s"), the longer of the two that applies
 *   3. the wait stated in the error message ("Please try again in 6.48s")
 *   4. exponential backoff 1 s, 2 s, 4 s, … with jitter
 * Always capped at MAX_SINGLE_WAIT_MS. A small margin is added to server-provided waits.
 */
const retryDelayMs = (res, text, attempt) => {
  const get = (h) => (typeof res?.headers?.get === 'function' ? res.headers.get(h) : null);
  const cap = (ms) => Math.min(Math.max(0, Math.ceil(ms)), MAX_SINGLE_WAIT_MS);

  const ra = get('retry-after');
  if (ra !== null && ra !== undefined && String(ra).trim() !== '') {
    const secs = Number(ra);
    if (Number.isFinite(secs) && secs >= 0) return cap(secs * 1000 + 250);
    const date = Date.parse(ra);
    if (Number.isFinite(date)) return cap(date - Date.now() + 250);
  }
  const resets = [get('x-ratelimit-reset-tokens'), get('x-ratelimit-reset-requests')].map(parseDurationMs).filter((v) => v !== null);
  if (resets.length) {
    // Only the limit that is exhausted matters; when we cannot tell, the larger one is safe.
    const remainingTokens = Number(get('x-ratelimit-remaining-tokens'));
    const remainingRequests = Number(get('x-ratelimit-remaining-requests'));
    const tokenReset = parseDurationMs(get('x-ratelimit-reset-tokens'));
    const requestReset = parseDurationMs(get('x-ratelimit-reset-requests'));
    let ms = Math.max(...resets);
    if (remainingRequests > 0 && tokenReset !== null) ms = tokenReset;
    else if (remainingTokens > 0 && requestReset !== null) ms = requestReset;
    return cap(ms + 250);
  }
  const m = /try again in ((?:\d+(?:\.\d+)?h)?(?:\d+(?:\.\d+)?m(?!s))?(?:\d+(?:\.\d+)?s)?(?:\d+(?:\.\d+)?ms)?)/i.exec(text || '');
  const stated = m ? parseDurationMs(m[1]) : null;
  if (stated !== null) return cap(stated + 250);
  const base = 1000 * 2 ** attempt;
  return cap(base + Math.floor(Math.random() * 250));
};

/**
 * POST with bounded retries on 429/5xx. Waits honour the server's rate-limit hints, and the
 * sum of all waits for one call never exceeds RIP_AI_MAX_RETRY_WAIT_MS (default 60 s), so a
 * saturated provider fails fast enough for the caller to fall back or retry later.
 */
async function post(url, headers, body, signal) {
  let lastErr;
  let waited = 0;
  const retries = maxRetries();
  const budget = maxTotalWaitMs();
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: withTimeout(signal),
    });
    if (res.ok) return res;
    const text = await res.text().catch(() => '');
    lastErr = Object.assign(new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`), { status: res.status });
    if (!retryable(res.status) || attempt === retries) break;
    const delay = retryDelayMs(res, text, attempt);
    if (waited + delay > budget) {
      lastErr.retryAfterMs = delay;
      break;
    }
    waited += delay;
    log.info('AI request rate-limited/failed; retrying', { status: res.status, attempt: attempt + 1, delayMs: delay });
    await sleep(delay, signal);
  }
  throw lastErr;
}

// ─── Client-side tokens-per-minute throttle ───────────────────────────────────

/**
 * Sliding-window TPM limiter. Providers such as Groq count prompt + max_tokens against a per-minute
 * token budget and answer 429 when a request would exceed it; waiting locally first avoids that.
 * Estimates are conservative (≈4 characters per token plus the requested max_tokens).
 */
class TokenRateLimiter {
  constructor(tpmFn, { windowMs = 60000, now = () => Date.now(), sleepFn = sleep } = {}) {
    this.tpmFn = tpmFn;
    this.windowMs = windowMs;
    this.now = now;
    this.sleepFn = sleepFn;
    this.entries = []; // { at, tokens }
    this.queue = Promise.resolve();
  }

  used() {
    const cutoff = this.now() - this.windowMs;
    while (this.entries.length && this.entries[0].at <= cutoff) this.entries.shift();
    return this.entries.reduce((s, e) => s + e.tokens, 0);
  }

  /** How long to wait before `tokens` more fit in the window (0 = now). */
  waitFor(tokens) {
    const tpm = this.tpmFn();
    if (!tpm || tpm <= 0) return 0;
    const need = Math.min(tokens, tpm); // a request larger than the budget waits for an empty window
    let used = this.used();
    if (used + need <= tpm) return 0;
    for (const e of this.entries) {
      used -= e.tokens;
      if (used + need <= tpm) return Math.max(0, e.at + this.windowMs - this.now()) + 50;
    }
    return this.windowMs;
  }

  /** Reserve `tokens`, waiting (serially, FIFO) until they fit. Resolves to { waited, entry }. */
  acquire(tokens, signal) {
    const run = async () => {
      let waited = 0;
      for (;;) {
        const w = this.waitFor(tokens);
        if (!w) break;
        waited += w;
        await this.sleepFn(w, signal);
      }
      const entry = { at: this.now(), tokens };
      this.entries.push(entry);
      return { waited, entry };
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }

  /** Replace a reservation's estimate with the real usage once known. */
  static settle(entry, actual) {
    if (entry && Number.isFinite(actual) && actual > 0) entry.tokens = actual;
  }
}

const estimateTokens = (body) => Math.ceil(JSON.stringify(body.messages || body.contents || '').length / 4) + (body.max_tokens || body.generationConfig?.maxOutputTokens || 0);

/** Groq tokens-per-minute budget (RIP_GROQ_TPM, default 8000 = free tier; 0 disables the throttle). */
const groqTpm = () => {
  const v = process.env.RIP_GROQ_TPM;
  return v === undefined || v === '' ? 8000 : Number(v) || 0;
};
const groqLimiter = new TokenRateLimiter(groqTpm);

/** Clamp max_tokens so prompt + max_tokens fits the TPM budget (else Groq rejects it outright). */
const fitToBudget = (body) => {
  const tpm = groqTpm();
  if (!tpm || !body.max_tokens) return body;
  const prompt = estimateTokens({ ...body, max_tokens: 0 });
  const room = Math.floor(tpm * 0.95) - prompt;
  return room < body.max_tokens ? { ...body, max_tokens: Math.max(256, room) } : body;
};

async function groqPost(body, signal) {
  const fitted = fitToBudget(body);
  const reserved = estimateTokens(fitted);
  const { waited, entry } = await groqLimiter.acquire(reserved, signal);
  if (waited > 1000) log.info('Groq request throttled to stay under the TPM budget', { waitedMs: waited, tokens: reserved, tpm: groqTpm() });
  return { res: await post(`${GROQ_BASE}/chat/completions`, groqHeaders(), fitted, signal), entry };
}

/** Yield parsed JSON payloads from an SSE response body. */
async function* sseEvents(res) {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        yield JSON.parse(data);
      } catch {
        // partial/garbled line — ignore
      }
    }
  }
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

const geminiHeaders = () => ({ 'x-goog-api-key': process.env.GEMINI_API_KEY });

const geminiGenerationConfig = ({ maxTokens, json, temperature }) => {
  const cfg = { temperature: temperature ?? 0.2, maxOutputTokens: maxTokens || 4096 };
  if (json) cfg.responseMimeType = 'application/json';
  if (process.env.RIP_GEMINI_THINKING_BUDGET !== undefined && process.env.RIP_GEMINI_THINKING_BUDGET !== '') {
    cfg.thinkingConfig = { thinkingBudget: Number(process.env.RIP_GEMINI_THINKING_BUDGET) };
  }
  return cfg;
};

const toGeminiContents = (messages) => {
  const contents = [];
  for (const m of messages) {
    if (m.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: m.content }] });
    } else if (m.role === 'assistant') {
      // Replay Gemini's own parts verbatim when we have them (keeps thought signatures intact).
      const parts = m._geminiParts?.length
        ? m._geminiParts
        : [
          ...(m.content ? [{ text: m.content }] : []),
          ...(m.toolCalls || []).map((tc) => ({ functionCall: { name: tc.name, args: tc.args || {} } })),
        ];
      if (parts.length) contents.push({ role: 'model', parts });
    } else if (m.role === 'tool') {
      let response;
      try {
        response = { result: JSON.parse(m.content) };
      } catch {
        response = { result: m.content };
      }
      const part = { functionResponse: { name: m.name, response } };
      const last = contents[contents.length - 1];
      // Group consecutive tool results into one turn, as Gemini expects.
      if (last && last.role === 'user' && last.parts.every((p) => p.functionResponse)) last.parts.push(part);
      else contents.push({ role: 'user', parts: [part] });
    }
  }
  return contents;
};

async function geminiComplete({ system, prompt, maxTokens, json, temperature }) {
  const model = geminiModel();
  const res = await post(`${GEMINI_BASE}/models/${model}:generateContent`, geminiHeaders(), {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: geminiGenerationConfig({ maxTokens, json, temperature }),
  });
  const body = await res.json();
  const parts = body?.candidates?.[0]?.content?.parts || [];
  const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join('');
  if (!text) throw new Error(`Gemini returned no text (finishReason=${body?.candidates?.[0]?.finishReason || 'unknown'})`);
  return {
    text,
    provider: 'gemini',
    model,
    inputTokens: body?.usageMetadata?.promptTokenCount || 0,
    outputTokens: body?.usageMetadata?.candidatesTokenCount || 0,
  };
}

async function geminiChatTurn({ system, messages, tools, maxTokens, onText, signal }) {
  const model = geminiModel();
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: toGeminiContents(messages),
    generationConfig: geminiGenerationConfig({ maxTokens }),
  };
  if (tools?.length) {
    body.tools = [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }];
  }
  const res = await post(`${GEMINI_BASE}/models/${model}:streamGenerateContent?alt=sse`, geminiHeaders(), body, signal);

  let text = '';
  const toolCalls = [];
  const rawParts = [];
  let usage = {};
  let emitted = false;
  for await (const evt of sseEvents(res)) {
    if (evt.usageMetadata) usage = evt.usageMetadata;
    for (const part of evt?.candidates?.[0]?.content?.parts || []) {
      rawParts.push(part);
      if (part.functionCall) {
        toolCalls.push({ id: `call_${toolCalls.length}_${Date.now()}`, name: part.functionCall.name, args: part.functionCall.args || {} });
      } else if (part.text && !part.thought) {
        text += part.text;
        emitted = true;
        onText?.(part.text);
      }
    }
  }
  return {
    text,
    toolCalls,
    rawParts,
    emitted,
    provider: 'gemini',
    model,
    inputTokens: usage.promptTokenCount || 0,
    outputTokens: usage.candidatesTokenCount || 0,
  };
}

// ─── Groq (OpenAI-compatible) ─────────────────────────────────────────────────

const groqHeaders = () => ({ Authorization: `Bearer ${process.env.GROQ_API_KEY}` });

/**
 * gpt-oss models reason before answering, and those tokens count toward max_tokens.
 * Keep the effort low (RIP_GROQ_REASONING_EFFORT: low | medium | high) and never return the
 * reasoning text, so short calls still produce an answer and nothing internal reaches users.
 */
const withReasoningOptions = (body) => {
  if (!/gpt-oss/i.test(body.model)) return body;
  return { ...body, reasoning_effort: process.env.RIP_GROQ_REASONING_EFFORT || 'low', include_reasoning: false };
};

const toOpenAiMessages = (system, messages) => {
  const out = [{ role: 'system', content: system }];
  for (const m of messages) {
    if (m.role === 'user') out.push({ role: 'user', content: m.content });
    else if (m.role === 'assistant') {
      const msg = { role: 'assistant', content: m.content || null };
      if (m.toolCalls?.length) {
        msg.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.args || {}) },
        }));
      }
      out.push(msg);
    } else if (m.role === 'tool') {
      out.push({ role: 'tool', tool_call_id: m.toolCallId, content: m.content });
    }
  }
  return out;
};

async function groqComplete({ system, prompt, maxTokens, json, temperature }) {
  const model = groqModel();
  const body = {
    model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
    temperature: temperature ?? 0.2,
    max_tokens: maxTokens || 4096,
  };
  if (json) body.response_format = { type: 'json_object' };
  const { res, entry } = await groqPost(withReasoningOptions(body));
  const data = await res.json();
  TokenRateLimiter.settle(entry, data?.usage?.total_tokens);
  const text = data?.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('Groq returned no text');
  return {
    text,
    provider: 'groq',
    model,
    inputTokens: data?.usage?.prompt_tokens || 0,
    outputTokens: data?.usage?.completion_tokens || 0,
  };
}

/**
 * Groq validates tool arguments against the schema and rejects the whole turn on a mismatch.
 * Models often send null for an optional argument, so optional properties also accept null.
 */
const nullableOptional = (schema) => {
  if (!schema || schema.type !== 'object' || !schema.properties) return schema;
  const required = new Set(schema.required || []);
  const properties = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    if (required.has(key) || typeof prop.type !== 'string') {
      properties[key] = prop;
      continue;
    }
    properties[key] = { ...prop, type: [prop.type, 'null'], ...(Array.isArray(prop.enum) ? { enum: [...prop.enum, null] } : {}) };
  }
  return { ...schema, properties };
};

/** One retry when Groq rejects the model's tool call (tool_use_failed); generations vary between attempts. */
async function groqChatTurn(opts) {
  let emitted = false;
  const onText = (t) => {
    emitted = true;
    opts.onText?.(t);
  };
  try {
    return await groqChatTurnOnce({ ...opts, onText });
  } catch (err) {
    if (err.code !== 'tool_use_failed' || emitted || opts.signal?.aborted) throw err;
    log.warn('Groq rejected a tool call; retrying once', { error: err.message });
    return groqChatTurnOnce({ ...opts, onText });
  }
}

async function groqChatTurnOnce({ system, messages, tools, maxTokens, onText, signal }) {
  const model = groqModel();
  const body = {
    model,
    messages: toOpenAiMessages(system, messages),
    temperature: 0.2,
    max_tokens: maxTokens || 4096,
    stream: true,
  };
  if (tools?.length) {
    body.tools = tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: nullableOptional(t.parameters) } }));
    body.tool_choice = 'auto';
  }
  const { res, entry } = await groqPost(withReasoningOptions(body), signal);

  let text = '';
  let emitted = false;
  const partial = new Map(); // index → { id, name, args }
  let usage = {};
  for await (const evt of sseEvents(res)) {
    if (evt.error) throw Object.assign(new Error(`Groq stream error: ${evt.error.message || evt.error.code}`), { code: evt.error.code });
    const u = evt.usage || evt.x_groq?.usage;
    if (u) usage = u;
    const delta = evt?.choices?.[0]?.delta;
    if (!delta) continue;
    if (delta.content) {
      text += delta.content;
      emitted = true;
      onText?.(delta.content);
    }
    for (const tc of delta.tool_calls || []) {
      const cur = partial.get(tc.index) || { id: tc.id, name: '', args: '' };
      if (tc.id) cur.id = tc.id;
      if (tc.function?.name) cur.name += tc.function.name;
      if (tc.function?.arguments) cur.args += tc.function.arguments;
      partial.set(tc.index, cur);
    }
  }
  TokenRateLimiter.settle(entry, (usage.prompt_tokens || 0) + (usage.completion_tokens || 0));
  const toolCalls = [...partial.values()].map((tc, i) => {
    let args = {};
    try {
      args = tc.args ? JSON.parse(tc.args) : {};
    } catch {
      log.warn('Groq tool call had invalid JSON arguments', { name: tc.name });
    }
    return { id: tc.id || `call_${i}_${Date.now()}`, name: tc.name, args };
  });
  return {
    text,
    toolCalls,
    emitted,
    provider: 'groq',
    model,
    inputTokens: usage.prompt_tokens || 0,
    outputTokens: usage.completion_tokens || 0,
  };
}

const IMPL = {
  gemini: { complete: geminiComplete, chatTurn: geminiChatTurn },
  groq: { complete: groqComplete, chatTurn: groqChatTurn },
};

// ─── Cache (per tenant, via tenantExtension) ──────────────────────────────────

const cacheKeyOf = (parts) => crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex');

async function readCache(cacheKey) {
  if (!tenantContext.getTenantId()) return null;
  const row = await prisma.ripAiCache.findFirst({ where: { cacheKey }, select: { id: true, response: true, expiresAt: true } });
  if (!row) return null;
  if (row.expiresAt && row.expiresAt < new Date()) {
    await prisma.ripAiCache.delete({ where: { id: row.id } }).catch(() => {});
    return null;
  }
  prisma.ripAiCache.update({ where: { id: row.id }, data: { hitCount: { increment: 1 } } }).catch(() => {});
  return row.response;
}

async function writeCache(cacheKey, context, result, ttlHours) {
  const universityId = tenantContext.getTenantId();
  if (!universityId) return;
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000);
  await prisma.ripAiCache.upsert({
    where: { universityId_cacheKey: { universityId, cacheKey } },
    update: { response: result, provider: result.provider, expiresAt, context },
    create: { cacheKey, response: result, provider: result.provider, expiresAt, context },
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * One-shot completion with provider fallback and per-tenant caching.
 * @returns {Promise<{text, provider, model, inputTokens, outputTokens, cacheHit}>}
 */
async function complete({ system, prompt, maxTokens = 4096, json = false, temperature, cacheContext = 'general', cacheTtlHours = 168, skipCache = false }) {
  const providers = availableProviders();
  if (!providers.length) throw new AiUnavailableError('No AI provider configured. Set GEMINI_API_KEY and/or GROQ_API_KEY.');

  const cacheKey = cacheKeyOf([system, prompt, json]);
  if (!skipCache) {
    const hit = await readCache(cacheKey).catch(() => null);
    if (hit) return { ...hit, cacheHit: true };
  }

  let lastErr;
  for (const p of providers) {
    try {
      const result = await IMPL[p].complete({ system, prompt, maxTokens, json, temperature });
      if (!skipCache) await writeCache(cacheKey, cacheContext, result, cacheTtlHours).catch((e) => log.warn('AI cache write failed', { error: e.message }));
      return { ...result, cacheHit: false };
    } catch (err) {
      lastErr = err;
      log.warn(`AI provider ${p} failed`, { error: err.message });
    }
  }
  throw new AiUnavailableError(`All AI providers failed: ${lastErr?.message || 'unknown error'}`);
}

/** Extract the first JSON value from model output, tolerating code fences and stray prose. */
function parseJsonLoose(text) {
  let raw = String(text || '').trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.search(/[[{]/);
    const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
    if (start !== -1 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new Error('Model output was not valid JSON');
  }
}

async function completeJson(opts) {
  const result = await complete({ ...opts, json: true });
  return { ...result, data: parseJsonLoose(result.text) };
}

/**
 * One streamed model turn with tools. Falls back to the next provider only if the
 * failing one had not yet streamed any text (so the user never sees mixed output).
 */
async function chatTurn({ system, messages, tools, maxTokens = 2048, onText, signal, preferProvider }) {
  let providers = availableProviders();
  if (!providers.length) throw new AiUnavailableError('No AI provider configured. Set GEMINI_API_KEY and/or GROQ_API_KEY.');
  if (preferProvider && providers.includes(preferProvider)) providers = [preferProvider, ...providers.filter((p) => p !== preferProvider)];

  let lastErr;
  for (const p of providers) {
    let emitted = false;
    try {
      return await IMPL[p].chatTurn({
        system,
        messages,
        tools,
        maxTokens,
        signal,
        onText: (t) => {
          emitted = true;
          onText?.(t);
        },
      });
    } catch (err) {
      if (signal?.aborted) throw err;
      lastErr = err;
      log.warn(`AI chat provider ${p} failed`, { error: err.message, emitted });
      if (emitted) break;
    }
  }
  throw new AiUnavailableError(`AI chat failed: ${lastErr?.message || 'unknown error'}`);
}

const status = () => ({
  configured: isConfigured(),
  providers: availableProviders().map((p) => ({ provider: p, model: p === 'gemini' ? geminiModel() : groqModel() })),
});

module.exports = {
  complete,
  completeJson,
  chatTurn,
  parseJsonLoose,
  isConfigured,
  status,
  AiUnavailableError,
  _internals: { post, retryDelayMs, parseDurationMs, TokenRateLimiter, groqLimiter, fitToBudget, estimateTokens },
};
