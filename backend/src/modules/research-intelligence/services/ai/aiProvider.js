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
 * Env: GEMINI_API_KEY, GROQ_API_KEY, RIP_GEMINI_MODEL, RIP_GROQ_MODEL,
 *      RIP_GEMINI_THINKING_BUDGET (optional), RIP_AI_TIMEOUT_MS
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
const groqModel = () => process.env.RIP_GROQ_MODEL || 'llama-3.3-70b-versatile';
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** POST with up to 2 retries on 429/5xx. */
async function post(url, headers, body, signal) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: withTimeout(signal),
    });
    if (res.ok) return res;
    const text = await res.text().catch(() => '');
    lastErr = Object.assign(new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`), { status: res.status });
    if (!retryable(res.status) || attempt === 2) break;
    const retryAfter = Number(res.headers.get('retry-after'));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 10) * 1000 : (attempt + 1) * 2000);
  }
  throw lastErr;
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
  const res = await post(`${GROQ_BASE}/chat/completions`, groqHeaders(), body);
  const data = await res.json();
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

async function groqChatTurn({ system, messages, tools, maxTokens, onText, signal }) {
  const model = groqModel();
  const body = {
    model,
    messages: toOpenAiMessages(system, messages),
    temperature: 0.2,
    max_tokens: maxTokens || 4096,
    stream: true,
  };
  if (tools?.length) {
    body.tools = tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
    body.tool_choice = 'auto';
  }
  const res = await post(`${GROQ_BASE}/chat/completions`, groqHeaders(), body, signal);

  let text = '';
  let emitted = false;
  const partial = new Map(); // index → { id, name, args }
  let usage = {};
  for await (const evt of sseEvents(res)) {
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

module.exports = { complete, completeJson, chatTurn, parseJsonLoose, isConfigured, status, AiUnavailableError };
