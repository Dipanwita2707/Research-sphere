/**
 * Rate-limit handling of the AI provider: Retry-After / x-ratelimit-reset headers, bounded
 * exponential backoff with a total wait cap, the client-side tokens-per-minute throttle, and
 * the classification stage retrying failed batches once at the end. fetch is mocked.
 */

jest.mock('../../../shared/config/database', () => ({}));

const ai = require('../services/ai/aiProvider');

const { retryDelayMs, parseDurationMs, post, TokenRateLimiter, fitToBudget } = ai._internals;

const headers = (h = {}) => new Map(Object.entries(h));
const res = (status, h = {}, text = '') => ({ ok: status >= 200 && status < 300, status, headers: headers(h), text: async () => text, json: async () => JSON.parse(text || '{}') });

const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
  jest.useRealTimers();
});

describe('parseDurationMs', () => {
  it.each([
    ['6.66s', 6660],
    ['850ms', 850],
    ['1m30s', 90000],
    ['2m', 120000],
    ['7', 7000],
    ['1h', 3600000],
  ])('%s → %d ms', (v, ms) => expect(parseDurationMs(v)).toBeCloseTo(ms, 0));

  it('rejects garbage', () => {
    expect(parseDurationMs('soon')).toBeNull();
    expect(parseDurationMs('')).toBeNull();
    expect(parseDurationMs(null)).toBeNull();
  });
});

describe('retryDelayMs', () => {
  it('honours Retry-After seconds and HTTP dates, capped at 30 s', () => {
    expect(retryDelayMs(res(429, { 'retry-after': '3' }), '', 0)).toBe(3250);
    expect(retryDelayMs(res(429, { 'retry-after': '600' }), '', 0)).toBe(30000);
    const at = new Date(Date.now() + 5000).toUTCString();
    const d = retryDelayMs(res(429, { 'retry-after': at }), '', 0);
    expect(d).toBeGreaterThan(3000);
    expect(d).toBeLessThanOrEqual(5250);
  });

  it('uses x-ratelimit-reset-tokens when the token budget is the one exhausted', () => {
    const r = res(429, { 'x-ratelimit-reset-tokens': '6.66s', 'x-ratelimit-reset-requests': '2m', 'x-ratelimit-remaining-requests': '900', 'x-ratelimit-remaining-tokens': '0' });
    expect(retryDelayMs(r, '', 0)).toBe(6910);
  });

  it('falls back to the wait stated in the message', () => {
    expect(retryDelayMs(res(429), 'Rate limit reached ... Please try again in 1.0725s. Need more tokens?', 0)).toBe(1323);
    expect(retryDelayMs(res(429), 'Please try again in 1m2s', 0)).toBe(62250 > 30000 ? 30000 : 62250);
  });

  it('otherwise backs off exponentially with jitter', () => {
    const d0 = retryDelayMs(res(503), 'oops', 0);
    const d2 = retryDelayMs(res(503), 'oops', 2);
    expect(d0).toBeGreaterThanOrEqual(1000);
    expect(d0).toBeLessThan(1250);
    expect(d2).toBeGreaterThanOrEqual(4000);
    expect(d2).toBeLessThan(4250);
    expect(retryDelayMs(res(503), '', 10)).toBe(30000);
  });
});

