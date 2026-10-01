/**
 * Research assistant chat — Research Intelligence
 *
 * An agent loop over the tools in tools.js:
 *   user message → model (streamed) → tool calls → tool results → model → … → answer
 *
 * Compared with the reference implementation (regex intent → one pre-fetched data blob →
 * one blocking completion), this answers multi-part questions ("compare CSE and ECE on AI
 * and name their top experts"), grounds every claim in retrieved records with [n] citations,
 * streams tokens and tool progress to the client, and keeps no institution-specific hacks.
 */

'use strict';

const prisma = require('../../../../shared/config/database');
const { NotFoundError, ValidationError } = require('../../../../shared/utils/AppError');
const { createModuleLogger } = require('../../../../shared/utils/logger');
const ai = require('../ai/aiProvider');
const tools = require('./tools');

const log = createModuleLogger('rip:chat');

const MAX_TOOL_ROUNDS = 6;
const HISTORY_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 4000;
const MAX_TOOL_RESULT_CHARS = 12000;

function systemPrompt({ universityName, userName, userRole }) {
  const today = new Date().toISOString().slice(0, 10);
  return `You are the Research Intelligence assistant for ${universityName}. You help faculty, students, research staff and leadership understand the university's research: publications, experts, topics, trends, collaborations and departmental performance.

Today is ${today}. You are talking to ${userName || 'a user'} (role: ${userRole || 'unknown'}).

How to work:
- Use the tools for every factual statement about the university: its papers, people, numbers and trends. Never rely on memory for institutional facts, and never invent names, titles, counts or journals.
- Plan before answering. Break multi-part questions into several tool calls, and chain them when one result informs the next (e.g. find the experts, then look up a profile).
- Publication search expands queries through abbreviations, the research taxonomy (domain → category → specialization) and related
  topics. Each paper reports matched_via; when a paper only matched via "taxonomy" or "related", say so briefly (e.g. "also relevant,
  via the Computer Vision area") rather than presenting it as a direct match. Use the "category" filter for questions scoped to an area.
- If a tool reports ambiguity (several researchers or departments match), ask the user a short clarifying question rather than guessing.
- If the data is missing or sparse, say so plainly and suggest what would help (e.g. researchers syncing their Scopus/ORCID profiles).
- General academic knowledge (what a method is, how a field is developing globally) is fine to share without tools, but keep it clearly separate from claims about ${universityName}.

Citations:
- Tool results label publications and researchers with "ref" numbers. Cite them inline as [n] right after the claim they support, e.g. "Dr. Rao leads the work on federated learning [3], including a 2024 Q1 paper [7]."
- Only cite ref numbers that appear in tool results from this turn.
- Every paper or researcher you mention from a tool result gets its [n], including inside tables (put it next to the title or name). Use plain square brackets only.

Style:
- Lead with the direct answer, then the supporting detail. Be concise; use short paragraphs, bullet lists and markdown tables where they help (tables suit comparisons and rankings).
- Use researchers' names and designations as given. Do not expose internal IDs, UUIDs or tool names.
- For reports or briefings, write a well-structured markdown document with headings (##), a short executive summary, tables of key figures and clear recommendations.
- Do not start follow-up answers with greetings or re-introductions.`;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

const createSession = (userId, title) =>
  prisma.ripChatSession.create({ data: { userId, title: title ? String(title).slice(0, 256) : null } });

const listSessions = (userId, { search, limit = 50 } = {}) =>
  prisma.ripChatSession.findMany({
    where: { userId, ...(search ? { title: { contains: String(search), mode: 'insensitive' } } : {}) },
    orderBy: [{ pinned: 'desc' }, { lastActiveAt: 'desc' }],
    take: Math.min(Number(limit) || 50, 200),
    select: { id: true, title: true, pinned: true, messageCount: true, lastActiveAt: true, createdAt: true },
  });

async function getOwnedSession(sessionId, userId) {
  const session = await prisma.ripChatSession.findFirst({ where: { id: sessionId, userId } });
  if (!session) throw new NotFoundError('Chat session not found');
  return session;
}

async function getMessages(sessionId, userId) {
  await getOwnedSession(sessionId, userId);
  return prisma.ripChatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, role: true, content: true, toolTrace: true, sources: true, provider: true, model: true, responseTimeMs: true, feedback: true, createdAt: true },
  });
}

