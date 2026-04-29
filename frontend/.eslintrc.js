module.exports = {
  extends: ['next/core-web-vitals'],
  rules: {
    // Error on console.log in production code (allow console.warn, console.error for debugging)
    'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
    
    // Prevent direct axios imports outside lib/api.ts
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'axios',
            message: 'Please use @/lib/api instead of importing axios directly.',
          },
        ],
        patterns: [
          {
            group: ['axios/*'],
            message: 'Please use @/lib/api instead of importing axios directly.',
          },
        ],
      },
    ],
    
    // Prefer const over let
    'prefer-const': 'warn',
  },
  overrides: [
    // Allow axios import in lib/api.ts
    {
      files: ['src/lib/api.ts'],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
    // Allow console.log in development scripts, tests, and utilities
    {
      files: [
        'scripts/**/*', 
        'src/utils/**/*', 
        '**/*.test.{js,ts,tsx}',
        '**/*.spec.{js,ts,tsx}',
        '**/logger.ts'
      ],
      rules: {
        'no-console': 'off',
      },
    },
  ],
}
