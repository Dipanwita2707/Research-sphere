/**
 * Quick test to verify middleware can be loaded without errors
 */

try {
  console.log('🧪 Testing middleware import...\n');
  
  const middleware = require('./gateEntryAuth');
  
  console.log('✅ Middleware loaded successfully!');
  console.log('✅ Available functions:');
  console.log('  - canCreatePass:', typeof middleware.canCreatePass);
  console.log('  - canVerifyPass:', typeof middleware.canVerifyPass);
  console.log('  - canViewAnalytics:', typeof middleware.canViewAnalytics);
  console.log('  - canCancelPass:', typeof middleware.canCancelPass);
  console.log('  - canExtendPass:', typeof middleware.canExtendPass);
  console.log('  - hasViewAllPermission:', typeof middleware.hasViewAllPermission);
  console.log('  - hasViewOwnPermission:', typeof middleware.hasViewOwnPermission);
  
  console.log('\n✅ All middleware functions exported correctly!');
  
} catch (error) {
  console.error('❌ Error loading middleware:', error.message);
  process.exit(1);
}
