/**
 * Test script for Excel data preview functionality
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const FormData = require('form-data');

// Configuration
const BASE_URL = 'http://localhost:3001/api';

// Test credentials
const ADMIN_CREDENTIALS = {
  email: 'admin',
  password: 'admin123'
};

let authToken = null;

/**
 * Create test Excel file
 */
function createTestExcelFile() {
  const headers = ['empId*', 'firstName*', 'lastName', 'email*', 'phoneNumber', 'schoolCode', 'departmentCode', 'designation', 'userType*', 'password'];
  const rows = [
    ['EMP001', 'John', 'Doe', 'john.doe@test.com', '9876543210', 'SOCS', 'CS', 'Professor', 'faculty', 'Welcome@123'],
    ['EMP002', 'Jane', 'Smith', 'jane.smith@test.com', '9876543211', 'SOCS', 'CS', 'Assistant Professor', 'faculty', 'Welcome@123'],
    ['EMP003', 'Bob', 'Johnson', 'bob.johnson@test.com', '9876543212', 'SOCS', 'IT', 'Lecturer', 'faculty', 'Welcome@123'],
    ['EMP004', 'Alice', 'Brown', 'alice.brown@test.com', '9876543213', 'SOCS', 'CS', 'Lab Assistant', 'staff', 'Welcome@123'],
    ['EMP005', 'Charlie', 'Wilson', 'charlie.wilson@test.com', '9876543214', 'SOCS', 'IT', 'System Admin', 'staff', 'Welcome@123']
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');
  
  const filePath = path.join(__dirname, 'test-employees-preview.xlsx');
  XLSX.writeFile(workbook, filePath);
  return filePath;
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
 * Test Excel preview functionality
 */
async function testExcelPreview() {
  try {
    console.log('\n📊 Testing Excel data preview...');
    
    // Create test Excel file
    const filePath = createTestExcelFile();
    console.log(`📁 Created test file: ${filePath}`);
    
    // Create form data
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    
    // Send preview request
    const response = await axios.post(
      `${BASE_URL}/bulk-upload/preview`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          ...formData.getHeaders()
        }
      }
    );
    
    if (response.data.success) {
      const { headers, rows, totalRows, previewRows, message } = response.data.data;
      
      console.log('✅ Preview successful!');
      console.log(`📋 Headers: ${headers.join(', ')}`);
      console.log(`📊 ${message}`);
      console.log('\n📝 Preview data:');
      
      // Display preview data in table format
      console.table(rows);
      
      // Verify data integrity
      if (headers.length === 10 && totalRows === 5 && previewRows === 5) {
        console.log('✅ Data integrity check passed');
        return true;
      } else {
        console.log('❌ Data integrity check failed');
        console.log(`Expected: 10 headers, 5 total rows, 5 preview rows`);
        console.log(`Got: ${headers.length} headers, ${totalRows} total rows, ${previewRows} preview rows`);
        return false;
      }
    } else {
      console.log('❌ Preview failed:', response.data.message);
      return false;
    }
  } catch (error) {
    console.error('❌ Preview error:', error.response?.data?.message || error.message);
    return false;
  } finally {
    // Clean up test file
    const filePath = path.join(__dirname, 'test-employees-preview.xlsx');
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('🗑️ Cleaned up test file');
    }
  }
}

/**
 * Test template download
 */
async function testTemplateDownload() {
  try {
    console.log('\n📥 Testing template download...');
    
    const response = await axios.get(
      `${BASE_URL}/bulk-upload/template/employees`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
        responseType: 'arraybuffer'
      }
    );
    
    if (response.status === 200 && response.data.byteLength > 0) {
      // Verify it's a valid Excel file
      const workbook = XLSX.read(response.data, { type: 'buffer' });
      const sheetNames = workbook.SheetNames;
      
      console.log('✅ Template downloaded successfully');
      console.log(`📋 Sheets: ${sheetNames.join(', ')}`);
      
      // Check if it has the expected sheets
      if (sheetNames.includes('Employees') && sheetNames.includes('Instructions')) {
        console.log('✅ Template structure check passed');
        return true;
      } else {
        console.log('❌ Template structure check failed');
        console.log(`Expected sheets: Employees, Instructions`);
        console.log(`Found sheets: ${sheetNames.join(', ')}`);
        return false;
      }
    } else {
      console.log('❌ Template download failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Template download error:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🚀 Starting Excel Preview Tests');
  console.log('='.repeat(50));
  
  // Login first
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.error('❌ Cannot proceed without authentication');
    process.exit(1);
  }
  
  let passedTests = 0;
  let totalTests = 2;
  
  // Test template download
  if (await testTemplateDownload()) {
    passedTests++;
  }
  
  // Test Excel preview
  if (await testExcelPreview()) {
    passedTests++;
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! Excel preview is working correctly.');
  } else {
    console.log(`\n⚠️  ${totalTests - passedTests} test(s) failed. Please review the results.`);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('❌ Test runner error:', error);
    process.exit(1);
  });
}

module.exports = { runTests };