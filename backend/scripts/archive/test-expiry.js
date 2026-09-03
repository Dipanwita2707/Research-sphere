// Test pass expiry logic
// The rule: pass valid all day on end_date, expired only on next day
// dateComparison = { lt: todayIST }

let allPass = true;
function test(name, passEndDate, todayIST, shouldExpire) {
  // Simulate: { lt: todayIST } means passEndDate < todayIST
  const expired = new Date(passEndDate) < new Date(todayIST);
  const pass = expired === shouldExpire;
  if (!pass) allPass = false;
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}: end=${passEndDate}, today=${todayIST}, expired=${expired}, expected=${shouldExpire}`);
}

// Pass ends Mar 10; today is Mar 10 → should NOT expire (valid all day)
test('Same day: pass still valid', '2026-03-10', '2026-03-10', false);

// Pass ends Mar 10; today is Mar 11 → should expire (next day)
test('Next day: pass expired', '2026-03-10', '2026-03-11', true);

// Pass ends Mar 10; today is Mar 9 → should NOT expire (future pass)
test('Future pass: still valid', '2026-03-10', '2026-03-09', false);

// Pass ends Mar 10; today is Mar 12 → should expire (2 days past)
test('2 days past: expired', '2026-03-10', '2026-03-12', true);

// Also verify pass_status is 'expired' not 'completed' (code check)
const fs = require('fs');
const code = fs.readFileSync('C:/Users/ASUS/Desktop/Sgt-Ums/backend/src/jobs/qrActivation.job.js', 'utf8');
const hasExpiredStatus = code.includes("pass_status: 'expired'");
const hasNoCompletedStatus = !code.includes("pass_status: 'completed'");
console.log(`${hasExpiredStatus ? 'PASS' : 'FAIL'} | pass_status set to 'expired'`);
console.log(`${hasNoCompletedStatus ? 'PASS' : 'FAIL'} | no 'completed' in expiry data`);
if (!hasExpiredStatus || !hasNoCompletedStatus) allPass = false;

// Verify no EXPIRY_HOUR_IST = 18 reference
const hasNo6PM = !code.includes('EXPIRY_HOUR_IST = 18');
console.log(`${hasNo6PM ? 'PASS' : 'FAIL'} | old 6PM IST constant removed`);
if (!hasNo6PM) allPass = false;

console.log(allPass ? '\n✅ ALL EXPIRY TESTS PASSED' : '\n❌ SOME TESTS FAILED');
process.exit(allPass ? 0 : 1);
