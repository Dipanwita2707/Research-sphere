/**
 * Jest configuration for the backend.
 *
 *   npm test                                        # unit / structural tests (no database)
 *   RUN_DB_TESTS=1 npx jest src/shared/tenancy      # opt-in DB tests (run in a rolled-back transaction)
 *
 * Suites under __tests__/integration and __tests__/e2e talk to a real database
 * and/or a running server, so they only run when RUN_DB_TESTS=1.
 */
const runDbTests = process.env.RUN_DB_TESTS === '1';

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/scripts/',
    ...(runDbTests ? [] : ['/__tests__/integration/', '/__tests__/e2e/']),
  ],
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  setupFiles: ['<rootDir>/jest.setup.js'],
};
