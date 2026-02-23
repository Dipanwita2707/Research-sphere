/**
 * Test Script for Gate Entry Permissions
 * Run: node backend/src/shared/constants/test-permissions.js
 */

const {
  GATE_ENTRY_PERMISSIONS,
  hasGateEntryPermission,
  canCancelPass,
  canExtendPass,
  getRolePermissions
} = require('./gateEntryPermissions');

console.log('🧪 Testing Gate Entry Permission System...\n');

// Test 1: Check Admin Permissions
console.log('✅ Test 1: Admin Permissions');
console.log('Admin has VIEW_ALL:', hasGateEntryPermission('admin', GATE_ENTRY_PERMISSIONS.VIEW_ALL));
console.log('Admin has ANALYTICS:', hasGateEntryPermission('admin', GATE_ENTRY_PERMISSIONS.ANALYTICS));
console.log('Admin permissions:', getRolePermissions('admin'));
console.log('');

// Test 2: Check Guard (Staff) Permissions
console.log('✅ Test 2: Guard (Staff) Permissions');
console.log('Guard has VERIFY:', hasGateEntryPermission('staff', GATE_ENTRY_PERMISSIONS.VERIFY));
console.log('Guard has ANALYTICS:', hasGateEntryPermission('staff', GATE_ENTRY_PERMISSIONS.ANALYTICS));
console.log('Guard permissions:', getRolePermissions('staff'));
console.log('');

// Test 3: Check Faculty Permissions
console.log('✅ Test 3: Faculty Permissions');
console.log('Faculty has CREATE:', hasGateEntryPermission('faculty', GATE_ENTRY_PERMISSIONS.CREATE));
console.log('Faculty has VIEW_ALL:', hasGateEntryPermission('faculty', GATE_ENTRY_PERMISSIONS.VIEW_ALL));
console.log('Faculty has VIEW_OWN:', hasGateEntryPermission('faculty', GATE_ENTRY_PERMISSIONS.VIEW_OWN));
console.log('Faculty permissions:', getRolePermissions('faculty'));
console.log('');

// Test 4: Check Student Permissions
console.log('✅ Test 4: Student Permissions');
console.log('Student has CREATE:', hasGateEntryPermission('student', GATE_ENTRY_PERMISSIONS.CREATE));
console.log('Student has VERIFY:', hasGateEntryPermission('student', GATE_ENTRY_PERMISSIONS.VERIFY));
console.log('Student permissions:', getRolePermissions('student'));
console.log('');

// Test 5: Cancel Pass - Before Check-in
console.log('✅ Test 5: Cancel Pass (Before Check-in)');
const passBeforeCheckin = {
  id: 'pass-123',
  created_by_id: 'user-1',
  pass_status: 'created'
};

const creator = { id: 'user-1', role: 'faculty' };
const admin = { id: 'user-2', role: 'admin' };
const guard = { id: 'user-3', role: 'staff' };
const otherUser = { id: 'user-4', role: 'faculty' };

console.log('Creator can cancel:', canCancelPass(creator, passBeforeCheckin));
console.log('Admin can cancel:', canCancelPass(admin, passBeforeCheckin));
console.log('Guard can cancel:', canCancelPass(guard, passBeforeCheckin));
console.log('Other user can cancel:', canCancelPass(otherUser, passBeforeCheckin));
console.log('');

// Test 6: Cancel Pass - After Check-in
console.log('✅ Test 6: Cancel Pass (After Check-in)');
const passAfterCheckin = {
  id: 'pass-123',
  created_by_id: 'user-1',
  pass_status: 'checked_in'
};

console.log('Creator can cancel:', canCancelPass(creator, passAfterCheckin));
console.log('Admin can cancel:', canCancelPass(admin, passAfterCheckin));
console.log('Guard can cancel:', canCancelPass(guard, passAfterCheckin));
console.log('Other user can cancel:', canCancelPass(otherUser, passAfterCheckin));
console.log('');

// Test 7: Extend Pass
console.log('✅ Test 7: Extend Pass');
console.log('Creator can extend:', canExtendPass(creator, passBeforeCheckin));
console.log('Admin can extend:', canExtendPass(admin, passBeforeCheckin));
console.log('Guard can extend:', canExtendPass(guard, passBeforeCheckin));
console.log('Other user can extend:', canExtendPass(otherUser, passBeforeCheckin));
console.log('');

console.log('🎉 All tests completed!');