async function updateSession(sessionId, userId, { title, pinned }) {
  await getOwnedSession(sessionId, userId);
  const data = {};
  if (title !== undefined) {
    if (!String(title).trim()) throw new ValidationError('Title cannot be empty');
    data.title = String(title).trim().slice(0, 256);
  }
  if (pinned !== undefined) data.pinned = !!pinned;
  return prisma.ripChatSession.update({ where: { id: sessionId }, data });
}

async function deleteSession(sessionId, userId) {
  await getOwnedSession(sessionId, userId);
  await prisma.ripChatSession.delete({ where: { id: sessionId } });
}

async function setFeedback(messageId, userId, value) {
  const msg = await prisma.ripChatMessage.findFirst({ where: { id: messageId, role: 'assistant', session: { userId } }, select: { id: true } });
  if (!msg) throw new NotFoundError('Message not found');
  const feedback = value === 1 || value === -1 ? value : null;
  return prisma.ripChatMessage.update({ where: { id: messageId }, data: { feedback }, select: { id: true, feedback: true } });
}

// ─── History ──────────────────────────────────────────────────────────────────

/**
 * Prior turns as plain text. Citation markers are stripped (ref numbers restart every turn)
 * and each assistant turn carries a compact list of what it cited, so follow-ups like
 * "tell me more about the second paper" still resolve.
 */
async function loadHistory(sessionId) {
  const rows = await prisma.ripChatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_MESSAGES,
    select: { role: true, content: true, sources: true },
  });
  return rows.reverse().map((m) => {
    if (m.role !== 'assistant') return { role: 'user', content: m.content.slice(0, MAX_MESSAGE_CHARS) };
    const cited = (Array.isArray(m.sources) ? m.sources : []).filter((s) => s.cited).slice(0, 12);
    const refs = cited.length
      ? `\n\n(Records referenced above: ${cited.map((s) => (s.type === 'publication' ? `"${s.title}" (${s.year || 'n.d.'})` : s.name)).join('; ')})`
      : '';
    return { role: 'assistant', content: m.content.replace(/\s?\[\d+(?:\s*,\s*\d+)*\]/g, '').slice(0, 3000) + refs };
  });
}

/** gpt-oss cites as 【6】; the UI and citedRefs expect [6]. Per-character, so it is safe on stream chunks. */
const normalizeCitations = (text) => String(text).replace(/【/g, '[').replace(/】/g, ']');

const citedRefs = (text) => {
  const refs = new Set();
  for (const m of String(text).matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)) m[1].split(',').forEach((n) => refs.add(Number(n.trim())));
  return refs;
};