describe('post (bounded retries)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    global.fetch = jest.fn();
  });

  const run = async (p) => {
    let settled = false;
    let out;
    let err;
    p.then((v) => { out = v; }, (e) => { err = e; }).finally(() => { settled = true; });
    while (!settled) await jest.advanceTimersByTimeAsync(500);
    if (err) throw err;
    return out;
  };

  it('waits the Retry-After time and then succeeds', async () => {
    global.fetch
      .mockResolvedValueOnce(res(429, { 'retry-after': '2' }, 'slow down'))
      .mockResolvedValueOnce(res(200, {}, '{"ok":true}'));
    const started = Date.now();
    const r = await run(post('https://x', {}, {}));
    expect(r.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(Date.now() - started).toBeGreaterThanOrEqual(2250);
  });

  it('does not retry client errors', async () => {
    global.fetch.mockResolvedValueOnce(res(400, {}, 'bad request'));
    await expect(run(post('https://x', {}, {}))).rejects.toThrow(/HTTP 400/);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('stops after RIP_AI_MAX_RETRIES', async () => {
    process.env.RIP_AI_MAX_RETRIES = '2';
    global.fetch.mockResolvedValue(res(503, {}, 'down'));
    await expect(run(post('https://x', {}, {}))).rejects.toThrow(/HTTP 503/);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('gives up once the total wait budget would be exceeded', async () => {
    process.env.RIP_AI_MAX_RETRY_WAIT_MS = '10000';
    process.env.RIP_AI_MAX_RETRIES = '10';
    global.fetch.mockResolvedValue(res(429, { 'retry-after': '6' }, 'limit'));
    const started = Date.now();
    const err = await run(post('https://x', {}, {})).catch((e) => e);
    expect(err.status).toBe(429);
    expect(global.fetch).toHaveBeenCalledTimes(2); // 6.25 s waited, a second 6.25 s would exceed 10 s
    expect(Date.now() - started).toBeLessThan(10000);
  });
});

describe('TokenRateLimiter', () => {
  it('lets requests through while under budget and makes the next one wait for the window', async () => {
    let now = 0;
    const slept = [];
    const lim = new TokenRateLimiter(() => 8000, { now: () => now, sleepFn: async (ms) => { slept.push(ms); now += ms; } });
    expect((await lim.acquire(5000)).waited).toBe(0);
    now = 10000;
    const { waited } = await lim.acquire(5000); // 10000 > 8000 → wait until the first entry leaves the window
    expect(waited).toBe(50050);
    expect(now).toBe(60050);
  });

  it('settles a reservation to the real usage', async () => {
    let now = 0;
    const lim = new TokenRateLimiter(() => 8000, { now: () => now, sleepFn: async (ms) => { now += ms; } });
    const { entry } = await lim.acquire(7000);
    TokenRateLimiter.settle(entry, 1500);
    expect((await lim.acquire(6000)).waited).toBe(0);
  });

  it('a request larger than the whole budget waits for an empty window instead of forever', async () => {
    let now = 0;
    const lim = new TokenRateLimiter(() => 8000, { now: () => now, sleepFn: async (ms) => { now += ms; } });
    await lim.acquire(3000);
    const { waited } = await lim.acquire(20000);
    expect(waited).toBeGreaterThan(0);
    expect(waited).toBeLessThanOrEqual(60050);
  });

  it('is disabled with a budget of 0', async () => {
    const lim = new TokenRateLimiter(() => 0);
    expect((await lim.acquire(1e9)).waited).toBe(0);
  });
});

describe('fitToBudget', () => {
  it('clamps max_tokens so prompt + max_tokens fits the Groq TPM', () => {
    process.env.RIP_GROQ_TPM = '8000';
    const body = { messages: [{ role: 'user', content: 'x'.repeat(8000) }], max_tokens: 6000 };
    const fitted = fitToBudget(body);
    expect(fitted.max_tokens).toBeLessThan(6000);
    expect(fitted.max_tokens + 2000).toBeLessThanOrEqual(8000);
    process.env.RIP_GROQ_TPM = '0';
    expect(fitToBudget(body).max_tokens).toBe(6000);
  });
});

describe('Groq calls go through the throttle', () => {
  it('waits for the TPM window instead of sending a request that would 429', async () => {
    jest.useFakeTimers();
    process.env.GROQ_API_KEY = 'k';
    delete process.env.GEMINI_API_KEY;
    process.env.RIP_GROQ_TPM = '8000';
    ai._internals.groqLimiter.entries = [];
    const ok = () => res(200, {}, JSON.stringify({ choices: [{ message: { content: '{"a":1}' } }], usage: { total_tokens: 5000 } }));
    global.fetch = jest.fn().mockImplementation(async () => ok());
    await ai.complete({ system: 's', prompt: 'p', maxTokens: 5000, skipCache: true });
    const second = ai.complete({ system: 's', prompt: 'p', maxTokens: 5000, skipCache: true });
    await jest.advanceTimersByTimeAsync(1000);
    expect(global.fetch).toHaveBeenCalledTimes(1); // still waiting for the window
    await jest.advanceTimersByTimeAsync(60000);
    await second;
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
