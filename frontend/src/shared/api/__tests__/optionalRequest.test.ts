import { optionalRequest } from '../api';

describe('optionalRequest', () => {
  it('marks the request optional and keeps the given config', () => {
    const cfg = optionalRequest({ params: { from: '2026-01-01' } });
    expect(cfg).toEqual({ params: { from: '2026-01-01' }, optional: true });
  });

  it('works without a config', () => {
    expect(optionalRequest()).toEqual({ optional: true });
  });
});
