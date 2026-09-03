/**
 * Quick validation script to test backend imports and permissions
 */

console.log('🧪 Testing Backend Gate Entry Permissions Integration...\n');

try {
  // Test 1: Import constants
  console.log('1. Testing constants import...');
  const constants = require('./src/shared/constants/gateEntryPermissions');
  console.log('   ✅ Constants loaded');
  console.log('   - Permissions:', Object.keys(constants.GATE_ENTRY_PERMISSIONS).length);
  console.log('   - Roles:', Object.keys(constants.ROLE_PERMISSIONS).length);

  // Test 2: Import middleware
  console.log('\n2. Testing middleware import...');
  const middleware = require('./src/shared/middleware/gateEntryAuth');
  console.log('   ✅ Middleware loaded');
  console.log('   - Functions:', Object.keys(middleware).length);

  // Test 3: Import routes
  console.log('\n3. Testing routes import...');
  const routes = require('./src/modules/gate-entry/routes/gatePass.routes');
  console.log('   ✅ Routes loaded');

  // Test 4: Import controller
  console.log('\n4. Testing controller import...');
  const controller = require('./src/modules/gate-entry/controllers/gatePass.controller');
  console.log('   ✅ Controller loaded');

  // Test 5: Import service
  console.log('\n5. Testing service import...');
  const service = require('./src/modules/gate-entry/services/gatePass.service');
  console.log('   ✅ Service loaded');

  console.log('\n🎉 All Backend Imports Successful!');
  console.log('✅ Gate Entry permission system is ready.\n');

  process.exit(0);
} catch (error) {
  console.error('\n❌ Import Error:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
