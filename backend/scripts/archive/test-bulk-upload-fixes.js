/**
 * Test script to verify bulk upload fixes
 * Tests the role field fix and improved error handling
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api/v1';

// Test data with various scenarios
const testEmployeeData = `empId,firstName,lastName,email,phoneNumber,schoolCode,departmentCode,designation,userType,password
EMP001,John,Doe,john.doe@test.com,9876543210,SOCS,CS,Assistant Professor,faculty,Welcome@123
EMP002,Jane,Smith,jane.smith@test.com,9876543211,SOCS,CS,Lab Assistant,staff,Welcome@123
EMP003,Bob,Johnson,bob.johnson@test.com,9876543212,INVALID,CS,Professor,faculty,Welcome@123
EMP004,Alice,Brown,alice.brown@test.com,9876543213,SOCS,INVALID,Lecturer,faculty,Welcome@123
EMP005,Charlie,Wilson,charlie.wilson@test.com,9876543214,,CS,Admin,admin,Welcome@123
EMP006,David,Davis,david.davis@test.com,9876543215,SOCS,CS,Researcher,invalid_type,Welcome@123`;

async function testBulkUploadEmployees() {
  try {
    console.log('🧪 Testing bulk upload employees with fixes...\n');

    const response = await axios.post(`${BASE_URL}/bulk-upload/employees`, {
      csvContent: testEmployeeData
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token' // You may need to adjust this
      }
    });

    console.log('✅ Response received:');
    console.log('Status:', response.status);
    console.log('Success:', response.data.success);
    console.log('Message:', response.data.message);
    
    if (response.data.data) {
      console.log('\n📊 Results Summary:');
      console.log('Total Records:', response.data.data.totalRecords);
      console.log('Success Count:', response.data.data.successCount);
      console.log('Failed Count:', response.data.data.failedCount);
      
      if (response.data.data.errors && response.data.data.errors.length > 0) {
        console.log('\n❌ Errors:');
        response.data.data.errors.forEach(error => {
          console.log(`Row ${error.row}: ${error.message}`);
        });
      }
    }

    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

async function testSchoolTemplate() {
  try {
    console.log('\n🧪 Testing school template generation...');
    
    const response = await axios.get(`${BASE_URL}/bulk-upload/templates/schools`, {
      responseType: 'arraybuffer'
    });
    
    console.log('✅ School template generated successfully');
    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers['content-type']);
    console.log('Content-Length:', response.headers['content-length']);
    
  } catch (error) {
    console.error('❌ School template test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting bulk upload tests...\n');
  
  await testSchoolTemplate();
  await testBulkUploadEmployees();
  
  console.log('\n🏁 All tests completed!');
}

runTests().catch(console.error);