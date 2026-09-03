# Bug Report System - Endpoint Testing Guide

This guide explains how to test all Bug Report System endpoints to verify they are working correctly.

## Overview

The endpoint testing suite includes:
- **18 comprehensive tests** covering all bug report functionality
- **Automatic authentication** using provided credentials
- **Real API calls** with actual data validation
- **Screenshot upload/download testing**
- **Admin dashboard functionality verification**
- **Security and validation testing**

## Prerequisites

### 1. Backend Server Running

The backend server must be running on `http://localhost:5001` before running tests.

### 2. Database Access

The server must have access to a PostgreSQL database with the bug report tables created.

### 3. Test Credentials

The tests use these specific credentials:
- **Admin**: `admin` / `admin123`
- **Finance User**: `1234567` / `1234567`

## Quick Start

### Option 1: Automated Test Runner (Recommended)

**Windows (PowerShell):**
```powershell
cd Sgt-Ums/backend
./scripts/run-endpoint-tests.ps1
```

**Windows (Command Prompt):**
```cmd
cd Sgt-Ums\backend
scripts\run-endpoint-tests.bat
```

### Option 2: Manual Testing

1. **Start the backend server:**
   ```bash
   cd Sgt-Ums/backend
   npm run dev
   ```

2. **Run the tests (in a new terminal):**
   ```bash
   cd Sgt-Ums/backend
   node scripts/test-bug-report-endpoints-with-auth.js
   ```

## Server Startup Options

### Method 1: Direct Node.js (Development)
```bash
cd Sgt-Ums/backend
npm install
npm run dev
```
- Server runs on: `http://localhost:5001`
- Uses local database configuration
- Hot reload enabled

### Method 2: Docker Development
```bash
cd Sgt-Ums
docker-compose -f docker-compose.dev.yml up backend-dev
```
- Server runs on: `http://localhost:5001`
- Includes database and Redis
- Development environment

### Method 3: Docker Production
```bash
cd Sgt-Ums
docker-compose up backend
```
- Server runs on: `http://localhost:5001`
- Production configuration
- Includes all services

## Test Categories

### 1. Authentication Tests (2 tests)
- ✅ Admin login with credentials
- ✅ Finance user login with credentials

### 2. Bug Report Submission Tests (2 tests)
- ✅ Submit bug report without screenshots
- ✅ Submit bug report with multiple screenshots

### 3. Validation Tests (3 tests)
- ✅ Empty description validation
- ✅ Short description validation (< 10 characters)
- ✅ Long description validation (> 2000 characters)

### 4. Security Tests (2 tests)
- ✅ No authentication token rejection
- ✅ Non-admin access to admin endpoints blocked

### 5. Admin Dashboard Tests (3 tests)
- ✅ Get all bug reports with pagination
- ✅ Filter bug reports by status
- ✅ Search bug reports by keywords

### 6. Bug Report Management Tests (3 tests)
- ✅ Get bug report details by ID
- ✅ Update resolution status to resolved
- ✅ Update resolution status to unresolved

### 7. Screenshot Tests (2 tests)
- ✅ Get screenshot metadata
- ✅ Download screenshot files

### 8. System Tests (1 test)
- ✅ Health check endpoint

## Expected Results

### Success Criteria
- **All 18 tests pass** (100% success rate)
- **No authentication errors** with provided credentials
- **Screenshot upload/download works** correctly
- **Admin dashboard functions** properly
- **Validation rules enforced** correctly

