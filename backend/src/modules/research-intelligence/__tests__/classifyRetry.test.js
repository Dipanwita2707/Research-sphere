/**
 * Keyword classification: batch size is configurable, and a batch that fails (e.g. a 429 from
 * the AI provider) is retried once at the end of the run instead of being dropped.
 */

const mockKeywords = Array.from({ length: 12 }, (_, i) => ({ id: `k${i}`, canonicalName: `keyword ${i}`, mapped: false }));
const mockMappings = [];

jest.mock('../../../shared/config/database', () => ({
  ripTaxonomyDomain: {
    count: jest.fn(async () => 1),
    findMany: jest.fn(async () => [{ id: 'd1', slug: 'cs', name: 'Computer Science', status: 'active', categories: [{ id: 'c1', slug: 'ml', name: 'Machine Learning', status: 'active', specializations: [] }] }]),
  },
  ripResearchKeyword: {
    findMany: jest.fn(async ({ where, take }) => {
      let list = mockKeywords.filter((k) => !k.mapped);
      if (where.id?.notIn) list = list.filter((k) => !where.id.notIn.includes(k.id));
      if (where.id?.in) list = list.filter((k) => where.id.in.includes(k.id));
      return list.slice(0, take ?? list.length).map(({ id, canonicalName }) => ({ id, canonicalName }));
    }),
  },
  ripKeywordTaxonomyMapping: {
    createMany: jest.fn(async ({ data }) => {
      data.forEach((r) => {
        mockMappings.push(r);
        mockKeywords.find((k) => k.id === r.keywordId).mapped = true;
      });
      return { count: data.length };
    }),
  },
}));

jest.mock('../services/ai/aiProvider', () => ({
  isConfigured: () => true,
  completeJson: jest.fn(),
}));

const ai = require('../services/ai/aiProvider');
const taxonomy = require('../services/taxonomy.service');

const classifyAll = ({ prompt }) => {
  const names = [...prompt.matchAll(/^- (.+)$/gm)].map((m) => m[1]);
  return { data: { classifications: names.map((keyword) => ({ keyword, primary: 'cs/ml', confidence: 0.95 })) } };
};
const rateLimited = () => Object.assign(new Error('All AI providers failed: HTTP 429'), { name: 'AiUnavailableError' });

const ENV = { ...process.env };
beforeEach(() => {
  mockKeywords.forEach((k) => { k.mapped = false; });
  mockMappings.length = 0;
  ai.completeJson.mockReset();
  process.env = { ...ENV };
});

test('uses RIP_CLASSIFY_BATCH_SIZE and scales the output budget with the batch', async () => {
  process.env.RIP_CLASSIFY_BATCH_SIZE = '5';
  ai.completeJson.mockImplementation(async (o) => classifyAll(o));
  const stats = await taxonomy.classifyKeywords({ maxKeywords: 100 });
  expect(ai.completeJson).toHaveBeenCalledTimes(3); // 5 + 5 + 2
  expect(ai.completeJson.mock.calls[0][0].maxTokens).toBe(1000 + 5 * 120);
  expect(stats).toMatchObject({ processed: 12, mapped: 12, failedBatches: 0, retriedBatches: 0 });
});

test('a failed batch is retried once at the end and its keywords are classified', async () => {
  ai.completeJson
    .mockImplementationOnce(async () => { throw rateLimited(); })
    .mockImplementation(async (o) => classifyAll(o));
  const stats = await taxonomy.classifyKeywords({ maxKeywords: 100, batchSize: 5 });
  expect(stats).toMatchObject({ processed: 12, mapped: 12, retriedBatches: 1, recoveredBatches: 1, failedBatches: 0 });
  expect(mockKeywords.every((k) => k.mapped)).toBe(true);
  // the retry is the last call and covers the first batch's keywords
  const lastPrompt = ai.completeJson.mock.calls.at(-1)[0].prompt;
  expect(lastPrompt).toMatch(/- keyword 0\n/);
});

test('a batch that fails again is reported, not retried forever', async () => {
  ai.completeJson.mockImplementation(async (o) => (/- keyword 0\n/.test(o.prompt) ? Promise.reject(rateLimited()) : classifyAll(o)));
  const stats = await taxonomy.classifyKeywords({ maxKeywords: 100, batchSize: 5 });
  expect(stats).toMatchObject({ retriedBatches: 1, recoveredBatches: 0, failedBatches: 1, mapped: 7 });
  expect(ai.completeJson).toHaveBeenCalledTimes(4);
});
