/**
 * Test script for Excel-based bulk upload error handling
 * Tests various error scenarios to ensure user-friendly error messages
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Configuration
const BASE_URL = 'http://localhost:3001/api';
const TEST_RESULTS_FILE = path.join(__dirname, 'bulk-upload-excel-test-results.json');

// Test credentials
const ADMIN_CREDENTIALS = {
  email: 'admin',
  password: 'admin123'
};

let authToken = null;
const testResults = {
  timestamp: new Date().toISOString(),
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  tests: []
};

/**
 * Create Excel file from data
 */
function createExcelFile(headers, rows) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Login and get auth token
 */
async function login() {
  try {
    console.log('🔐 Logging in as admin...');
    const response = await axios.post(`${BASE_URL}/auth/login`, ADMIN_CREDENTIALS);
    
    if (response.data.success && response.data.token) {
      authToken = response.data.token;
      console.log('✅ Login successful');
      return true;
    } else {
      console.error('❌ Login failed:', response.data.message);
      return false;
    }
  } catch (error) {
    console.error('❌ Login error:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Test helper function
 */
async function runTest(testName, testFunction) {
  console.log(`\n🧪 Running test: ${testName}`);
  testResults.totalTests++;
  
  try {
    const result = await testFunction();
    if (result.passed) {
      testResults.passedTests++;
      console.log(`✅ ${testName}: PASSED`);
      if (result.message) console.log(`   ${result.message}`);
    } else {
      testResults.failedTests++;
      console.log(`❌ ${testName}: FAILED`);
      console.log(`   ${result.message}`);
    }
    
    testResults.tests.push({
      name: testName,
      passed: result.passed,
      message: result.message,
      details: result.details || null
    });
  } catch (error) {
    testResults.failedTests++;
    console.log(`❌ ${testName}: ERROR`);
    console.log(`   ${error.message}`);
    
    testResults.tests.push({
      name: testName,
      passed: false,
      message: error.message,
      details: error.stack
    });
  }
}

/**
 * Test duplicate school code error with Excel
 */
async function testDuplicateSchoolCodeExcel() {
  const headers = ['facultyCode*', 'facultyName*', 'facultyType*', 'shortName', 'description'];
  const rows = [
    ['SOCS', 'School of Computer Science', 'science', 'SCS', 'Test school'],
    ['SOCS', 'Duplicate School', 'science', 'DS', 'Another school with same code']
  ];

  const excelBuffer = createExcelFile(headers, rows);

  try {
    const formData = new FormData();
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    formData.append('file', blob, 'test-schools.xlsx');

    const response = await axios.post(
      `${BASE_URL}/bulk-upload/schools`,
      formData,
      { 
        headers: { 
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'multipart/form-data'
        } 
      }
    );

    const errors = response.data.data?.errors || [];
    const duplicateError = errors.find(e => e.row === 3);
    
    if (duplicateError && duplicateError.message.includes('already exists')) {
      return {
        passed: true,
        message: `User-friendly duplicate error: "${duplicateError.message}"`
      };
    } else {
      return {
        passed: false,
        message: `Expected user-friendly duplicate error, got: ${JSON.stringify(duplicateError)}`
      };
    }
  } catch (error) {
    return {
      passed: false,
      message: `Request failed: ${error.response?.data?.message || error.message}`
    };
  }
}

/**
 * Test invalid faculty type error with Excel
 */
async function testInvalidFacultyTypeExcel() {
  const headers = ['facultyCode*', 'facultyName*', 'facultyType*', 'shortName', 'description'];
  const rows = [
    ['INVALID', 'Test School', 'invalid_type', 'TS', 'Test school with invalid type']
  ];

  const excelBuffer = createExcelFile(headers, rows);

  try {
    const formData = new FormData();
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    formData.append('file', blob, 'test-schools-invalid.xlsx');

    const response = await axios.post(
      `${BASE_URL}/bulk-upload/schools`,
      formData,
      { 
        headers: { 
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'multipart/form-data'
        } 
      }
    );

    const errors = response.data.data?.errors || [];
    const typeError = errors.find(e => e.row === 2);
    
    if (typeError && typeError.message.includes('Invalid facultyType')) {
      return {
        passed: true,
        message: `User-friendly type error: "${typeError.message}"`
      };
    } else {
      return {
        passed: false,
        message: `Expected user-friendly type error, got: ${JSON.stringify(typeError)}`
      };
    }
  } catch (error) {
    return {
      passed: false,
      message: `Request failed: ${error.response?.data?.message || error.message}`
    };
  }
}

/**
 * Test successful Excel upload
 */
async function testSuccessfulExcelUpload() {
  const headers = ['empId*', 'firstName*', 'lastName', 'email*', 'phoneNumber', 'schoolCode', 'departmentCode', 'designation', 'userType*', 'password'];
  const rows = [
    ['EMP999', 'Success', 'Test', 'success.test@test.com', '9876543210', 'SOCS', 'CS', 'Professor', 'faculty', 'Welcome@123']
  ];

  const excelBuffer = createExcelFile(headers, rows);

  try {
    const formData = new FormData();
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    formData.append('file', blob, 'test-employees-success.xlsx');

    const response = await axios.post(
      `${BASE_URL}/bulk-upload/employees`,
      formData,
      { 
        headers: { 
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'multipart/form-data'
        } 
      }
    );

    if (response.data.success && response.data.data.successCount === 1) {
      return {
        passed: true,
        message: `Successful Excel upload: ${response.data.message}`
      };
    } else {
      return {
        passed: false,
        message: `Expected successful upload, got: ${JSON.stringify(response.data)}`
      };
    }
  } catch (error) {
    return {
      passed: false,
      message: `Request failed: ${error.response?.data?.message || error.message}`
    };
  }
}

/**
 * Test template download
 */
async function testTemplateDownload() {
  try {
    const response = await axios.get(
      `${BASE_URL}/bulk-upload/templates/employees`,
      { 
        headers: { Authorization: `Bearer ${authToken}` },
        responseType: 'arraybuffer'
      }
    );

    if (response.status === 200 && response.data.byteLength > 0) {
      // Verify it's a valid Excel file
      const workbook = XLSX.read(response.data, { type: 'buffer' });
      const sheetNames = workbook.SheetNames;
      
      if (sheetNames.includes('Employees') && sheetNames.includes('Instructions')) {
        return {
          passed: true,
          message: `Template downloaded successfully with sheets: ${sheetNames.join(', ')}`
        };
      } else {
        return {
          passed: false,
          message: `Template missing expected sheets. Found: ${sheetNames.join(', ')}`
        };
      }
    } else {
      return {
        passed: false,
        message: 'Template download failed or returned empty file'
      };
    }
  } catch (error) {
    return {
      passed: false,
      message: `Template download failed: ${error.response?.data?.message || error.message}`
    };
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🚀 Starting Excel-Based Bulk Upload Tests');
  console.log('='.repeat(50));

  // Login first
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.error('❌ Cannot proceed without authentication');
    process.exit(1);
  }

  // Run all tests
  await runTest('Template Download', testTemplateDownload);
  await runTest('Duplicate School Code Error (Excel)', testDuplicateSchoolCodeExcel);
  await runTest('Invalid Faculty Type Error (Excel)', testInvalidFacultyTypeExcel);
  await runTest('Successful Excel Upload', testSuccessfulExcelUpload);

  // Generate summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${testResults.totalTests}`);
  console.log(`Passed: ${testResults.passedTests}`);
  console.log(`Failed: ${testResults.failedTests}`);
  console.log(`Success Rate: ${((testResults.passedTests / testResults.totalTests) * 100).toFixed(1)}%`);

  // Save results
  fs.writeFileSync(TEST_RESULTS_FILE, JSON.stringify(testResults, null, 2));
  console.log(`\n📄 Detailed results saved to: ${TEST_RESULTS_FILE}`);

  if (testResults.failedTests === 0) {
    console.log('\n🎉 All tests passed! Excel-based bulk upload is working correctly.');
  } else {
    console.log(`\n⚠️  ${testResults.failedTests} test(s) failed. Please review the results.`);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('❌ Test runner error:', error);
    process.exit(1);
  });
}

module.exports = { runAllTests };