### Sample Output
```
========================================
Bug Report System - Endpoint Testing
with Automatic Authentication
========================================

Base URL: http://localhost:5001
Admin Credentials: admin/admin123
Finance User Credentials: 1234567/1234567

Running tests...

--- Authentication Tests ---
✓ Admin Login (245ms)
✓ Finance User Login (198ms)

--- Bug Report Submission Tests ---
✓ Submit Bug Report (No Screenshots) (156ms)
✓ Submit Bug Report (With Screenshots) (423ms)

--- Validation Tests ---
✓ Validation - Empty Description (89ms)
✓ Validation - Short Description (76ms)
✓ Validation - Long Description (82ms)

--- Security Tests ---
✓ Authentication - No Token (45ms)
✓ Admin Access Control - Non-Admin (67ms)

--- Admin Dashboard Tests ---
✓ Get All Bug Reports (Admin) (134ms)
✓ Get Bug Reports with Filters (Admin) (98ms)
✓ Search Bug Reports (Admin) (87ms)

--- Bug Report Management Tests ---
✓ Get Bug Report by ID (Admin) (76ms)
✓ Update Status to Resolved (Admin) (123ms)
✓ Update Status to Unresolved (Admin) (98ms)

--- Screenshot Tests ---
✓ Get Screenshot Metadata (65ms)
✓ Download Screenshot (234ms)

========================================
Test Summary
========================================

Total Tests: 18
Passed: 18
Failed: 0
Total Duration: 2456ms

Success Rate: 100.0% - Excellent!

🎉 All tests passed! Bug Report System endpoints are working perfectly.

Results saved to: bug-report-endpoint-test-results.json
```

## Test Results File

After each test run, detailed results are saved to:
```
Sgt-Ums/backend/scripts/bug-report-endpoint-test-results.json
```

This file contains:
- Timestamp of test execution
- Individual test results with timing
- Success/failure details
- Error messages for failed tests
- Overall statistics

## Troubleshooting

### Common Issues

#### 1. Server Not Running
**Error:** `Backend server is not responding`
**Solution:** Start the backend server using one of the methods above

#### 2. Authentication Failed
**Error:** `Admin Login failed` or `Finance User Login failed`
**Solution:** 
- Verify credentials are correct in the database
- Check if users exist and are active
- Ensure JWT_SECRET is configured

#### 3. Database Connection Error
**Error:** `Database connection failed`
**Solution:**
- Ensure PostgreSQL is running
- Check DATABASE_URL in .env file
- Run database migrations if needed

#### 4. Port Already in Use
**Error:** `EADDRINUSE: address already in use :::5001`
**Solution:**
- Stop any existing server on port 5001
- Or change PORT in environment variables

#### 5. Missing Dependencies
**Error:** `Cannot find module 'axios'`
**Solution:**
```bash
cd Sgt-Ums/backend
npm install
```

### Debug Mode

To run tests with more detailed output:
```bash
DEBUG=1 node scripts/test-bug-report-endpoints-with-auth.js
```

### Custom Configuration

You can override the default settings:
```bash
# Custom API URL
API_URL=http://localhost:3001 node scripts/test-bug-report-endpoints-with-auth.js

# Custom timeout
TIMEOUT=10000 node scripts/test-bug-report-endpoints-with-auth.js
```

## API Endpoints Tested

### Public Endpoints
- `GET /health` - Health check
- `POST /api/auth/login` - User authentication
- `POST /api/bug-reports` - Submit bug report
- `GET /api/bug-reports/:id/screenshots` - Get screenshot metadata
- `GET /api/bug-reports/screenshots/:screenshotId` - Download screenshot

### Admin Endpoints
- `GET /api/admin/bug-reports` - List all bug reports
- `GET /api/admin/bug-reports?status=unresolved` - Filter by status
- `GET /api/admin/bug-reports?search=keyword` - Search bug reports
- `GET /api/admin/bug-reports/:id` - Get bug report details
- `PATCH /api/admin/bug-reports/:id/status` - Update resolution status

## Security Testing

The test suite verifies:
- ✅ Authentication required for all endpoints
- ✅ Admin-only endpoints reject non-admin users
- ✅ Input validation on all fields
- ✅ File upload security (type, size limits)
- ✅ SQL injection prevention
- ✅ XSS prevention in descriptions

## Performance Benchmarks

Expected response times:
- Authentication: < 300ms
- Bug report submission: < 500ms
- Admin dashboard: < 200ms
- Screenshot upload: < 1000ms
- Database queries: < 100ms

## Next Steps

After successful endpoint testing:

1. **Integration Testing**: Test with frontend application
2. **Load Testing**: Test with multiple concurrent users
3. **Security Audit**: Run security scanning tools
4. **User Acceptance Testing**: Test with real users
5. **Production Deployment**: Deploy to production environment

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review the test results JSON file for detailed error information
3. Check server logs for backend errors
4. Verify database connectivity and schema
5. Contact the development team with specific error messages

---

**Last Updated:** 2024  
**Version:** 1.0  
**Status:** Production Ready