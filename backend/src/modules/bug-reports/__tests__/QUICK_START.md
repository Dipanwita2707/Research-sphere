# Quick Start Guide - Bug Report Integration Tests

## TL;DR

```bash
# Run database integration tests
npm test -- integration/database.integration.test.js

# Run E2E tests (requires server running)
npm start &  # Start server in background
npm test -- e2e/bugReport.e2e.test.js
```

## Prerequisites Checklist

- [ ] PostgreSQL running
- [ ] Test database exists
- [ ] Migrations applied (`npx prisma migrate deploy`)
- [ ] Test users created (student + admin)
- [ ] `.env` file configured

## Quick Setup

### 1. Database Setup (One-time)

```bash
# Create test database
createdb sgt_ums_test

# Configure .env
echo 'DATABASE_URL="postgresql://user:password@localhost:5432/sgt_ums_test"' >> .env

# Run migrations
npx prisma migrate deploy

# Create test users (run SQL below)
```

```sql
-- Create test student
INSERT INTO user_login (id, uid, email, role, password_hash)
VALUES (gen_random_uuid(), 'TEST_STUDENT_001', 'test.student@example.com', 'student', '$2a$10$test');

-- Create test admin
INSERT INTO user_login (id, uid, email, role, password_hash)
VALUES (gen_random_uuid(), 'TEST_ADMIN_001', 'test.admin@example.com', 'admin', '$2a$10$test');
```

### 2. Run Tests

```bash
# Database integration tests (no server needed)
npm test -- integration/database.integration.test.js

# E2E tests (server required)
npm start &
sleep 5  # Wait for server to start
npm test -- e2e/bugReport.e2e.test.js
```

## Test Files

```
__tests__/
├── integration/
│   └── database.integration.test.js  ← 15 tests, ~20s
├── e2e/
│   └── bugReport.e2e.test.js        ← 12 tests, ~30s
├── README.md                         ← Full documentation
├── TEST_SUMMARY.md                   ← Coverage summary
└── QUICK_START.md                    ← This file
```

## Common Issues

### "Cannot connect to database"
```bash
# Check PostgreSQL is running
pg_isready

# Check DATABASE_URL
echo $DATABASE_URL
```

### "Test users not found"
```bash
# Run the SQL above to create test users
psql sgt_ums_test < create_test_users.sql
```

### "ECONNREFUSED" (E2E tests)
```bash
# Start the server first
npm start
```

### Performance tests failing
- Tests adjusted for test environment
- Should pass with thresholds: 1000ms (single query), 1500ms (multi-filter)

## What Gets Tested

### Database Integration (15 tests)
✅ Create/read/update bug reports  
✅ Screenshot associations  
✅ Cascade deletes  
✅ Index performance  
✅ Data integrity  

### E2E Tests (12 tests)
✅ Submit bug reports (with/without screenshots)  
✅ Admin dashboard (list, filter, search)  
✅ Resolution status updates  
✅ Screenshot operations  
✅ Error handling  

## Expected Results

```
✓ Database Integration: 15 passed (18-20s)
✓ E2E Tests: 12 passed (30-40s)
```

## Need Help?

1. Check `README.md` for detailed documentation
2. Check `e2e/setup.md` for E2E-specific setup
3. Check `TEST_SUMMARY.md` for coverage details

## CI/CD

```yaml
# .github/workflows/test.yml
- run: npm test -- integration/
- run: npm start &
- run: npx wait-on http://localhost:5000
- run: npm test -- e2e/
```

---

**Quick Links**:
- [Full Documentation](./README.md)
- [E2E Setup Guide](./e2e/setup.md)
- [Test Summary](./TEST_SUMMARY.md)
