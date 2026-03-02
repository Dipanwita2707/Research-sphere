// Test outsider pass time validation logic
// Run: node scripts/test-outsider-time-validation.js

console.log('🧪 Testing Outsider Pass Time Validation\n');
console.log('='.repeat(70));

// Simulate the time validation logic
function testTimeValidation(testCase) {
  const { 
    visitorRelation, 
    expectedEntryTime, 
    expectedExitTime, 
    currentTime,
    description 
  } = testCase;
  
  console.log(`\n📋 Test: ${description}`);
  console.log('-'.repeat(70));
  console.log(`Visitor Relation: ${visitorRelation}`);
  console.log(`Expected Entry: ${expectedEntryTime}`);
  console.log(`Expected Exit: ${expectedExitTime || 'null'}`);
  console.log(`Current Time: ${currentTime}`);
  
  // Parse times
  const now = new Date();
  now.setHours(parseInt(currentTime.split(':')[0]), parseInt(currentTime.split(':')[1]), 0, 0);
  
  const [entryHour, entryMin] = expectedEntryTime.split(':').map(Number);
  const [exitHour, exitMin] = (expectedExitTime || '23:59').split(':').map(Number);
  
  const expectedEntry = new Date(now);
  expectedEntry.setHours(entryHour, entryMin, 0, 0);
  
  const expectedExit = new Date(now);
  expectedExit.setHours(exitHour, exitMin, 0, 0);
  
  // Check if outsider
  const isOutsider = visitorRelation?.toLowerCase() === 'outsider';
  
  console.log(`\n🔍 Analysis:`);
  console.log(`Is Outsider: ${isOutsider ? 'YES' : 'NO'}`);
  
  if (isOutsider) {
    console.log(`\n✨ Applying Outsider Special Rules:`);
    
    // Original times
    const originalEntry = new Date(expectedEntry);
    const originalExit = new Date(expectedExit);
    
    // Apply outsider rules
    expectedEntry.setTime(expectedEntry.getTime() - (5 * 60 * 60 * 1000)); // 5 hours before
    expectedExit.setHours(23, 59, 59, 999); // Until midnight
    
    console.log(`  Entry Time: ${originalEntry.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'})} → ${expectedEntry.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'})} (5 hours before)`);
    console.log(`  Exit Time: ${originalExit.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'})} → ${expectedExit.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'})} (until midnight)`);
  }
  
  const currentTimeMs = now.getTime();
  const isValid = currentTimeMs >= expectedEntry.getTime() && currentTimeMs <= expectedExit.getTime();
  
  console.log(`\n⏰ Time Window Check:`);
  console.log(`  Allowed From: ${expectedEntry.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'})}`);
  console.log(`  Allowed Until: ${expectedExit.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'})}`);
  console.log(`  Current Time: ${now.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'})}`);
  console.log(`  Time Difference from Entry: ${Math.floor((currentTimeMs - expectedEntry.getTime()) / (60 * 1000))} minutes`);
  
  if (isValid) {
    console.log(`\n✅ RESULT: PASS ALLOWED`);
  } else {
    console.log(`\n❌ RESULT: OUTSIDE TIME WINDOW`);
    if (currentTimeMs < expectedEntry.getTime()) {
      console.log(`  Reason: Too early (entry allowed from ${expectedEntry.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'})})`);
    } else {
      console.log(`  Reason: Too late (entry allowed until ${expectedExit.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'})})`);
    }
  }
  
  return isValid;
}

// Test cases
const testCases = [
  {
    description: 'Outsider - 2 hours before entry time (should PASS)',
    visitorRelation: 'Outsider',
    expectedEntryTime: '12:00',
    expectedExitTime: null,
    currentTime: '10:00'
  },
  {
    description: 'Outsider - Exactly 5 hours before entry time (should PASS)',
    visitorRelation: 'Outsider',
    expectedEntryTime: '12:00',
    expectedExitTime: null,
    currentTime: '07:00'
  },
  {
    description: 'Outsider - 6 hours before entry time (should FAIL)',
    visitorRelation: 'Outsider',
    expectedEntryTime: '12:00',
    expectedExitTime: null,
    currentTime: '06:00'
  },
  {
    description: 'Outsider - At entry time (should PASS)',
    visitorRelation: 'Outsider',
    expectedEntryTime: '12:00',
    expectedExitTime: null,
    currentTime: '12:00'
  },
  {
    description: 'Outsider - Late evening 23:00 (should PASS - midnight rule)',
    visitorRelation: 'Outsider',
    expectedEntryTime: '12:00',
    expectedExitTime: '18:00',
    currentTime: '23:00'
  },
  {
    description: 'Parent - 2 hours before entry time (should FAIL)',
    visitorRelation: 'Parent',
    expectedEntryTime: '12:00',
    expectedExitTime: '18:00',
    currentTime: '10:00'
  },
  {
    description: 'Parent - Within entry/exit window (should PASS)',
    visitorRelation: 'Parent',
    expectedEntryTime: '12:00',
    expectedExitTime: '18:00',
    currentTime: '14:00'
  },
  {
    description: 'User\'s actual case - Outsider at 10:53 AM, entry 12:00 (should PASS)',
    visitorRelation: 'Outsider',
    expectedEntryTime: '12:00',
    expectedExitTime: null,
    currentTime: '10:53'
  }
];

console.log('\n🎯 Running All Test Cases...\n');

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  const result = testTimeValidation(testCase);
  
  // Check expected result based on description
  const shouldPass = testCase.description.includes('should PASS');
  const shouldFail = testCase.description.includes('should FAIL');
  
  if (shouldPass && result) {
    passed++;
  } else if (shouldFail && !result) {
    passed++;
  } else if (shouldPass && !result) {
    console.log(`\n⚠️  TEST FAILED: Expected PASS but got FAIL`);
    failed++;
  } else if (shouldFail && result) {
    console.log(`\n⚠️  TEST FAILED: Expected FAIL but got PASS`);
    failed++;
  }
});

console.log('\n' + '='.repeat(70));
console.log(`\n📊 Test Results: ${passed}/${testCases.length} passed, ${failed} failed\n`);

if (failed === 0) {
  console.log('✅ ALL TESTS PASSED!\n');
} else {
  console.log(`❌ ${failed} TEST(S) FAILED\n`);
}
