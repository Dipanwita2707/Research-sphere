module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    // Error on console.log in production code (allow console.warn, console.error for debugging)
    'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
    
    // Prefer const over let
    'prefer-const': 'warn',
    
    // Require semicolons
    'semi': ['error', 'always'],
    
    // Consistent quotes
    'quotes': ['warn', 'single', { avoidEscape: true }],
    
    // No unused variables
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
  overrides: [
    // Allow console.log in development scripts, tests, and specific utility files
    {
      files: [
        'scripts/**/*',
        '**/*.test.js',
        '**/*.spec.js',
        '**/logger.js',
        '**/securityLogger.js',
        '**/auditLogger.js',
        'src/shared/utils/**/*',
        'src/modules/*/utils/**/*'
      ],
      rules: {
        'no-console': 'off',
      },
    },
  ],
};