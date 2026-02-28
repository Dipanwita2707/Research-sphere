// DEBUGGING SCRIPT - Run this in Browser Console (F12)
// Copy paste this entire script in console and press Enter

console.log('\n🔍 === STUDENT CREATE PASS DEBUG === 🔍\n');

// 1. Check localStorage
console.log('1️⃣ LocalStorage Check:');
const userId = localStorage.getItem('userId');
const userRole = localStorage.getItem('userRole');
const token = localStorage.getItem('token');

console.log('   userId:', userId);
console.log('   userRole:', userRole);
console.log('   token exists:', !!token);

if (userRole?.toLowerCase() !== 'student') {
  console.log('   ⚠️ WARNING: Not logged in as student!');
  console.log('   Current role:', userRole);
} else {
  console.log('   ✅ Logged in as student');
}

// 2. Check if guardian API endpoint exists
console.log('\n2️⃣ Testing Guardian API...');
if (token) {
  fetch('http://localhost:5000/api/v1/gate-entry/guardians', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  .then(res => res.json())
  .then(data => {
    console.log('   ✅ Guardian API Response:', data);
    if (data.success) {
      console.log('   📋 Guardians found:', data.data.guardians.length);
      data.data.guardians.forEach((g, i) => {
        console.log(`      ${i+1}. ${g.name} (${g.relationship}) - ${g.phone}`);
      });
    }
  })
  .catch(err => {
    console.log('   ❌ Guardian API Error:', err);
  });
} else {
  console.log('   ⚠️ No token found in localStorage');
}

// 3. Check form state
console.log('\n3️⃣ Form State Check:');
setTimeout(() => {
  const visitorNameInput = document.querySelector('input[name="visitorName"]');
  const guardianDropdown = document.querySelector('select[value]'); // Guardian selector
  
  console.log('   Visitor Name Input exists:', !!visitorNameInput);
  console.log('   Guardian Dropdown exists:', !!guardianDropdown);
  
  if (!guardianDropdown) {
    console.log('   ❌ Guardian dropdown NOT found on page');
    console.log('   This means isStudentLocked or guardians.length is 0');
  } else {
    console.log('   ✅ Guardian dropdown found');
  }
}, 1000);

// 4. Check React component state (if accessible)
console.log('\n4️⃣ Page Information:');
console.log('   Current URL:', window.location.href);
console.log('   Page Title:', document.title);

console.log('\n📝 INSTRUCTIONS:');
console.log('1. If userRole is NOT "student", logout and login again with STU001');
console.log('2. If guardian API fails, check backend is running on port 5000');
console.log('3. If guardian dropdown is missing, try hard refresh (Ctrl+Shift+R)');
console.log('4. Share this output with me for further debugging\n');
