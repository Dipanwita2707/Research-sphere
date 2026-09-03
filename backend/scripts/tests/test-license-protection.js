/**
 * test-license-protection.js
 * Verification test for Hardware-bound Licensing & Cryptographic State Injection
 */

const licenseState = require('../../src/shared/utils/licenseState');
const config = require('../../src/shared/config/app.config');

async function runTests() {
  console.log('🧪 Starting License Protection & State Validation Tests...\n');

  // Test 1: Unverified State Should Block Runtime Access
  console.log('Test 1: Verifying that unverified state blocks JWT secret access...');
  try {
    const secret = config.jwt.secret;
    console.error('❌ FAIL: Accessing jwt.secret should have thrown an error before verification!');
    process.exit(1);
  } catch (err) {
    if (err.message.includes('SECURITY VIOLATION') || err.message.includes('Missing license secret')) {
      console.log('✅ PASS: Unauthorized access blocked successfully with error:', err.message);
    } else {
      console.error('❌ FAIL: Unexpected error message:', err.message);
      process.exit(1);
    }
  }

  // Test 2: In-Memory Runtime Secret Authorization
  console.log('\nTest 2: Authorizing state with mock runtime token...');
  const mockSecret = 'crypto_runtime_payload_abc123';
  const mockHardwareId = 'mock_hwid_laptop_778899';
  const mockAssignedTo = 'Senior Developer';

  licenseState.setAuthorizedState(mockSecret, mockHardwareId, mockAssignedTo);

  if (licenseState.isVerified()) {
    console.log('✅ PASS: licenseState is verified.');
  } else {
    console.error('❌ FAIL: licenseState.isVerified() returned false.');
    process.exit(1);
  }

  const effectiveSecret = config.jwt.secret;
  if (effectiveSecret.includes(mockSecret)) {
    console.log('✅ PASS: Dynamic JWT secret successfully derived with injected secret:', effectiveSecret);
  } else {
    console.error('❌ FAIL: JWT secret does not include injected secret.');
    process.exit(1);
  }

  console.log('\n🎉 ALL LICENSE PROTECTION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
