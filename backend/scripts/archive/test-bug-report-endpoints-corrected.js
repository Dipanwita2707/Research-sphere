/**
 * Bug Report System - Endpoint Testing Script with Automatic Authentication (Corrected)
 * 
 * This script tests all bug report endpoints with automatic login using provided credentials.
 * 
 * Usage:
 *   node scripts/test-bug-report-endpoints-corrected.js
 * 
 * Prerequisites:
 *   - Backend server must be running on localhost:5001
 *   - Database must be accessible
 *   - Admin credentials: admin/admin123
 *   - Finance user credentials: 1234567/1234567
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:5001';

// Credentials provided by user
const ADMIN_CREDENTIALS = {
  uid: 'admin',
  password: 'admin123'
};

const FINANCE_USER_CREDENTIALS = {
  uid: '1234567',
  password: '1234567'
};

// Test results tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

// Authentication tokens (will be populated after login)
let adminToken = null;
let userToken = null;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
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
  const ext = path.extname(filename).toLowerCase();
  let buffer;
  
  if (ext === '.png') {
    // Create a minimal valid PNG file
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
      0x49, 0x48, 0x44, 0x52, // IHDR
      0x00, 0x00, 0x00, 0x01, // Width: 1
      0x00, 0x00, 0x00, 0x01, // Height: 1
      0x08, 0x02, 0x00, 0x00, 0x00, // Bit depth, color type, compression, filter, interlace
      0x90, 0x77, 0x53, 0xDE, // CRC
      0x00, 0x00, 0x00, 0x0C, // IDAT chunk length
      0x49, 0x44, 0x41, 0x54, // IDAT
      0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, // Minimal image data
      0xE2, 0x21, 0xBC, 0x33, // CRC
      0x00, 0x00, 0x00, 0x00, // IEND chunk length
      0x49, 0x45, 0x4E, 0x44, // IEND
      0xAE, 0x42, 0x60, 0x82  // CRC
    ]);
    
    // Pad to desired size if needed
    const remainingSize = Math.max(0, (sizeKB * 1024) - pngHeader.length);
    const padding = Buffer.alloc(remainingSize, 0);
    buffer = Buffer.concat([pngHeader, padding]);
  } else if (ext === '.jpg' || ext === '.jpeg') {
    // Create a minimal valid JPEG file
    const jpegHeader = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, // JPEG signature and APP0 marker
      0x00, 0x10, // APP0 length
      0x4A, 0x46, 0x49, 0x46, 0x00, // "JFIF\0"
      0x01, 0x01, // Version 1.1
      0x01, // Units (1 = pixels per inch)
      0x00, 0x48, 0x00, 0x48, // X and Y density (72 DPI)
      0x00, 0x00, // Thumbnail width and height (0 = no thumbnail)
      0xFF, 0xDB, // Quantization table marker
      0x00, 0x43, // Length
      0x00 // Table ID
    ]);
    
    // Add minimal quantization table (64 bytes)
    const quantTable = Buffer.alloc(64, 0x10);
    
    // Add minimal Huffman tables and image data
    const jpegEnd = Buffer.from([0xFF, 0xD9]); // End of image marker
    
    // Pad to desired size
    const headerSize = jpegHeader.length + quantTable.length + jpegEnd.length;
    const remainingSize = Math.max(0, (sizeKB * 1024) - headerSize);
    const padding = Buffer.alloc(remainingSize, 0xFF);
    
    buffer = Buffer.concat([jpegHeader, quantTable, padding, jpegEnd]);
  } else {
    // Default to PNG for other extensions
    buffer = Buffer.alloc(sizeKB * 1024, 'test data for screenshot');
  }
  
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

// Authentication: Login Admin
async function loginAdmin() {
  const startTime = Date.now();
  try {
    const response = await axios.post(`${BASE_URL}/api/v1/auth/login`, {
      username: ADMIN_CREDENTIALS.uid,
      password: ADMIN_CREDENTIALS.password
    });
    
    const duration = Date.now() - startTime;
    
    if (response.status === 200 && response.data.success && response.data.token) {
      adminToken = response.data.token;
      logTest('Admin Login', true, '', duration);
      return true;
    } else {
      logTest('Admin Login', false, 'Invalid response format or missing token');
      return false;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logTest('Admin Login', false, error.response?.data?.message || error.message, duration);
    return false;
  }
}

// Authentication: Login Finance User
async function loginFinanceUser() {
  const startTime = Date.now();
  try {
    const response = await axios.post(`${BASE_URL}/api/v1/auth/login`, {
      username: FINANCE_USER_CREDENTIALS.uid,
      password: FINANCE_USER_CREDENTIALS.password
    });
    
    const duration = Date.now() - startTime;
    
    if (response.status === 200 && response.data.success && response.data.token) {
      userToken = response.data.token;
      logTest('Finance User Login', true, '', duration);
      return true;
    } else {
      logTest('Finance User Login', false, 'Invalid response format or missing token');
      return false;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logTest('Finance User Login', false, error.response?.data?.message || error.message, duration);
    return false;
  }
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

// Test 2: Submit Bug Report Without Screenshots (Finance User)
async function testSubmitBugReportWithoutScreenshots() {
  const startTime = Date.now();
  try {
    const response = await axios.post(
      `${BASE_URL}/api/v1/bug-reports`,
      {
        description: 'Test bug report - submit button not working on finance dashboard. When I click the submit button on the expense form, nothing happens and no validation errors are shown.',
        pageUrl: 'http://localhost:3000/finance/expenses',
        routePath: '/finance/expenses',
        userIdentifier: FINANCE_USER_CREDENTIALS.uid,
        userRole: 'finance',
        userEmail: 'finance@sgtums.edu'
      },
      {
        headers: {
          'Authorization': `Bearer ${userToken}`,
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

// Test 3: Submit Bug Report With Screenshots (Finance User)
async function testSubmitBugReportWithScreenshots() {
  const startTime = Date.now();
  const testFiles = [];
  
  try {
    // Create test screenshot files
    const screenshot1 = createTestScreenshot('test-screenshot-1.png', 100);
    const screenshot2 = createTestScreenshot('test-screenshot-2.jpg', 200);
    testFiles.push(screenshot1, screenshot2);
    
    const formData = new FormData();
    formData.append('description', 'Test bug report with screenshots - form validation error on budget approval page. The validation messages are not displaying correctly and the form allows invalid data to be submitted.');
    formData.append('pageUrl', 'http://localhost:3000/finance/budget-approval');
    formData.append('routePath', '/finance/budget-approval');
    formData.append('userIdentifier', FINANCE_USER_CREDENTIALS.uid);
    formData.append('userRole', 'finance');
    formData.append('userEmail', 'finance@sgtums.edu');
    formData.append('screenshots', fs.createReadStream(screenshot1));
    formData.append('screenshots', fs.createReadStream(screenshot2));
    
    const response = await axios.post(
      `${BASE_URL}/api/v1/bug-reports`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${userToken}`,
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
      `${BASE_URL}/api/v1/bug-reports`,
      {
        description: '',
        pageUrl: 'http://localhost:3000/test',
        routePath: '/test',
        userIdentifier: FINANCE_USER_CREDENTIALS.uid,
        userRole: 'finance'
      },
      {
        headers: {
          'Authorization': `Bearer ${userToken}`,
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
      `${BASE_URL}/api/v1/bug-reports`,
      {
        description: 'short',
        pageUrl: 'http://localhost:3000/test',
        routePath: '/test',
        userIdentifier: FINANCE_USER_CREDENTIALS.uid,
        userRole: 'finance'
      },
      {
        headers: {
          'Authorization': `Bearer ${userToken}`,
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
      `${BASE_URL}/api/v1/bug-reports`,
      {
        description: longDescription,
        pageUrl: 'http://localhost:3000/test',
        routePath: '/test',
        userIdentifier: FINANCE_USER_CREDENTIALS.uid,
        userRole: 'finance'
      },
      {
        headers: {
          'Authorization': `Bearer ${userToken}`,
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
      `${BASE_URL}/api/v1/bug-reports`,
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
      `${BASE_URL}/api/v1/admin/bug-reports`,
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`
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
      `${BASE_URL}/api/v1/admin/bug-reports?status=unresolved&sortBy=createdAt&order=desc&page=1&limit=10`,
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`
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
      `${BASE_URL}/api/v1/admin/bug-reports?search=test`,
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`
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
      `${BASE_URL}/api/v1/admin/bug-reports/${bugReportId}`,
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`
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
      `${BASE_URL}/api/v1/admin/bug-reports/${bugReportId}/status`,
      {
        status: 'resolved'
      },
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
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
      `${BASE_URL}/api/v1/admin/bug-reports/${bugReportId}/status`,
      {
        status: 'unresolved'
      },
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
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
      `${BASE_URL}/api/v1/admin/bug-reports`,
      {
        headers: {
          'Authorization': `Bearer ${userToken}`
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
      `${BASE_URL}/api/v1/bug-reports/${bugReportId}/screenshots`,
      {
        headers: {
          'Authorization': `Bearer ${userToken}`
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
      `${BASE_URL}/api/v1/bug-reports/screenshots/${screenshotId}`,
      {
        headers: {
          'Authorization': `Bearer ${userToken}`
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
  console.log(`${colors.blue}with Automatic Authentication (Corrected)${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);
  
  console.log(`${colors.cyan}Base URL: ${BASE_URL}${colors.reset}`);
  console.log(`${colors.cyan}Admin Credentials: ${ADMIN_CREDENTIALS.uid}/${ADMIN_CREDENTIALS.password}${colors.reset}`);
  console.log(`${colors.cyan}Finance User Credentials: ${FINANCE_USER_CREDENTIALS.uid}/${FINANCE_USER_CREDENTIALS.password}${colors.reset}\n`);
  
  const startTime = Date.now();
  
  // Run tests
  console.log(`${colors.yellow}Running tests...${colors.reset}\n`);
  
  // Test 0: Health Check
  const healthOk = await testHealthCheck();
  if (!healthOk) {
    console.log(`\n${colors.red}Backend server is not responding. Please start the server and try again.${colors.reset}\n`);
    process.exit(1);
  }
  
  // Authentication Tests
  console.log(`\n${colors.magenta}--- Authentication Tests ---${colors.reset}`);
  const adminLoginOk = await loginAdmin();
  const userLoginOk = await loginFinanceUser();
  
  if (!adminLoginOk || !userLoginOk) {
    console.log(`\n${colors.red}Authentication failed. Please check credentials and try again.${colors.reset}\n`);
    process.exit(1);
  }
  
  // Bug Report Submission Tests
  console.log(`\n${colors.magenta}--- Bug Report Submission Tests ---${colors.reset}`);
  const bugReportId1 = await testSubmitBugReportWithoutScreenshots();
  const bugReportId2 = await testSubmitBugReportWithScreenshots();
  
  // Validation Tests
  console.log(`\n${colors.magenta}--- Validation Tests ---${colors.reset}`);
  await testValidationEmptyDescription();
  await testValidationShortDescription();
  await testValidationLongDescription();
  
  // Authentication Tests
  console.log(`\n${colors.magenta}--- Security Tests ---${colors.reset}`);
  await testAuthenticationNoToken();
  await testAdminAccessControlNonAdmin();
  
  // Admin Dashboard Tests
  console.log(`\n${colors.magenta}--- Admin Dashboard Tests ---${colors.reset}`);
  const allReports = await testGetAllBugReports();
  await testGetBugReportsWithFilters();
  await testSearchBugReports();
  
  // Bug Report Management Tests
  console.log(`\n${colors.magenta}--- Bug Report Management Tests ---${colors.reset}`);
  let bugReportDetails = null;
  if (bugReportId1) {
    bugReportDetails = await testGetBugReportById(bugReportId1);
  } else if (allReports && allReports.length > 0) {
    bugReportDetails = await testGetBugReportById(allReports[0].id);
  }
  
  // Status Update Tests
  if (bugReportId1) {
    await testUpdateStatusToResolved(bugReportId1);
    await testUpdateStatusToUnresolved(bugReportId1);
  }
  
  // Screenshot Tests
  console.log(`\n${colors.magenta}--- Screenshot Tests ---${colors.reset}`);
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
  
  // Print success rate
  const successRate = ((results.passed / results.total) * 100).toFixed(1);
  if (successRate >= 90) {
    console.log(`${colors.green}Success Rate: ${successRate}% - Excellent!${colors.reset}`);
  } else if (successRate >= 75) {
    console.log(`${colors.yellow}Success Rate: ${successRate}% - Good${colors.reset}`);
  } else {
    console.log(`${colors.red}Success Rate: ${successRate}% - Needs Attention${colors.reset}`);
  }
  
  // Save results to file
  const resultsFile = path.join(__dirname, 'bug-report-endpoint-test-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    credentials: {
      admin: ADMIN_CREDENTIALS.uid,
      financeUser: FINANCE_USER_CREDENTIALS.uid
    },
    summary: {
      total: results.total,
      passed: results.passed,
      failed: results.failed,
      successRate: parseFloat(successRate),
      duration: totalDuration
    },
    tests: results.tests
  }, null, 2));
  
  console.log(`\n${colors.cyan}Results saved to: ${resultsFile}${colors.reset}\n`);
  
  // Final status
  if (results.failed === 0) {
    console.log(`${colors.green}🎉 All tests passed! Bug Report System endpoints are working perfectly.${colors.reset}\n`);
  } else {
    console.log(`${colors.yellow}⚠️  Some tests failed. Please review the failed tests and fix any issues.${colors.reset}\n`);
  }
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});