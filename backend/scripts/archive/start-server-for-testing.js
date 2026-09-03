/**
 * Start Backend Server for Testing
 * 
 * This script starts the backend server in development mode for endpoint testing.
 * 
 * Usage:
 *   node scripts/start-server-for-testing.js
 * 
 * Prerequisites:
 *   - Database must be running (PostgreSQL on port 5432)
 *   - Environment variables must be configured
 */

const { spawn } = require('child_process');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

console.log(`${colors.blue}========================================${colors.reset}`);
console.log(`${colors.blue}Starting Backend Server for Testing${colors.reset}`);
console.log(`${colors.blue}========================================${colors.reset}\n`);

// Set environment variables for testing
process.env.NODE_ENV = 'development';
process.env.PORT = '5001';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-endpoint-testing';
process.env.JWT_EXPIRE = '7d';
process.env.FRONTEND_URL = 'http://localhost:3000';

// Check if .env file exists
const fs = require('fs');
const envPath = path.join(__dirname, '..', '.env');

if (fs.existsSync(envPath)) {
  console.log(`${colors.green}✓${colors.reset} Found .env file`);
} else {
  console.log(`${colors.yellow}⚠${colors.reset} No .env file found. Using default environment variables.`);
}

console.log(`${colors.cyan}Server will start on: http://localhost:5001${colors.reset}`);
console.log(`${colors.cyan}Environment: ${process.env.NODE_ENV}${colors.reset}\n`);

// Start the server
console.log(`${colors.yellow}Starting server...${colors.reset}\n`);

const serverProcess = spawn('node', ['src/server.js'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  env: process.env
});

// Handle process events
serverProcess.on('error', (error) => {
  console.error(`${colors.red}Failed to start server:${colors.reset}`, error);
  process.exit(1);
});

serverProcess.on('close', (code) => {
  if (code !== 0) {
    console.log(`${colors.red}Server process exited with code ${code}${colors.reset}`);
  } else {
    console.log(`${colors.green}Server stopped gracefully${colors.reset}`);
  }
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}Shutting down server...${colors.reset}`);
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log(`\n${colors.yellow}Shutting down server...${colors.reset}`);
  serverProcess.kill('SIGTERM');
});

console.log(`${colors.green}Server is starting...${colors.reset}`);
console.log(`${colors.cyan}Press Ctrl+C to stop the server${colors.reset}\n`);