async function generateTitle(sessionId, firstMessage) {
  let title = firstMessage.replace(/\s+/g, ' ').trim().slice(0, 70);
  try {
    const r = await ai.complete({
      system: 'Write a 3-7 word title for a research chat that starts with the user message below. No quotes, no trailing punctuation.',
      prompt: firstMessage.slice(0, 800),
      maxTokens: 30,
      cacheContext: 'chat_title',
    });
    const t = r.text.replace(/["'\n]/g, '').trim();
    if (t && t.length <= 90) title = t;
  } catch {
    // keep the truncated message as title
  }
  await prisma.ripChatSession.updateMany({ where: { id: sessionId }, data: { title } }).catch(() => {});
  return title;
}

// ─── The agent loop ───────────────────────────────────────────────────────────

/**
 * Answer a user message, streaming progress through `emit(event, data)`:
 *   status   { phase }                                  thinking / answering
 *   tool     { id, name, label, state: start|end, summary? }
 *   delta    { text }                                   answer tokens
 *   sources  { items }                                  records the answer may cite
 *   done     { message, title? }                        persisted assistant message
 *   error    { message }
 *
 * @param {object} p
 * @param {string} p.sessionId @param {object} p.user @param {string} p.tenantId
 * @param {string} p.message   @param {Function} p.emit @param {AbortSignal} [p.signal]
 */
async function streamReply({ sessionId, user, tenantId, message, emit, signal }) {
  const text = String(message || '').trim();
  if (!text) throw new ValidationError('Message is required');
  if (text.length > MAX_MESSAGE_CHARS) throw new ValidationError(`Message is too long (max ${MAX_MESSAGE_CHARS} characters)`);

  const session = await getOwnedSession(sessionId, user.id);
  const university = await prisma.university.findFirst({ where: { id: tenantId }, select: { name: true } });
  const history = await loadHistory(sessionId);
  await prisma.ripChatMessage.create({ data: { sessionId, role: 'user', content: text } });

  const started = Date.now();
  const sources = new tools.SourceRegistry();
  const ctx = { tenantId, user, sources };
  const system = systemPrompt({ universityName: university?.name || 'the university', userName: user.employeeDetails?.displayName, userRole: user.role });
  const messages = [...history, { role: 'user', content: text }];
  const trace = [];
  const usage = { input: 0, output: 0, provider: null, model: null };
  let answer = '';
  let aborted = false;

  emit('status', { phase: 'thinking' });
  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const lastRound = round === MAX_TOOL_ROUNDS;
      let roundText = '';
      const turn = await ai.chatTurn({
        system,
        messages,
        tools: lastRound ? [] : tools.declarations(),
        maxTokens: 3072,
        signal,
        preferProvider: usage.provider || undefined,
        onText: (raw) => {
          const t = normalizeCitations(raw);
          if (!roundText) emit('status', { phase: 'answering' });
          roundText += t;
          emit('delta', { text: t });
        },
      });
      usage.input += turn.inputTokens;
      usage.output += turn.outputTokens;
      usage.provider = turn.provider;
      usage.model = turn.model;
      answer += normalizeCitations(turn.text);

      if (!turn.toolCalls.length) break;

      messages.push({ role: 'assistant', content: turn.text, toolCalls: turn.toolCalls, _geminiParts: turn.rawParts });
      if (turn.text) {
        answer += '\n\n';
        emit('delta', { text: '\n\n' });
      }
      // Independent lookups in one round run in parallel.
      const results = await Promise.all(
        turn.toolCalls.map(async (call) => {
          emit('tool', { id: call.id, name: call.name, label: tools.TOOLS.find((t) => t.name === call.name)?.label(call.args || {}) || call.name, state: 'start' });
          const r = await tools.execute(call.name, call.args, ctx);
          emit('tool', { id: call.id, name: call.name, label: r.label, state: 'end', summary: r.summary, failed: !!r.failed });
          trace.push({ tool: call.name, args: call.args, label: r.label, summary: r.summary });
          return { call, r };
        })
      );
      for (const { call, r } of results) {
        let content = JSON.stringify(r.result);
        if (content.length > MAX_TOOL_RESULT_CHARS) content = `${content.slice(0, MAX_TOOL_RESULT_CHARS)}…(truncated)`;
        messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content });
      }
      emit('status', { phase: 'thinking' });
    }
  } catch (err) {
    if (signal?.aborted) {
      aborted = true;
    } else {
      log.warn('Chat turn failed', { error: err.message, sessionId });
      if (!answer.trim()) {
        const rateLimited = /HTTP 429/.test(err.message);
        emit('error', {
          message: rateLimited
            ? 'The AI service is at its usage limit right now. Please try again in a minute.'
            : err.name === 'AiUnavailableError' ? 'The AI service is unavailable right now. Please try again shortly.' : 'Something went wrong while answering. Please try again.',
        });
        return null;
      }
      answer += '\n\n_(The answer was cut short by an error.)_';
    }
  }

  if (aborted && !answer.trim()) return null;
  if (aborted) answer += '\n\n_(Stopped.)_';
  if (!answer.trim()) answer = "I couldn't find an answer to that in the university's research records.";

  const cited = citedRefs(answer);
  const sourceItems = sources.items.map((s) => ({ ...s, cited: cited.has(s.ref) }));
  emit('sources', { items: sourceItems });

  const saved = await prisma.ripChatMessage.create({
    data: {
      sessionId,
      role: 'assistant',
      content: answer.trim(),
      toolTrace: trace,
      sources: sourceItems,
      provider: usage.provider,
      model: usage.model,
      inputTokens: usage.input,
      outputTokens: usage.output,
      responseTimeMs: Date.now() - started,
    },
    select: { id: true, role: true, content: true, toolTrace: true, sources: true, provider: true, model: true, responseTimeMs: true, feedback: true, createdAt: true },
  });
  await prisma.ripChatSession.update({ where: { id: sessionId }, data: { messageCount: { increment: 2 }, lastActiveAt: new Date() } });

  let title;
  if (!session.title) title = await generateTitle(sessionId, text);
  emit('done', { message: saved, title });
  log.info('Chat answered', { sessionId, rounds: trace.length, ms: Date.now() - started, provider: usage.provider, in: usage.input, out: usage.output });
  return saved;
}

module.exports = { createSession, listSessions, getMessages, updateSession, deleteSession, setFeedback, streamReply, _internals: { systemPrompt, citedRefs, normalizeCitations } };
