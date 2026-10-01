import coreWebVitals from 'eslint-config-next/core-web-vitals';

/** ESLint 9 flat config (replaces .eslintrc.js; `next lint` was removed in Next 16, run `npm run lint`). */
const config = [
  ...coreWebVitals,
  {
    rules: {
      // Error on console.log in production code (allow console.warn, console.error for debugging)
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],

      // Prevent direct axios imports outside the shared API client
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'axios',
              message: 'Please use @/shared/api/api instead of importing axios directly.',
            },
          ],
          patterns: [
            {
              group: ['axios/*'],
              message: 'Please use @/shared/api/api instead of importing axios directly.',
            },
          ],
        },
      ],

      // Prefer const over let
      'prefer-const': 'warn',
    },
  },
  // React Compiler-era rules added in eslint-plugin-react-hooks v6/v7. They flag patterns the old
  // toolchain never checked (hundreds of existing sites), so they are warnings: a migration backlog,
  // not build blockers. Promote to 'error' once the backlog is cleared.
  {
    rules: {
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
  // The shared API client is the one place allowed to import axios
  {
    files: ['src/lib/api.ts', 'src/shared/api/api.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  // Allow console.log in development scripts, tests, and utilities
  {
    files: ['scripts/**/*', 'src/utils/**/*', '**/*.test.{js,ts,tsx}', '**/*.spec.{js,ts,tsx}', '**/logger.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    ignores: ['.next/**', 'coverage/**', 'node_modules/**', 'next-env.d.ts', '*.js'],
  },
];

export default config;
