# E2E Test Setup Guide

## Prerequisites

Before running E2E tests, ensure the following:

### 1. Backend Server Running

Start the backend server in a separate terminal:

```bash
cd Sgt-Ums/backend
npm run dev
```

The server should be running at `http://localhost:5000` (or your configured port).

### 2. Test Database

Ensure you have a test database with:
- Proper schema (run migrations)
- Test users (at least one student and one admin)

### 3. Environment Variables

Create or update `.env` file:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/sgt_ums_test"

# JWT
JWT_SECRET="your-test-jwt-secret"

# Server
PORT=5000

# Test Configuration (optional)
TEST_API_URL="http://localhost:5000"
TEST_STUDENT_UID="TEST_STUDENT_001"
TEST_ADMIN_UID="TEST_ADMIN_001"
```

## Running E2E Tests

### Option 1: Run with npm test

```bash
npm test -- e2e/bugReport.e2e.test.js
```

### Option 2: Run with jest directly

```bash
npx jest src/modules/bug-reports/__tests__/e2e/bugReport.e2e.test.js
```

### Option 3: Run in watch mode

```bash
npm test -- --watch e2e/bugReport.e2e.test.js
```

## Test Behavior

The E2E tests are designed to be resilient:

1. **Authentication Handling**: If authentication is not configured, tests will skip validation and log a message
2. **Cleanup**: Tests clean up created data in `afterAll` hooks
3. **Error Tolerance**: Tests handle various error scenarios gracefully

## Expected Output

### With Authentication Configured

```
PASS  src/modules/bug-reports/__tests__/e2e/bugReport.e2e.test.js
  Bug Report System E2E Tests
    User Bug Report Submission
      ✓ User submits bug report without screenshots (234ms)
      ✓ User submits bug report with multiple screenshots (456ms)
    Admin Dashboard Operations
      ✓ Admin views bug report list with filters (123ms)
      ✓ Admin searches for specific bug report (145ms)
      ✓ Admin marks bug report as resolved (178ms)
      ✓ Admin marks resolved bug report as unresolved (189ms)
      ✓ Admin views bug report details with screenshots (134ms)
    Screenshot Operations
      ✓ Retrieve screenshot metadata (112ms)
      ✓ Download screenshot file (156ms)
    Error Handling
      ✓ Reject bug report with invalid description length (89ms)
      ✓ Reject bug report with too many screenshots (234ms)
      ✓ Reject non-admin access to admin endpoints (67ms)

Test Suites: 1 passed, 1 total
Tests:       12 passed, 12 total
```

### Without Authentication Configured

Tests will skip validation and show messages like:

```
console.log
  Authentication required - skipping test validation
```

## Troubleshooting

### Server Not Running

**Error**: `ECONNREFUSED`

**Solution**: Start the backend server:
```bash
npm run dev
```

### Database Connection Issues

**Error**: Database connection errors

**Solution**: 
1. Check DATABASE_URL in `.env`
2. Ensure PostgreSQL is running
3. Run migrations: `npx prisma migrate deploy`

### Authentication Failures

**Error**: 401 Unauthorized

**Solution**:
1. Create test users in database
2. Generate JWT tokens for test users
3. Set tokens in test configuration

### Port Already in Use

**Error**: `EADDRINUSE`

**Solution**:
1. Stop other processes using port 5000
2. Or change PORT in `.env` and TEST_API_URL

## Creating Test Users

Run this SQL to create test users:

```sql
-- Create test student
INSERT INTO user_login (id, uid, email, role, password_hash)
VALUES (
  gen_random_uuid(),
  'TEST_STUDENT_001',
  'test.student@example.com',
  'student',
  '$2a$10$YourBcryptHashHere'
);

-- Create test admin
INSERT INTO user_login (id, uid, email, role, password_hash)
VALUES (
  gen_random_uuid(),
  'TEST_ADMIN_001',
  'test.admin@example.com',
  'admin',
  '$2a$10$YourBcryptHashHere'
);
```

## Generating Test Tokens

You can generate JWT tokens using Node.js:

```javascript
const jwt = require('jsonwebtoken');

const studentToken = jwt.sign(
  { id: 'student-user-id', role: 'student' },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);

const adminToken = jwt.sign(
  { id: 'admin-user-id', role: 'admin' },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);

console.log('Student Token:', studentToken);
console.log('Admin Token:', adminToken);
```

## CI/CD Integration

For automated testing in CI/CD pipelines:

1. Set up test database in CI environment
2. Run migrations before tests
3. Start backend server in background
4. Run E2E tests
5. Stop server and clean up

Example GitHub Actions workflow:

```yaml
- name: Start backend server
  run: npm start &
  working-directory: Sgt-Ums/backend
  env:
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
    JWT_SECRET: ${{ secrets.TEST_JWT_SECRET }}

- name: Wait for server
  run: npx wait-on http://localhost:5000/health

- name: Run E2E tests
  run: npm test -- e2e/
  working-directory: Sgt-Ums/backend
  env:
    TEST_API_URL: http://localhost:5000
```

## Notes

- E2E tests create real data in the database
- Tests include cleanup logic but may leave data if interrupted
- Use a separate test database, not production
- Tests are designed to be idempotent where possible
