/**
 * Bug Report System - Endpoint Testing Script
 * 
 * This script tests all bug report endpoints to verify they are working correctly.
 * 
 * Usage:
 *   ADMIN_TOKEN=your_admin_token USER_TOKEN=your_user_token node scripts/test-bug-report-endpoints.js
 * 
 * Prerequisites:
 *   - Backend server must be running
 *   - Valid admin and user JWT tokens
 *   - Database must be accessible
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:5000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const USER_TOKEN = process.env.USER_TOKEN;

// Test results tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Helper function to log test results
function logTest(name, passed, message = '', duration = 0) {
  results.total++;
  if (passed) {
    results.passed++;
    console.log(`${colors.green}✓${colors.reset} ${name} ${colors.cyan}(${duration}ms)${colors.reset}`);
  } else {
    results.failed++;
    console.log(`${colors.red}✗${colors.reset} ${name}`);
    if (message) {
      console.log(`  ${colors.red}Error: ${message}${colors.reset}`);
    }
  }
  results.tests.push({ name, passed, message, duration });
}

// Helper function to create test screenshot
function createTestScreenshot(filename, sizeKB = 100) {
  const buffer = Buffer.alloc(sizeKB * 1024, 'test data');
  const filepath = path.join(__dirname, filename);
  fs.writeFileSync(filepath, buffer);
  return filepath;
}

// Helper function to cleanup test files
function cleanupTestFiles(files) {
  files.forEach(file => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });
}

// Test 1: Health Check
async function testHealthCheck() {
  const startTime = Date.now();
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    const duration = Date.now() - startTime;
    
    if (response.status === 200 && response.data.status === 'ok') {
      logTest('Health Check', true, '', duration);
      return true;
    } else {
      logTest('Health Check', false, 'Unexpected response format');
      return false;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logTest('Health Check', false, error.message, duration);
    return false;
  }
}

// Test 2: Submit Bug Report Without Screenshots (User)
async function testSubmitBugReportWithoutScreenshots() {
  const startTime = Date.now();
  try {
    const response = await axios.post(
      `${BASE_URL}/api/bug-reports`,
      {
        description: 'Test bug report - submit button not working on user form',
        pageUrl: 'http://localhost:3000/dashboard',
        routePath: '/dashboard',
        userIdentifier: 'TEST001',
        userRole: 'student',
        userEmail: 'test@example.com'
      },
      {
        headers: {
          'Authorization': `Bearer ${USER_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const duration = Date.now() - startTime;
    
    if (response.status === 201 && response.data.success && response.data.data.id) {
      logTest('Submit Bug Report (No Screenshots)', true, '', duration);
      return response.data.data.id;
    } else {
      logTest('Submit Bug Report (No Screenshots)', false, 'Unexpected response format');
      return null;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logTest('Submit Bug Report (No Screenshots)', false, error.response?.data?.message || error.message, duration);
    return null;
  }
}

// Test 3: Submit Bug Report With Screenshots (User)
async function testSubmitBugReportWithScreenshots() {
  const startTime = Date.now();
  const testFiles = [];
  
  try {
    // Create test screenshot files
    const screenshot1 = createTestScreenshot('test-screenshot-1.png', 100);
    const screenshot2 = createTestScreenshot('test-screenshot-2.jpg', 200);
    testFiles.push(screenshot1, screenshot2);
    
    const formData = new FormData();
    formData.append('description', 'Test bug report with screenshots - form validation error');
    formData.append('pageUrl', 'http://localhost:3000/admin/users');
    formData.append('routePath', '/admin/users');
    formData.append('userIdentifier', 'EMP001');
    formData.append('userRole', 'admin');
    formData.append('userEmail', 'admin@example.com');
    formData.append('screenshots', fs.createReadStream(screenshot1));
    formData.append('screenshots', fs.createReadStream(screenshot2));
    
    const response = await axios.post(
      `${BASE_URL}/api/bug-reports`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${USER_TOKEN}`,
          ...formData.getHeaders()
        }
      }
    );
    
    const duration = Date.now() - startTime;
    cleanupTestFiles(testFiles);
    
    if (response.status === 201 && 
        response.data.success && 
        response.data.data.id &&
        response.data.data.screenshots.length === 2) {
      logTest('Submit Bug Report (With Screenshots)', true, '', duration);
      return response.data.data.id;
    } else {
      logTest('Submit Bug Report (With Screenshots)', false, 'Unexpected response format or screenshot count');
      return null;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    cleanupTestFiles(testFiles);
    logTest('Submit Bug Report (With Screenshots)', false, error.response?.data?.message || error.message, duration);
    return null;
  }
}

// Test 4: Validation - Empty Description
async function testValidationEmptyDescription() {
  const startTime = Date.now();
  try {
    const response = await axios.post(
      `${BASE_URL}/api/bug-reports`,
      {
        description: '',
        pageUrl: 'http://localhost:3000/test',
        routePath: '/test',
        userIdentifier: 'TEST001',
        userRole: 'student'
      },
      {
        headers: {
          'Authorization': `Bearer ${USER_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const duration = Date.now() - startTime;
    logTest('Validation - Empty Description', false, 'Should have returned 400 error');
    return false;
  } catch (error) {
    const duration = Date.now() - startTime;
    if (error.response?.status === 400) {
      logTest('Validation - Empty Description', true, '', duration);
      return true;
    } else {
      logTest('Validation - Empty Description', false, `Expected 400, got ${error.response?.status}`);
      return false;
    }
  }
}

// Test 5: Validation - Short Description
async function testValidationShortDescription() {
  const startTime = Date.now();
  try {
    const response = await axios.post(
      `${BASE_URL}/api/bug-reports`,
      {
        description: 'short',
        pageUrl: 'http://localhost:3000/test',
        routePath: '/test',
        userIdentifier: 'TEST001',
        userRole: 'student'
      },
      {
        headers: {
          'Authorization': `Bearer ${USER_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const duration = Date.now() - startTime;
    logTest('Validation - Short Description', false, 'Should have returned 400 error');
    return false;
  } catch (error) {
    const duration = Date.now() - startTime;
    if (error.response?.status === 400) {
      logTest('Validation - Short Description', true, '', duration);
      return true;
    } else {
      logTest('Validation - Short Description', false, `Expected 400, got ${error.response?.status}`);
      return false;
    }
  }
}

// Test 6: Validation - Long Description
async function testValidationLongDescription() {
  const startTime = Date.now();
  try {
    const longDescription = 'a'.repeat(2001);
    const response = await axios.post(
      `${BASE_URL}/api/bug-reports`,
      {
        description: longDescription,
        pageUrl: 'http://localhost:3000/test',
        routePath: '/test',
        userIdentifier: 'TEST001',
        userRole: 'student'
      },
      {
        headers: {
          'Authorization': `Bearer ${USER_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const duration = Date.now() - startTime;
    logTest('Validation - Long Description', false, 'Should have returned 400 error');
    return false;
  } catch (error) {
    const duration = Date.now() - startTime;
    if (error.response?.status === 400) {
      logTest('Validation - Long Description', true, '', duration);
      return true;
    } else {
      logTest('Validation - Long Description', false, `Expected 400, got ${error.response?.status}`);
      return false;
    }
  }
}

// Test 7: Authentication - No Token
async function testAuthenticationNoToken() {
  const startTime = Date.now();
  try {
    const response = await axios.post(
      `${BASE_URL}/api/bug-reports`,
      {
        description: 'Test bug report without authentication',
        pageUrl: 'http://localhost:3000/test',
        routePath: '/test',
        userIdentifier: 'TEST001',
        userRole: 'student'
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    const duration = Date.now() - startTime;
    logTest('Authentication - No Token', false, 'Should have returned 401 error');
    return false;
  } catch (error) {
    const duration = Date.now() - startTime;
    if (error.response?.status === 401) {
      logTest('Authentication - No Token', true, '', duration);
      return true;
    } else {
      logTest('Authentication - No Token', false, `Expected 401, got ${error.response?.status}`);
      return false;
    }
  }
}

// Test 8: Get All Bug Reports (Admin)
async function testGetAllBugReports() {
  const startTime = Date.now();
  try {
    const response = await axios.get(
      `${BASE_URL}/api/admin/bug-reports`,
      {
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`
        }
      }
    );
    
    const duration = Date.now() - startTime;
    
    if (response.status === 200 && 
        response.data.success && 
        Array.isArray(response.data.data.reports) &&
        response.data.data.pagination &&
        response.data.data.counts) {
      logTest('Get All Bug Reports (Admin)', true, '', duration);
      return response.data.data.reports;
    } else {
      logTest('Get All Bug Reports (Admin)', false, 'Unexpected response format');
      return null;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logTest('Get All Bug Reports (Admin)', false, error.response?.data?.message || error.message, duration);
    return null;
  }
}

// Test 9: Get Bug Reports with Filters (Admin)
async function testGetBugReportsWithFilters() {
  const startTime = Date.now();
  try {
    const response = await axios.get(
      `${BASE_URL}/api/admin/bug-reports?status=unresolved&sortBy=createdAt&order=desc&page=1&limit=10`,
      {
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`
        }
      }
    );
    
    const duration = Date.now() - startTime;
    
    if (response.status === 200 && response.data.success) {
      logTest('Get Bug Reports with Filters (Admin)', true, '', duration);
      return true;
    } else {
      logTest('Get Bug Reports with Filters (Admin)', false, 'Unexpected response format');
      return false;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logTest('Get Bug Reports with Filters (Admin)', false, error.response?.data?.message || error.message, duration);
    return false;
  }
}

// Test 10: Search Bug Reports (Admin)
async function testSearchBugReports() {
  const startTime = Date.now();
  try {
    const response = await axios.get(
      `${BASE_URL}/api/admin/bug-reports?search=test`,
      {
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`
        }
      }
    );
    
    const duration = Date.now() - startTime;
    
    if (response.status === 200 && response.data.success) {
      logTest('Search Bug Reports (Admin)', true, '', duration);
      return true;
    } else {
      logTest('Search Bug Reports (Admin)', false, 'Unexpected response format');
      return false;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logTest('Search Bug Reports (Admin)', false, error.response?.data?.message || error.message, duration);
    return false;
  }
}

// Test 11: Get Bug Report by ID (Admin)
async function testGetBugReportById(bugReportId) {
  const startTime = Date.now();
  try {
    const response = await axios.get(
      `${BASE_URL}/api/admin/bug-reports/${bugReportId}`,
      {
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`
        }
      }
    );
    
    const duration = Date.now() - startTime;
    
    if (response.status === 200 && response.data.success && response.data.data.id === bugReportId) {
      logTest('Get Bug Report by ID (Admin)', true, '', duration);
      return response.data.data;
    } else {
      logTest('Get Bug Report by ID (Admin)', false, 'Unexpected response format');
      return null;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logTest('Get Bug Report by ID (Admin)', false, error.response?.data?.message || error.message, duration);
    return null;
  }
}

// Test 12: Update Resolution Status to Resolved (Admin)
async function testUpdateStatusToResolved(bugReportId) {
  const startTime = Date.now();
  try {
    const response = await axios.patch(
      `${BASE_URL}/api/admin/bug-reports/${bugReportId}/status`,
      {
        status: 'resolved'
      },
      {
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const duration = Date.now() - startTime;
    
    if (response.status === 200 && 
        response.data.success && 
        response.data.data.resolutionStatus === 'resolved' &&
        response.data.data.resolvedAt &&
        response.data.data.resolvedBy) {
      logTest('Update Status to Resolved (Admin)', true, '', duration);
      return true;
    } else {
      logTest('Update Status to Resolved (Admin)', false, 'Unexpected response format or missing audit fields');
      return false;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logTest('Update Status to Resolved (Admin)', false, error.response?.data?.message || error.message, duration);
    return false;
  }
}

// Test 13: Update Resolution Status to Unresolved (Admin)
async function testUpdateStatusToUnresolved(bugReportId) {
  const startTime = Date.now();
  try {
    const response = await axios.patch(
      `${BASE_URL}/api/admin/bug-reports/${bugReportId}/status`,
      {
        status: 'unresolved'
      },
      {
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const duration = Date.now() - startTime;
    
    if (response.status === 200 && 
        response.data.success && 
        response.data.data.resolutionStatus === 'unresolved' &&
        response.data.data.resolvedAt === null &&
        response.data.data.resolvedBy === null) {
      logTest('Update Status to Unresolved (Admin)', true, '', duration);
      return true;
    } else {
      logTest('Update Status to Unresolved (Admin)', false, 'Unexpected response format or audit fields not cleared');
      return false;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logTest('Update Status to Unresolved (Admin)', false, error.response?.data?.message || error.message, duration);
    return false;
  }
}

// Test 14: Admin Access Control - Non-Admin User
async function testAdminAccessControlNonAdmin() {
  const startTime = Date.now();
  try {
    const response = await axios.get(
      `${BASE_URL}/api/admin/bug-reports`,
      {
        headers: {
          'Authorization': `Bearer ${USER_TOKEN}`
        }
      }
    );
    
    const duration = Date.now() - startTime;
    logTest('Admin Access Control - Non-Admin', false, 'Should have returned 403 error');
    return false;
  } catch (error) {
    const duration = Date.now() - startTime;
    if (error.response?.status === 403) {
      logTest('Admin Access Control - Non-Admin', true, '', duration);
      return true;
    } else {
      logTest('Admin Access Control - Non-Admin', false, `Expected 403, got ${error.response?.status}`);
      return false;
    }
  }
}

// Test 15: Get Screenshot Metadata
async function testGetScreenshotMetadata(bugReportId) {
  const startTime = Date.now();
  try {
    const response = await axios.get(
      `${BASE_URL}/api/bug-reports/${bugReportId}/screenshots`,
      {
        headers: {
          'Authorization': `Bearer ${USER_TOKEN}`
        }
      }
    );
    
    const duration = Date.now() - startTime;
    
    if (response.status === 200 && response.data.success && Array.isArray(response.data.data.screenshots)) {
      logTest('Get Screenshot Metadata', true, '', duration);
      return response.data.data.screenshots;
    } else {
      logTest('Get Screenshot Metadata', false, 'Unexpected response format');
      return null;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logTest('Get Screenshot Metadata', false, error.response?.data?.message || error.message, duration);
    return null;
  }
}

// Test 16: Download Screenshot
async function testDownloadScreenshot(screenshotId) {
  const startTime = Date.now();
  try {
    const response = await axios.get(
      `${BASE_URL}/api/bug-reports/screenshots/${screenshotId}`,
      {
        headers: {
          'Authorization': `Bearer ${USER_TOKEN}`
        },
        responseType: 'arraybuffer'
      }
    );
    
    const duration = Date.now() - startTime;
    
    if (response.status === 200 && response.data && response.headers['content-type'].startsWith('image/')) {
      logTest('Download Screenshot', true, '', duration);
      return true;
    } else {
      logTest('Download Screenshot', false, 'Unexpected response format or content-type');
      return false;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logTest('Download Screenshot', false, error.response?.data?.message || error.message, duration);
    return false;
  }
}

// Main test execution
async function runTests() {
  console.log(`\n${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}Bug Report System - Endpoint Testing${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);
  
  // Check for required tokens
  if (!ADMIN_TOKEN || !USER_TOKEN) {
    console.log(`${colors.red}Error: Missing required tokens${colors.reset}`);
    console.log(`${colors.yellow}Usage: ADMIN_TOKEN=your_admin_token USER_TOKEN=your_user_token node scripts/test-bug-report-endpoints.js${colors.reset}\n`);
    process.exit(1);
  }
  
  console.log(`${colors.cyan}Base URL: ${BASE_URL}${colors.reset}`);
  console.log(`${colors.cyan}Admin Token: ${ADMIN_TOKEN.substring(0, 20)}...${colors.reset}`);
  console.log(`${colors.cyan}User Token: ${USER_TOKEN.substring(0, 20)}...${colors.reset}\n`);
  
  const startTime = Date.now();
  
  // Run tests
  console.log(`${colors.yellow}Running tests...${colors.reset}\n`);
  
  // Test 1: Health Check
  const healthOk = await testHealthCheck();
  if (!healthOk) {
    console.log(`\n${colors.red}Backend server is not responding. Please start the server and try again.${colors.reset}\n`);
    process.exit(1);
  }
  
  // Test 2-3: Submit bug reports
  const bugReportId1 = await testSubmitBugReportWithoutScreenshots();
  const bugReportId2 = await testSubmitBugReportWithScreenshots();
  
  // Test 4-6: Validation tests
  await testValidationEmptyDescription();
  await testValidationShortDescription();
  await testValidationLongDescription();
  
  // Test 7: Authentication test
  await testAuthenticationNoToken();
  
  // Test 8-10: Admin list, filter, search
  const allReports = await testGetAllBugReports();
  await testGetBugReportsWithFilters();
  await testSearchBugReports();
  
  // Test 11: Get by ID
  let bugReportDetails = null;
  if (bugReportId1) {
    bugReportDetails = await testGetBugReportById(bugReportId1);
  } else if (allReports && allReports.length > 0) {
    bugReportDetails = await testGetBugReportById(allReports[0].id);
  }
  
  // Test 12-13: Status updates
  if (bugReportId1) {
    await testUpdateStatusToResolved(bugReportId1);
    await testUpdateStatusToUnresolved(bugReportId1);
  }
  
  // Test 14: Access control
  await testAdminAccessControlNonAdmin();
  
  // Test 15-16: Screenshot operations
  if (bugReportId2) {
    const screenshots = await testGetScreenshotMetadata(bugReportId2);
    if (screenshots && screenshots.length > 0) {
      await testDownloadScreenshot(screenshots[0].id);
    }
  }
  
  const totalDuration = Date.now() - startTime;
  
  // Print summary
  console.log(`\n${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}Test Summary${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);
  
  console.log(`Total Tests: ${results.total}`);
  console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
  console.log(`Total Duration: ${totalDuration}ms\n`);
  
  // Print failed tests details
  if (results.failed > 0) {
    console.log(`${colors.red}Failed Tests:${colors.reset}`);
    results.tests.filter(t => !t.passed).forEach(test => {
      console.log(`  - ${test.name}: ${test.message}`);
    });
    console.log('');
  }
  
  // Save results to file
  const resultsFile = path.join(__dirname, 'bug-report-endpoint-test-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    summary: {
      total: results.total,
      passed: results.passed,
      failed: results.failed,
      duration: totalDuration
    },
    tests: results.tests
  }, null, 2));
  
  console.log(`${colors.cyan}Results saved to: ${resultsFile}${colors.reset}\n`);
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
