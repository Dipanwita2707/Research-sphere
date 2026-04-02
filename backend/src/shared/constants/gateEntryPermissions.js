/**
 * Gate Entry Permission System
 * Defines role-based access control for Gate Entry module
 */

// Permission Types
const GATE_ENTRY_PERMISSIONS = {
  CREATE: 'gate_entry.create',           // Create new visitor passes
  VIEW_ALL: 'gate_entry.view_all',       // View all passes (Admin/Guard)
  VIEW_OWN: 'gate_entry.view_own',       // View only own passes (Faculty/Student)
  VERIFY: 'gate_entry.verify',           // Verify/check-in passes (Admin/Guard)
  ANALYTICS: 'gate_entry.analytics',     // View analytics dashboard (Admin only)
  CANCEL: 'gate_entry.cancel',           // Cancel passes (context-dependent)
  EXTEND: 'gate_entry.extend'            // Extend passes (Creator/Admin only)
};

// Role-based permission mapping
const ROLE_PERMISSIONS = {
  // Admin (superadmin/admin) - Full access
  admin: [
    GATE_ENTRY_PERMISSIONS.CREATE,
    GATE_ENTRY_PERMISSIONS.VIEW_ALL,
    GATE_ENTRY_PERMISSIONS.VERIFY,
    GATE_ENTRY_PERMISSIONS.ANALYTICS,
    GATE_ENTRY_PERMISSIONS.CANCEL,
    GATE_ENTRY_PERMISSIONS.EXTEND
  ],
  
  superadmin: [
    GATE_ENTRY_PERMISSIONS.CREATE,
    GATE_ENTRY_PERMISSIONS.VIEW_ALL,
    GATE_ENTRY_PERMISSIONS.VERIFY,
    GATE_ENTRY_PERMISSIONS.ANALYTICS,
    GATE_ENTRY_PERMISSIONS.CANCEL,
    GATE_ENTRY_PERMISSIONS.EXTEND
  ],

  // Guard (staff role) - Can verify, view all, but no analytics
  staff: [
    GATE_ENTRY_PERMISSIONS.CREATE,
    GATE_ENTRY_PERMISSIONS.VIEW_ALL,
    GATE_ENTRY_PERMISSIONS.VERIFY,
    GATE_ENTRY_PERMISSIONS.CANCEL  // Context-dependent (only after check-in)
  ],

  // Faculty - Can create, view own, cancel own, extend own
  faculty: [
    GATE_ENTRY_PERMISSIONS.CREATE,
    GATE_ENTRY_PERMISSIONS.VIEW_OWN,
    GATE_ENTRY_PERMISSIONS.CANCEL,  // Only own passes
    GATE_ENTRY_PERMISSIONS.EXTEND   // Only own passes
  ],

  // Student - Can create, view own, cancel own, extend own
  student: [
    GATE_ENTRY_PERMISSIONS.CREATE,
    GATE_ENTRY_PERMISSIONS.VIEW_OWN,
    GATE_ENTRY_PERMISSIONS.CANCEL,  // Only own passes
    GATE_ENTRY_PERMISSIONS.EXTEND   // Only own passes
  ]
};

/**
 * Check if user role has specific permission
 * @param {string} userRole - User's role (admin, staff, faculty, student)
 * @param {string} permission - Permission to check
 * @returns {boolean}
 */
const hasGateEntryPermission = (userRole, permission) => {
  if (!userRole || !permission) return false;
  
  const role = userRole.toLowerCase();
  const rolePerms = ROLE_PERMISSIONS[role] || [];
  
  return rolePerms.includes(permission);
};

/**
 * Check if user can cancel a pass (context-dependent)
 * @param {Object} user - User object with id and role
 * @param {Object} pass - Gate pass object with created_by_id and pass_status
 * @returns {boolean}
 */
const canCancelPass = (user, pass) => {
  if (!user || !pass) return false;

  const role = user.role?.toLowerCase();
  const isAdmin = ['admin', 'superadmin'].includes(role);
  const isCreator = pass.created_by_id === user.id;
  const isGuard = role === 'staff';
  const isCheckedIn = pass.pass_status === 'checked_in';

  // Before check-in: Only creator or admin
  if (!isCheckedIn) {
    return isAdmin || isCreator;
  }

  // After check-in: Creator, admin, or guard
  return isAdmin || isCreator || isGuard;
};

/**
 * Check if user can extend a pass
 * @param {Object} user - User object with id and role
 * @param {Object} pass - Gate pass object with created_by_id
 * @returns {boolean}
 */
const canExtendPass = (user, pass) => {
  if (!user || !pass) return false;

  const role = user.role?.toLowerCase();
  const isAdmin = ['admin', 'superadmin'].includes(role);
  const isCreator = pass.created_by_id === user.id;

  return isAdmin || isCreator;
};

/**
 * Get all permissions for a role
 * @param {string} userRole - User's role
 * @returns {Array<string>}
 */
const getRolePermissions = (userRole) => {
  if (!userRole) return [];
  const role = userRole.toLowerCase();
  return ROLE_PERMISSIONS[role] || [];
};

module.exports = {
  GATE_ENTRY_PERMISSIONS,
  ROLE_PERMISSIONS,
  hasGateEntryPermission,
  canCancelPass,
  canExtendPass,
  getRolePermissions
};
