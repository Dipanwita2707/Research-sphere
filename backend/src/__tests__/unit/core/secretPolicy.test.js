/**
 * Production must refuse to start with a missing, short or placeholder JWT_SECRET
 * (e.g. the old docker-compose default).
 */
const { isPlaceholderSecret, assertProductionSecret } = require('../../../shared/config/secretPolicy');

const RANDOM = 'b3f1c9e07a5d4e2f8c6b1a0d9e8f7c6b5a4d3e2f1c0b9a8d7e6f5c4b3a2d1e0f';

describe('isPlaceholderSecret', () => {
  it.each([
    'your-super-secret-jwt-key-change-this-in-production',
    'change-me-to-a-long-random-string-at-least-32-chars',
    'change-this-to-a-long-random-string',
    'CHANGEME-CHANGEME-CHANGEME-CHANGEME',
    'development-jwt-secret-key-xxxxxxxxxxxx',
    'example-example-example-example-example',
    'dev-only-insecure-secret-do-not-use-in-production',
  ])('flags %s', (value) => {
    expect(isPlaceholderSecret(value)).toBe(true);
  });

  it('accepts a random secret', () => {
    expect(isPlaceholderSecret(RANDOM)).toBe(false);
  });
});

describe('assertProductionSecret', () => {
  it('throws for missing, short and placeholder values', () => {
    expect(() => assertProductionSecret('JWT_SECRET', undefined)).toThrow(/at least 32/);
    expect(() => assertProductionSecret('JWT_SECRET', 'short')).toThrow(/at least 32/);
    expect(() => assertProductionSecret('JWT_SECRET', 'your-super-secret-jwt-key-change-this-in-production')).toThrow(/placeholder/);
    expect(() => assertProductionSecret('JWT_SECRET', RANDOM)).not.toThrow();
  });
});

describe('app.config startup', () => {
  const load = (env) => {
    const saved = { NODE_ENV: process.env.NODE_ENV, JWT_SECRET: process.env.JWT_SECRET };
    Object.assign(process.env, env);
    try {
      let config;
      jest.isolateModules(() => { config = require('../../../shared/config/app.config'); });
      return config;
    } finally {
      process.env.NODE_ENV = saved.NODE_ENV;
      if (saved.JWT_SECRET === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = saved.JWT_SECRET;
    }
  };

  it('refuses to start in production with the old compose default secret', () => {
    expect(() => load({ NODE_ENV: 'production', JWT_SECRET: 'your-super-secret-jwt-key-change-this-in-production' }))
      .toThrow(/placeholder/);
  });

  it('starts in production with a random secret', () => {
    expect(load({ NODE_ENV: 'production', JWT_SECRET: RANDOM }).jwt.secret).toBe(RANDOM);
  });
});
