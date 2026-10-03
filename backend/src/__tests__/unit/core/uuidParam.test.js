/**
 * skipNonUuidParam: a non-UUID :id must not reach the handler (which would hit Prisma and
 * return 500); the request falls through to later routes/routers and ends in a 404.
 */
const express = require('express');
const { isUuid, skipNonUuidParam } = require('../../../shared/utils/uuidParam');

const ID = '1ea2bfc7-cd89-4c93-be4f-3f4d92788c59';

describe('isUuid', () => {
  test.each([
    [ID, true],
    [ID.toUpperCase(), true],
    ['undefined', false],
    ['not-a-uuid', false],
    [`${ID}x`, false],
    ['', false],
    [undefined, false],
  ])('%p -> %p', (value, expected) => {
    expect(isUuid(value)).toBe(expected);
  });
});

describe('router.param("id", skipNonUuidParam)', () => {
  let server;
  let base;
  const handler = jest.fn((req, res) => res.json({ id: req.params.id }));

  beforeAll(async () => {
    const contributions = express.Router();
    contributions.param('id', skipNonUuidParam);
    contributions.get('/:id', handler);
    contributions.post('/:id/submit', handler);

    const later = express.Router();
    later.get('/', (req, res) => res.json({ later: true }));

    const research = express.Router();
    research.use('/', contributions);
    research.use('/progress', later);

    const app = express();
    app.use('/research', research);
    app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

    await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
    base = `http://127.0.0.1:${server.address().port}/research`;
  });

  afterAll(() => new Promise((resolve) => server.close(resolve)));
  beforeEach(() => handler.mockClear());

  test('a UUID reaches the handler', async () => {
    const res = await fetch(`${base}/${ID}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: ID });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['GET', '/not-a-uuid'],
    ['POST', '/undefined/submit'],
  ])('%s %s -> 404 without calling the handler', async (method, path) => {
    const res = await fetch(`${base}${path}`, { method });
    expect(res.status).toBe(404);
    expect(handler).not.toHaveBeenCalled();
  });

  test('a later router with a single-segment path is not shadowed by /:id', async () => {
    const res = await fetch(`${base}/progress`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ later: true });
    expect(handler).not.toHaveBeenCalled();
  });
});
