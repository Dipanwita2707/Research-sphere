/**
 * Groq chat turns: optional tool parameters accept null, stream errors are surfaced
 * (not swallowed into an empty answer), and a rejected tool call is retried once.
 * fetch is mocked; no network.
 */

jest.mock('../../../shared/config/database', () => ({}));

const ai = require('../services/ai/aiProvider');
const { _internals } = require('../services/chat/chat.service');

const sse = (...events) => {
  const body = events.map((e) => (e.event ? `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n` : `data: ${JSON.stringify(e)}\n\n`)).join('') + 'data: [DONE]\n\n';
  return { ok: true, status: 200, headers: new Map(), body: [Buffer.from(body)] };
};
const toolCallChunk = (name, args) => ({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name, arguments: JSON.stringify(args) } }] } }] });
const toolUseFailed = { event: 'error', data: { error: { message: 'parameters for tool x did not match schema', code: 'tool_use_failed' } } };

const TOOLS = [{
  name: 'explore_taxonomy',
  description: 'Browse research areas',
  parameters: {
    type: 'object',
    properties: { domain: { type: 'string' }, sort: { type: 'string', enum: ['recent', 'cited'] }, query: { type: 'string' } },
    required: ['query'],
  },
}];

const ENV = { ...process.env };
beforeEach(() => {
  // RIP_GROQ_TPM=0: the client-side TPM throttle is covered in aiRateLimit.test.js
  process.env = { ...ENV, GROQ_API_KEY: 'test-key', RIP_GROQ_MODEL: 'openai/gpt-oss-120b', RIP_GROQ_TPM: '0' };
  delete process.env.GEMINI_API_KEY;
  global.fetch = jest.fn();
});
afterAll(() => {
  process.env = ENV;
});

test('optional tool parameters accept null; required ones do not; gpt-oss reasoning is hidden', async () => {
  global.fetch.mockResolvedValueOnce(sse(toolCallChunk('explore_taxonomy', { query: 'ai', domain: null })));
  await ai.chatTurn({ system: 's', messages: [{ role: 'user', content: 'q' }], tools: TOOLS });
  const body = JSON.parse(global.fetch.mock.calls[0][1].body);
  const props = body.tools[0].function.parameters.properties;
  expect(props.domain.type).toEqual(['string', 'null']);
  expect(props.sort.enum).toEqual(['recent', 'cited', null]);
  expect(props.query.type).toBe('string');
  expect(body.include_reasoning).toBe(false);
  expect(body.reasoning_effort).toBe('low');
});

test('a tool_use_failed stream error is retried once and then succeeds', async () => {
  global.fetch
    .mockResolvedValueOnce(sse({ choices: [{ delta: { role: 'assistant', content: '' } }] }, toolUseFailed))
    .mockResolvedValueOnce(sse(toolCallChunk('explore_taxonomy', { query: 'ai' })));
  const turn = await ai.chatTurn({ system: 's', messages: [{ role: 'user', content: 'q' }], tools: TOOLS });
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(turn.toolCalls).toEqual([{ id: 'call_1', name: 'explore_taxonomy', args: { query: 'ai' } }]);
});

test('a stream error that persists is raised, not turned into an empty answer', async () => {
  global.fetch.mockResolvedValue(sse(toolUseFailed));
  await expect(ai.chatTurn({ system: 's', messages: [{ role: 'user', content: 'q' }], tools: TOOLS })).rejects.toThrow(/tool_use_failed|did not match schema/);
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('a 429 waits for the time Groq states in its message, then succeeds', async () => {
  const limited = { ok: false, status: 429, headers: new Map(), text: async () => '{"error":{"message":"Rate limit reached ... Please try again in 120ms."}}' };
  global.fetch.mockResolvedValueOnce(limited).mockResolvedValueOnce(sse(toolCallChunk('explore_taxonomy', { query: 'ai' })));
  const started = Date.now();
  const turn = await ai.chatTurn({ system: 's', messages: [{ role: 'user', content: 'q' }], tools: TOOLS });
  expect(Date.now() - started).toBeGreaterThanOrEqual(300);
  expect(Date.now() - started).toBeLessThan(1500);
  expect(turn.toolCalls).toHaveLength(1);
});

test('gpt-oss citation brackets are normalised to the [n] form the UI links', () => {
  const text = _internals.normalizeCitations('see 【6】 and 【7, 8】');
  expect(text).toBe('see [6] and [7, 8]');
  expect([..._internals.citedRefs(text)]).toEqual([6, 7, 8]);
});
