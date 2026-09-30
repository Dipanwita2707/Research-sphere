// Runs before every test file: force the test environment so config/database.js,
// the logger and background jobs never assume development or production.
process.env.NODE_ENV = 'test';
