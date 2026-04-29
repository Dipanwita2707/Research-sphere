# Bug Report System Integration Tests

This directory contains integration and end-to-end tests for the Bug Report System.

## Test Structure

```
__tests__/
├── integration/
│   └── database.integration.test.js    # Database integration tests
├── e2e/
│   └── bugReport.e2e.test.js          # End-to-end API tests
└── README.md                           # This file
```

## Test Types

### Database Integration Tests (`integration/database.integration.test.js`)

Tests database operations directly using Prisma Client:

- **Bug Report Creation and Retrieval**
  - Create bug reports with all required fields
  - Retrieve bug reports by ID
  - Filter bug reports by status
  - Update resolution status with timestamp and admin tracking

- **Screenshot Association**
  - Create bug reports with multiple screenshots
  - Retrieve bug reports with screenshot metadata
  - Query screenshots by ID

- **Cascade Delete Behavior**
  - Verify screenshots are deleted when bug report is deleted

- **Index Performance**
  - Test query performance with indexes on userId, resolutionStatus, createdAt
  - Verify multi-filter queries perform efficiently

- **Data Integrity**
  - Enforce required fields
  - Enforce foreign key constraints
  - Default values (resolutionStatus = 'unresolved')

**Validates Requirements:** 6.1-6.13, 10.1-10.14, 17.1-17.8, 19.1-19.11

### End-to-End Tests (`e2e/bugReport.e2e.test.js`)

Tests complete user flows through the API:

- **User Bug Report Submission**
  - Submit bug report without screenshots
  - Submit bug report with multiple screenshots

- **Admin Dashboard Operations**
  - View bug report list with filters
  - Search for specific bug reports
  - Mark bug report as resolved
  - Mark resolved bug report as unresolved
  - View bug report details with screenshots

- **Screenshot Operations**
  - Retrieve screenshot metadata
  - Download screenshot files

- **Error Handling**
  - Reject invalid description length
  - Reject too many screenshots
  - Reject non-admin access to admin endpoints

**Validates Requirements:** All requirements

## Prerequisites

### Database Integration Tests

1. **PostgreSQL Database**: A test database must be available
2. **Test Data**: At least one student user and one admin user must exist
3. **Environment Variables**: Configure `.env` file with test database connection

### End-to-End Tests

1. **Backend Server**: The backend server must be running
2. **Test Database**: A test database with seed data
3. **Authentication**: Test user credentials (optional, tests will skip if not available)

## Running the Tests

### Run All Tests

```bash
npm test
```

### Run Database Integration Tests Only

```bash
npm test -- integration/database.integration.test.js
```

### Run E2E Tests Only

```bash
npm test -- e2e/bugReport.e2e.test.js
```

### Run with Coverage

```bash
npm test -- --coverage
```

## Environment Configuration

### Database Integration Tests

Create a `.env.test` file or configure your `.env` file:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/sgt_ums_test"
```

### End-to-End Tests

Configure test API URL and credentials:

```env
TEST_API_URL="http://localhost:5000"
TEST_STUDENT_UID="TEST_STUDENT_001"
TEST_ADMIN_UID="TEST_ADMIN_001"
```

## Test Data Setup

### Creating Test Users

Run the following SQL to create test users:

```sql
-- Create test student
INSERT INTO user_login (id, uid, email, role, password_hash)
VALUES (
  gen_random_uuid(),
  'TEST_STUDENT_001',
  'test.student@example.com',
  'student',
  '$2a$10$...' -- bcrypt hash of 'password'
);

-- Create test admin
INSERT INTO user_login (id, uid, email, role, password_hash)
VALUES (
  gen_random_uuid(),
  'TEST_ADMIN_001',
  'test.admin@example.com',
  'admin',
  '$2a$10$...' -- bcrypt hash of 'password'
);
```

## Test Cleanup

Both test suites include cleanup logic:

- **Database Integration Tests**: Deletes all bug reports with `[TEST]` in description
- **E2E Tests**: Deletes created bug reports using admin API

## Continuous Integration

### GitHub Actions Example

```yaml
name: Bug Report Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: sgt_ums_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run Prisma migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/sgt_ums_test
      
      - name: Run integration tests
        run: npm test -- integration/
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/sgt_ums_test
      
      - name: Start backend server
        run: npm start &
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/sgt_ums_test
      
      - name: Wait for server
        run: npx wait-on http://localhost:5000/health
      
      - name: Run E2E tests
        run: npm test -- e2e/
        env:
          TEST_API_URL: http://localhost:5000
```

## Troubleshooting

### Database Connection Issues

If tests fail with database connection errors:

1. Verify PostgreSQL is running
2. Check DATABASE_URL in `.env`
3. Ensure test database exists
4. Run migrations: `npx prisma migrate deploy`

### E2E Test Authentication Failures

If E2E tests skip with authentication errors:

1. Ensure backend server is running
2. Verify test user credentials exist
3. Check JWT_SECRET is configured
4. Generate test tokens manually if needed

### Performance Test Failures

If index performance tests fail:

1. Verify database indexes exist: `npx prisma db push`
2. Check database has sufficient test data
3. Adjust performance thresholds if running on slower hardware

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always clean up test data in `afterAll` or `afterEach` hooks
3. **Descriptive Names**: Use clear, descriptive test names
4. **Error Messages**: Include helpful error messages for debugging
5. **Test Data**: Use `[TEST]` prefix in test data for easy identification

## Contributing

When adding new tests:

1. Follow existing test structure and naming conventions
2. Add appropriate cleanup logic
3. Update this README with new test descriptions
4. Ensure tests pass locally before committing
5. Add requirements validation comments

## Related Documentation

- [Bug Report System Requirements](../../../.kiro/specs/bug-report-system/requirements.md)
- [Bug Report System Design](../../../.kiro/specs/bug-report-system/design.md)
- [Bug Report System Tasks](../../../.kiro/specs/bug-report-system/tasks.md)
