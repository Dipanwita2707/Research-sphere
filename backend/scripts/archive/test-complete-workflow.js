/**
 * Complete Workflow Testing Script
 * Tests: School → Department → Program → Employee → Permissions → Loan Letter
 * 
 * Usage: 
 * 1. Set your admin token: export ADMIN_TOKEN="your_jwt_token"
 * 2. Run: node scripts/test-complete-workflow.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:5001/api/v1';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

if (!ADMIN_TOKEN) {
  console.error('❌ Error: ADMIN_TOKEN environment variable is required');
  console.error('Usage: ADMIN_TOKEN=your_token node scripts/test-complete-workflow.js');
  process.exit(1);
}

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${ADMIN_TOKEN}`,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Test results
const results = {
  passed: 0,
  failed: 0,
  total: 0,
  tests: [],
  createdData: {},
};

// Helper functions
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
    reset: '\x1b[0m',
  };
  console.log(`${colors[type]}${message}${colors.reset}`);
}

function logTest(name, passed, details = {}) {
  results.total++;
  if (passed) {
    results.passed++;
    log(`✓ ${name}`, 'success');
  } else {
    results.failed++;
    log(`✗ ${name}`, 'error');
    if (details.error) {
      log(`  Error: ${details.error}`, 'error');
    }
  }
  results.tests.push({ name, passed, ...details });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Test 1: Create School
// ============================================================================
async function testCreateSchool() {
  log('\n📚 Testing School Creation...', 'info');
  
  try {
    const timestamp = Date.now();
    const response = await api.post('/schools', {
      facultyCode: `TEST-SCH-${timestamp}`,
      facultyName: `Test School ${timestamp}`,
      facultyType: 'ACADEMIC',
      shortName: 'Test School',
      description: 'Test school for automated testing',
      establishedYear: 2020,
    });
    
    if (response.data.success && response.data.data.id) {
      results.createdData.school = response.data.data;
      logTest('Create School', true, { 
        schoolId: response.data.data.id,
        facultyCode: response.data.data.facultyCode,
      });
      return true;
    } else {
      logTest('Create School', false, { error: 'Invalid response structure' });
      return false;
    }
  } catch (error) {
    logTest('Create School', false, { 
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
    });
    return false;
  }
}

// ============================================================================
// Test 2: List Schools
// ============================================================================
async function testListSchools() {
  log('\n📋 Testing List Schools...', 'info');
  
  try {
    const response = await api.get('/schools');
    
    if (response.data.success && Array.isArray(response.data.data)) {
      const count = response.data.data.length;
      logTest('List Schools', true, { count, cached: response.data.cached });
      return true;
    } else {
      logTest('List Schools', false, { error: 'Invalid response structure' });
      return false;
    }
  } catch (error) {
    logTest('List Schools', false, { 
      error: error.response?.data?.message || error.message,
    });
    return false;
  }
}

// ============================================================================
// Test 3: Create Department
// ============================================================================
async function testCreateDepartment() {
  log('\n🏢 Testing Department Creation...', 'info');
  
  if (!results.createdData.school) {
    logTest('Create Department', false, { error: 'School not created' });
    return false;
  }
  
  try {
    const timestamp = Date.now();
    const response = await api.post('/departments', {
      departmentCode: `TEST-DEPT-${timestamp}`,
      departmentName: `Test Department ${timestamp}`,
      shortName: 'Test Dept',
      facultyId: results.createdData.school.id,
      description: 'Test department for automated testing',
    });
    
    if (response.data.success && response.data.data.id) {
      results.createdData.department = response.data.data;
      logTest('Create Department', true, { 
        departmentId: response.data.data.id,
        departmentCode: response.data.data.departmentCode,
      });
      return true;
    } else {
      logTest('Create Department', false, { error: 'Invalid response structure' });
      return false;
    }
  } catch (error) {
    logTest('Create Department', false, { 
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
    });
    return false;
  }
}

// ============================================================================
// Test 4: Create Program
// ============================================================================
async function testCreateProgram() {
  log('\n🎓 Testing Program Creation...', 'info');
  
  if (!results.createdData.department) {
    logTest('Create Program', false, { error: 'Department not created' });
    return false;
  }
  
  try {
    const timestamp = Date.now();
    const response = await api.post('/programs', {
      programCode: `TEST-PROG-${timestamp}`,
      programName: `Test Program ${timestamp}`,
      shortName: 'Test Prog',
      departmentId: results.createdData.department.id,
      programType: 'UG',
      durationYears: 4,
      durationSemesters: 8,
      isActive: true,
    });
    
    if (response.data.success && response.data.data.id) {
      results.createdData.program = response.data.data;
      logTest('Create Program', true, { 
        programId: response.data.data.id,
        programCode: response.data.data.programCode,
        durationSemesters: response.data.data.durationSemesters,
      });
      return true;
    } else {
      logTest('Create Program', false, { error: 'Invalid response structure' });
      return false;
    }
  } catch (error) {
    logTest('Create Program', false, { 
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
    });
    return false;
  }
}

// ============================================================================
// Test 5: Add Specialization
// ============================================================================
async function testAddSpecialization() {
  log('\n🔬 Testing Add Specialization...', 'info');
  
  if (!results.createdData.program) {
    logTest('Add Specialization', false, { error: 'Program not created' });
    return false;
  }
  
  try {
    const timestamp = Date.now();
    const response = await api.post(`/programs/${results.createdData.program.id}/specializations`, {
      specializationCode: `TEST-SPEC-${timestamp}`,
      specializationName: `Test Specialization ${timestamp}`,
      isActive: true,
    });
    
    if (response.data.success && response.data.data.id) {
      results.createdData.specialization = response.data.data;
      logTest('Add Specialization', true, { 
        specializationId: response.data.data.id,
        specializationCode: response.data.data.specializationCode,
      });
      return true;
    } else {
      logTest('Add Specialization', false, { error: 'Invalid response structure' });
      return false;
    }
  } catch (error) {
    logTest('Add Specialization', false, { 
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
    });
    return false;
  }
}

// ============================================================================
// Test 6: Create Employee
// ============================================================================
async function testCreateEmployee() {
  log('\n👤 Testing Employee Creation...', 'info');
  
  try {
    const timestamp = Date.now();
    const response = await api.post('/employees', {
      uid: `TEST-EMP-${timestamp}`,
      email: `test.emp.${timestamp}@test.edu`,
      firstName: 'Test',
      lastName: 'Employee',
      displayName: `Test Employee ${timestamp}`,
      empId: `EMP-${timestamp}`,
      designation: 'Finance Officer',
      department: 'Finance',
      mobileNumber: '1234567890',
      role: 'staff',
    });
    
    if (response.data.success && response.data.data.id) {
      results.createdData.employee = response.data.data;
      logTest('Create Employee', true, { 
        employeeId: response.data.data.id,
        uid: response.data.data.uid,
        email: response.data.data.email,
      });
      return true;
    } else {
      logTest('Create Employee', false, { error: 'Invalid response structure' });
      return false;
    }
  } catch (error) {
    logTest('Create Employee', false, { 
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
    });
    return false;
  }
}

// ============================================================================
// Test 7: Grant Permissions
// ============================================================================
async function testGrantPermissions() {
  log('\n🔐 Testing Grant Permissions...', 'info');
  
  if (!results.createdData.employee) {
    logTest('Grant Permissions', false, { error: 'Employee not created' });
    return false;
  }
  
  try {
    // First, get central departments to find one to grant permissions to
    const deptResponse = await api.get('/central-departments');
    
    if (!deptResponse.data.success || !deptResponse.data.data || deptResponse.data.data.length === 0) {
      logTest('Grant Permissions', false, { error: 'No central departments found' });
      return false;
    }
    
    const centralDept = deptResponse.data.data[0];
    
    const response = await api.post('/permission-management/central-department/grant', {
      userId: results.createdData.employee.id,
      centralDeptId: centralDept.id,
      permissions: {
        configure_fee_structure: true,
        print_loan_letter: true,
        finance_analytics: true,
      },
      isPrimary: true,
    });
    
    if (response.data.success) {
      results.createdData.permissions = response.data.data;
      logTest('Grant Permissions', true, { 
        userId: results.createdData.employee.id,
        centralDeptId: centralDept.id,
        permissions: ['configure_fee_structure', 'print_loan_letter', 'finance_analytics'],
      });
      return true;
    } else {
      logTest('Grant Permissions', false, { error: 'Invalid response structure' });
      return false;
    }
  } catch (error) {
    logTest('Grant Permissions', false, { 
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
    });
    return false;
  }
}

// ============================================================================
// Test 8: Create Fee Structure (Academic)
// ============================================================================
async function testCreateFeeStructure() {
  log('\n💰 Testing Fee Structure Creation...', 'info');
  
  if (!results.createdData.program) {
    logTest('Create Fee Structure', false, { error: 'Program not created' });
    return false;
  }
  
  try {
    const currentYear = new Date().getFullYear();
    const semesterAmounts = {};
    for (let i = 1; i <= 8; i++) {
      semesterAmounts[i] = 50000;
    }
    
    const response = await api.post('/finance/fee-structure', {
      type: 'ACADEMIC',
      batchYear: currentYear,
      programId: results.createdData.program.id,
      heads: [
        {
          headName: 'Tuition Fee',
          amount: 400000,
          semesterAmounts,
        },
        {
          headName: 'Lab Fee',
          amount: 80000,
          semesterAmounts: Object.fromEntries(Object.keys(semesterAmounts).map(k => [k, 10000])),
        },
      ],
    });
    
    if (response.data.success && response.data.data.id) {
      results.createdData.feeStructure = response.data.data;
      logTest('Create Fee Structure', true, { 
        feeStructureId: response.data.data.id,
        type: response.data.data.type,
        batchYear: response.data.data.batchYear,
        headsCount: response.data.data.heads?.length || 0,
      });
      return true;
    } else {
      logTest('Create Fee Structure', false, { error: 'Invalid response structure' });
      return false;
    }
  } catch (error) {
    logTest('Create Fee Structure', false, { 
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
    });
    return false;
  }
}

// ============================================================================
// Test 9: Create Transport Fee Structure
// ============================================================================
async function testCreateTransportFee() {
  log('\n🚌 Testing Transport Fee Structure...', 'info');
  
  try {
    const currentYear = new Date().getFullYear();
    
    const response = await api.post('/finance/fee-structure', {
      type: 'TRANSPORT',
      batchYear: currentYear,
      heads: [
        {
          headName: 'Transport Fee',
          amount: 20000,
        },
      ],
    });
    
    if (response.data.success && response.data.data.id) {
      results.createdData.transportFee = response.data.data;
      logTest('Create Transport Fee', true, { 
        feeStructureId: response.data.data.id,
        type: response.data.data.type,
      });
      return true;
    } else {
      logTest('Create Transport Fee', false, { error: 'Invalid response structure' });
      return false;
    }
  } catch (error) {
    logTest('Create Transport Fee', false, { 
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
    });
    return false;
  }
}

// ============================================================================
// Test 10: Create Hostel Fee Structure
// ============================================================================
async function testCreateHostelFee() {
  log('\n🏠 Testing Hostel Fee Structure...', 'info');
  
  try {
    const currentYear = new Date().getFullYear();
    
    const response = await api.post('/finance/fee-structure', {
      type: 'HOSTEL',
      batchYear: currentYear,
      heads: [
        {
          headName: 'Hostel Fee',
          amount: 30000,
        },
      ],
    });
    
    if (response.data.success && response.data.data.id) {
      results.createdData.hostelFee = response.data.data;
      logTest('Create Hostel Fee', true, { 
        feeStructureId: response.data.data.id,
        type: response.data.data.type,
      });
      return true;
    } else {
      logTest('Create Hostel Fee', false, { error: 'Invalid response structure' });
      return false;
    }
  } catch (error) {
    logTest('Create Hostel Fee', false, { 
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
    });
    return false;
  }
}

// ============================================================================
// Test 11: Get Loan Letter Template
// ============================================================================
async function testGetLoanLetterTemplate() {
  log('\n📄 Testing Get Loan Letter Template...', 'info');
  
  try {
    const response = await api.get('/finance/loan-letters/template');
    
    if (response.data.success && response.data.data) {
      logTest('Get Loan Letter Template', true, { 
        hasTemplate: true,
        universityName: response.data.data.universityName,
      });
      return true;
    } else {
      logTest('Get Loan Letter Template', false, { error: 'Invalid response structure' });
      return false;
    }
  } catch (error) {
    logTest('Get Loan Letter Template', false, { 
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
    });
    return false;
  }
}

// ============================================================================
// Test 12: Create Loan Letter
// ============================================================================
async function testCreateLoanLetter() {
  log('\n📝 Testing Loan Letter Creation...', 'info');
  
  if (!results.createdData.program) {
    logTest('Create Loan Letter', false, { error: 'Program not created' });
    return false;
  }
  
  try {
    const timestamp = Date.now();
    const response = await api.post('/finance/loan-letters', {
      applicationNumber: `TEST-APP-${timestamp}`,
      studentName: `Test Student ${timestamp}`,
      studentEmail: `test.student.${timestamp}@test.edu`,
      studentPhone: '9876543210',
      relationPrefix: 'Son of',
      relationName: 'Test Parent',
      programId: results.createdData.program.id,
      selectedSemesters: [1, 2, 3, 4, 5, 6, 7, 8],
      transportIncluded: true,
      hostelIncluded: true,
    });
    
    if (response.data.success && response.data.data.id) {
      results.createdData.loanLetter = response.data.data;
      
      const feeBreakdown = response.data.data.feeBreakdown;
      const academicTotal = feeBreakdown?.academic?.reduce((sum, h) => sum + h.total, 0) || 0;
      const transportTotal = feeBreakdown?.transport?.reduce((sum, h) => sum + h.yearlyTotal, 0) || 0;
      const hostelTotal = feeBreakdown?.hostel?.reduce((sum, h) => sum + h.yearlyTotal, 0) || 0;
      const grandTotal = feeBreakdown?.grandTotal || 0;
      
      logTest('Create Loan Letter', true, { 
        loanLetterId: response.data.data.id,
        uniqueNumber: response.data.data.uniqueNumber,
        applicationNumber: response.data.data.applicationNumber,
        academicTotal,
        transportTotal,
        hostelTotal,
        grandTotal,
      });
      
      log(`  Fee Breakdown:`, 'info');
      log(`    Academic: ₹${academicTotal}`, 'info');
      log(`    Transport: ₹${transportTotal}`, 'info');
      log(`    Hostel: ₹${hostelTotal}`, 'info');
      log(`    Grand Total: ₹${grandTotal}`, 'info');
      
      return true;
    } else {
      logTest('Create Loan Letter', false, { error: 'Invalid response structure' });
      return false;
    }
  } catch (error) {
    logTest('Create Loan Letter', false, { 
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
    });
    return false;
  }
}

// ============================================================================
// Test 13: Test Duplicate Application Number
// ============================================================================
async function testDuplicateApplicationNumber() {
  log('\n🚫 Testing Duplicate Application Number Prevention...', 'info');
  
  if (!results.createdData.loanLetter) {
    logTest('Duplicate Application Number', false, { error: 'Loan letter not created' });
    return false;
  }
  
  try {
    const response = await api.post('/finance/loan-letters', {
      applicationNumber: results.createdData.loanLetter.applicationNumber,
      studentName: 'Another Student',
      relationPrefix: 'Daughter of',
      relationName: 'Another Parent',
      programId: results.createdData.program.id,
      selectedSemesters: [1, 2, 3, 4],
      transportIncluded: false,
      hostelIncluded: false,
    });
    
    // Should not reach here
    logTest('Duplicate Application Number', false, { 
      error: 'Duplicate was not rejected',
    });
    return false;
  } catch (error) {
    if (error.response?.status === 409) {
      logTest('Duplicate Application Number', true, { 
        message: 'Correctly rejected duplicate',
        status: 409,
      });
      return true;
    } else {
      logTest('Duplicate Application Number', false, { 
        error: `Expected 409, got ${error.response?.status}`,
      });
      return false;
    }
  }
}

// ============================================================================
// Test 14: List Loan Letters
// ============================================================================
async function testListLoanLetters() {
  log('\n📋 Testing List Loan Letters...', 'info');
  
  try {
    const response = await api.get('/finance/loan-letters?page=1&limit=50');
    
    if (response.data.success && Array.isArray(response.data.data)) {
      const count = response.data.data.length;
      logTest('List Loan Letters', true, { 
        count,
        total: response.data.total,
      });
      return true;
    } else {
      logTest('List Loan Letters', false, { error: 'Invalid response structure' });
      return false;
    }
  } catch (error) {
    logTest('List Loan Letters', false, { 
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
    });
    return false;
  }
}

// ============================================================================
// Test 15: Get Loan Letter By ID
// ============================================================================
async function testGetLoanLetterById() {
  log('\n🔍 Testing Get Loan Letter By ID...', 'info');
  
  if (!results.createdData.loanLetter) {
    logTest('Get Loan Letter By ID', false, { error: 'Loan letter not created' });
    return false;
  }
  
  try {
    const response = await api.get(`/finance/loan-letters/${results.createdData.loanLetter.id}`);
    
    if (response.data.success && response.data.data.id) {
      logTest('Get Loan Letter By ID', true, { 
        loanLetterId: response.data.data.id,
        hasFeeBreakdown: !!response.data.data.feeBreakdown,
      });
      return true;
    } else {
      logTest('Get Loan Letter By ID', false, { error: 'Invalid response structure' });
      return false;
    }
  } catch (error) {
    logTest('Get Loan Letter By ID', false, { 
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
    });
    return false;
  }
}

// ============================================================================
// Test 16: Record Reprint
// ============================================================================
async function testRecordReprint() {
  log('\n🖨️ Testing Record Reprint...', 'info');
  
  if (!results.createdData.loanLetter) {
    logTest('Record Reprint', false, { error: 'Loan letter not created' });
    return false;
  }
  
  try {
    const response = await api.post(`/finance/loan-letters/${results.createdData.loanLetter.id}/reprint`);
    
    if (response.data.success) {
      logTest('Record Reprint', true, { 
        loanLetterId: results.createdData.loanLetter.id,
        reprintCount: response.data.data.reprintCount || 0,
      });
      return true;
    } else {
      logTest('Record Reprint', false, { error: 'Invalid response structure' });
      return false;
    }
  } catch (error) {
    logTest('Record Reprint', false, { 
      error: error.response?.data?.message || error.message,
      status: error.response?.status,
    });
    return false;
  }
}

// ============================================================================
// Main Test Runner
// ============================================================================
async function runAllTests() {
  log('\n========================================', 'info');
  log('Complete Workflow Testing', 'info');
  log('========================================\n', 'info');
  
  const startTime = Date.now();
  
  // Run tests sequentially
  await testCreateSchool();
  await testListSchools();
  await testCreateDepartment();
  await testCreateProgram();
  await testAddSpecialization();
  await testCreateEmployee();
  await testGrantPermissions();
  await testCreateFeeStructure();
  await testCreateTransportFee();
  await testCreateHostelFee();
  await testGetLoanLetterTemplate();
  await testCreateLoanLetter();
  await testDuplicateApplicationNumber();
  await testListLoanLetters();
  await testGetLoanLetterById();
  await testRecordReprint();
  
  const duration = Date.now() - startTime;
  
  // Print summary
  log('\n========================================', 'info');
  log('Test Summary', 'info');
  log('========================================', 'info');
  log(`Total Tests: ${results.total}`, 'info');
  log(`Passed: ${results.passed}`, 'success');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'error' : 'info');
  log(`Duration: ${(duration / 1000).toFixed(2)}s`, 'info');
  log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`, 'info');
  
  // Print created data summary
  log('\n========================================', 'info');
  log('Created Data Summary', 'info');
  log('========================================', 'info');
  if (results.createdData.school) {
    log(`School: ${results.createdData.school.facultyCode} (${results.createdData.school.id})`, 'info');
  }
  if (results.createdData.department) {
    log(`Department: ${results.createdData.department.departmentCode} (${results.createdData.department.id})`, 'info');
  }
  if (results.createdData.program) {
    log(`Program: ${results.createdData.program.programCode} (${results.createdData.program.id})`, 'info');
  }
  if (results.createdData.specialization) {
    log(`Specialization: ${results.createdData.specialization.specializationCode} (${results.createdData.specialization.id})`, 'info');
  }
  if (results.createdData.employee) {
    log(`Employee: ${results.createdData.employee.uid} (${results.createdData.employee.id})`, 'info');
  }
  if (results.createdData.loanLetter) {
    log(`Loan Letter: ${results.createdData.loanLetter.uniqueNumber} (${results.createdData.loanLetter.id})`, 'info');
  }
  
  // Save results to file
  const resultsPath = path.join(__dirname, '../test-results-complete-workflow.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  log(`\nDetailed results saved to: ${resultsPath}`, 'info');
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});
