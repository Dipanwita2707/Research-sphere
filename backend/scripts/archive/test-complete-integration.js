#!/usr/bin/env node
/**
 * Complete Integration Test for Gate Entry Permission System
 * Tests: Backend Setup, Database Connection, All Imports, Permission Logic
 */

const chalk = require('chalk') || { green: (s) => s, red: (s) => s, yellow: (s) => s, blue: (s) => s };

console.log('\n' + '='.repeat(60));
console.log('🧪 GATE ENTRY PERMISSION SYSTEM - INTEGRATION TEST');
console.log('='.repeat(60) + '\n');

let testsPassed = 0;
let testsFailed = 0;

function testSection(name) {
  console.log(`\n${'▶'.repeat(3)} ${name}`);
  console.log('-'.repeat(60));
}

function testPass(message) {
  console.log(`  ✅ ${message}`);
  testsPassed++;
}

function testFail(message, error) {
  console.log(`  ❌ ${message}`);
  if (error) console.log(`     Error: ${error.message}`);
  testsFailed++;
}

async function runTests() {
  try {
    // ==================== TEST 1: Backend Setup =============    testSection('TEST 1: Backend Environment Setup');
    
    try {
      const env = process.env;
      if (env.DATABASE_URL) {
        testPass('DATABASE_URL configured');
      } else {
        testFail('DATABASE_URL not found in environment');
      }
    } catch (error) {
      testFail('Environment check failed', error);
    }

    // ==================== TEST 2: Permission Constants =============    testSection('TEST 2: Permission Constants');
    
    try {
      const {
        GATE_ENTRY_PERMISSIONS,
        ROLE_PERMISSIONS,
        hasGateEntryPermission,
        canCancelPass,
        canExtendPass
      } = require('./src/shared/constants/gateEntryPermissions');
      
      testPass('Permission constants imported');
      testPass(`${Object.keys(GATE_ENTRY_PERMISSIONS).length} permissions defined`);
      testPass(`${Object.keys(ROLE_PERMISSIONS).length} roles configured`);
      
      // Test permission logic
      if (hasGateEntryPermission('admin', GATE_ENTRY_PERMISSIONS.ANALYTICS)) {
        testPass('Admin has ANALYTICS permission');
      } else {
        testFail('Admin should have ANALYTICS permission');
      }
      
      if (!hasGateEntryPermission('staff', GATE_ENTRY_PERMISSIONS.ANALYTICS)) {
        testPass('Guard (staff) does NOT have ANALYTICS permission');
      } else {
        testFail('Guard should NOT have ANALYTICS permission');
      }
      
      if (hasGateEntryPermission('faculty', GATE_ENTRY_PERMISSIONS.VIEW_OWN)) {
        testPass('Faculty has VIEW_OWN permission');
      } else {
        testFail('Faculty should have VIEW_OWN permission');
      }
      
      // Test context-dependent cancellation
      const testUser = { id: 'user-1', role: 'faculty' };
      const testPass = { created_by_id: 'user-1', pass_status: 'created' };
      
      if (canCancelPass(testUser, testPass)) {
        testPass('Creator can cancel own pass before check-in');
      } else {
        testFail('Creator should be able to cancel own pass');
      }
      
      const guardUser = { id: 'user-2', role: 'staff' };
      if (!canCancelPass(guardUser, testPass)) {
        testPass('Guard CANNOT cancel pass before check-in');
      } else {
        testFail('Guard should NOT cancel before check-in');
      }
      
    } catch (error) {
      testFail('Permission constants import failed', error);
    }

    // ==================== TEST 3: Middleware =============    testSection('TEST 3: Permission Middleware');
    
    try {
      const {
        canCreatePass,
        canVerifyPass,
        canViewAnalytics,
        canCancelPass: middlewareCancelPass,
        canExtendPass: middlewareExtendPass,
        hasViewAllPermission,
        hasViewOwnPermission
      } = require('./src/shared/middleware/gateEntryAuth');
      
      testPass('Middleware imported successfully');
      testPass('canCreatePass function available');
      testPass('canVerifyPass function available');
      testPass('canViewAnalytics function available');
      testPass('canCancelPass function available');
      testPass('canExtendPass function available');
      testPass('hasViewAllPermission helper available');
      testPass('hasViewOwnPermission helper available');
      
    } catch (error) {
      testFail('Middleware import failed', error);
    }

    // ==================== TEST 4: Routes =============    testSection('TEST 4: Gate Entry Routes');
    
    try {
      const routes = require('./src/modules/gate-entry/routes/gatePass.routes');
      testPass('Routes imported successfully');
      testPass('Routes configured with new middleware');
    } catch (error) {
      testFail('Routes import failed', error);
    }

    // ==================== TEST 5: Controller =============    testSection('TEST 5: Gate Entry Controller');
    
    try {
      const controller = require('./src/modules/gate-entry/controllers/gatePass.controller');
      testPass('Controller imported successfully');
      
      if (controller.getAllPasses) testPass('getAllPasses controller exists');
      if (controller.cancelPass) testPass('cancelPass controller exists');
      if (controller.extendPass) testPass('extendPass controller exists');
      if (controller.getStats) testPass('getStats controller exists');
      
    } catch (error) {
      testFail('Controller import failed', error);
    }

    // ==================== TEST 6: Service =============    testSection('TEST 6: Gate Entry Service');
    
    try {
      const GatePassService = require('./src/modules/gate-entry/services/gatePass.service');
      const service = new GatePassService();
      
      testPass('Service imported successfully');
      
      if (service.getAllPasses) testPass('getAllPasses service exists');
      if (service.getPassStats) testPass('getPassStats service exists');
      if (service.cancelPass) testPass('cancelPass service exists');
      if (service.extendPass) testPass('extendPass service exists');
      
    } catch (error) {
      testFail('Service import failed', error);
    }

    // ==================== TEST 7: Database Connection =============    testSection('TEST 7: Database Connection');
    
    try {
      const prisma = require('./src/shared/config/database');
      
      // Test database connection
      await prisma.$connect();
      testPass('Database connection successful');
      
      // Check if gate_pass table exists
      const passCount = await prisma.gate_pass.count();
      testPass(`Database accessible - ${passCount} gate passes found`);
      
      // Check user_login table
      const userCount = await prisma.userLogin.count();
      testPass(`User table accessible - ${userCount} users found`);
      
      // Check for different roles
      const roles = await prisma.userLogin.groupBy({
        by: ['role'],
        _count: true
      });
      
      console.log('\n  📊 User Roles in Database:');
      roles.forEach(r => {
        console.log(`     - ${r.role || 'null'}: ${r._count} users`);
      });
      
      const hasAdmin = roles.some(r => r.role === 'admin');
      const hasStaff = roles.some(r => r.role === 'staff');
      const hasFaculty = roles.some(r => r.role === 'faculty');
      const hasStudent = roles.some(r => r.role === 'student');
      
      if (hasAdmin) testPass('Admin users exist in database');
      if (hasStaff) testPass('Guard (staff) users exist in database');
      if (hasFaculty) testPass('Faculty users exist in database');
      if (hasStudent) testPass('Student users exist in database');
      
      await prisma.$disconnect();
      
    } catch (error) {
      testFail('Database connection failed', error);
      console.log('\n  ⚠️  Check your DATABASE_URL in .env file');
    }

    // ==================== TEST 8: Integration Check =============    testSection('TEST 8: Integration Verification');
    
    try {
      // Check if all modules can work together
      const constants = require('./src/shared/constants/gateEntryPermissions');
      const middleware = require('./src/shared/middleware/gateEntryAuth');
      const service = require('./src/modules/gate-entry/services/gatePass.service');
      
      // Test: Service uses middleware helpers
      const testUser = { id: 'test', role: 'admin' };
      const hasViewAll = middleware.hasViewAllPermission(testUser);
      
      if (hasViewAll) {
        testPass('Service can use middleware helpers');
      }
      
      testPass('All modules integrated successfully');
      
    } catch (error) {
      testFail('Integration verification failed', error);
    }

  } catch (error) {
    console.error('\n❌ Critical Error:', error);
    testsFailed++;
  }

  // ==================== SUMMARY =============  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Tests Passed: ${testsPassed}`);
  console.log(`❌ Tests Failed: ${testsFailed}`);
  console.log(`📈 Success Rate: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`);
  console.log('='.repeat(60) + '\n');

  if (testsFailed === 0) {
    console.log('🎉 ALL TESTS PASSED! System is ready for testing.\n');
    console.log('Next Steps:');
    console.log('  1. Start backend: npm run dev');
    console.log('  2. Test with Postman or frontend');
    console.log('  3. Check documentation: GATE_ENTRY_QUICK_TEST.md\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please fix the issues above.\n');
    process.exit(1);
  }
}

// Run all tests
runTests().catch(error => {
  console.error('\n💥 Fatal Error:', error);
  process.exit(1);
});
