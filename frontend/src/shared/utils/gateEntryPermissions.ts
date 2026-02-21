/**
 * Gate Entry Permission Utility (Frontend)
 * Client-side permission checks for UI rendering
 */

// Permission Types
export const GATE_ENTRY_PERMISSIONS = {
  CREATE: 'gate_entry.create',
  VIEW_ALL: 'gate_entry.view_all',
  VIEW_OWN: 'gate_entry.view_own',
  VERIFY: 'gate_entry.verify',
  ANALYTICS: 'gate_entry.analytics',
  CANCEL: 'gate_entry.cancel',
  EXTEND: 'gate_entry.extend'
} as const;

// Role-Permission Mapping
const ROLE_PERMISSIONS: Record<string, string[]> = {
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
  staff: [
    GATE_ENTRY_PERMISSIONS.CREATE,
    GATE_ENTRY_PERMISSIONS.VIEW_ALL,
    GATE_ENTRY_PERMISSIONS.VERIFY,
    GATE_ENTRY_PERMISSIONS.CANCEL
  ],
  faculty: [
    GATE_ENTRY_PERMISSIONS.CREATE,
    GATE_ENTRY_PERMISSIONS.VIEW_OWN,
    GATE_ENTRY_PERMISSIONS.CANCEL,
    GATE_ENTRY_PERMISSIONS.EXTEND
  ],
  student: [
    GATE_ENTRY_PERMISSIONS.CREATE,
    GATE_ENTRY_PERMISSIONS.VIEW_OWN,
    GATE_ENTRY_PERMISSIONS.CANCEL,
    GATE_ENTRY_PERMISSIONS.EXTEND
  ]
};

export interface GatePass {
  id: string;
  createdById?: string; // May come from some APIs
  creator?: { id: string; username?: string }; // Nested creator object from backend
  passStatus?: string;
  status?: string;
}

export interface User {
  id: string;
  role: string;
}

/**
 * Check if user role has specific permission
 */
export const hasGateEntryPermission = (userRole: string | undefined, permission: string): boolean => {
  if (!userRole || !permission) return false;
  
  const role = userRole.toLowerCase();
  const rolePerms = ROLE_PERMISSIONS[role] || [];
  
  return rolePerms.includes(permission);
};

/**
 * Check if user can view all passes (Admin/Guard)
 */
export const canViewAllPasses = (userRole: string | undefined): boolean => {
  return hasGateEntryPermission(userRole, GATE_ENTRY_PERMISSIONS.VIEW_ALL);
};

/**
 * Check if user can only view own passes (Faculty/Student)
 */
export const canViewOwnPasses = (userRole: string | undefined): boolean => {
  return hasGateEntryPermission(userRole, GATE_ENTRY_PERMISSIONS.VIEW_OWN);
};

/**
 * Check if user can verify passes (Admin/Guard)
 */
export const canVerifyPasses = (userRole: string | undefined): boolean => {
  return hasGateEntryPermission(userRole, GATE_ENTRY_PERMISSIONS.VERIFY);
};

/**
 * Check if user can view analytics (Admin only)
 */
export const canViewAnalytics = (userRole: string | undefined): boolean => {
  return hasGateEntryPermission(userRole, GATE_ENTRY_PERMISSIONS.ANALYTICS);
};

/**
 * Check if user can cancel a specific pass (context-dependent)
 * Before check-in: Only creator or admin
 * After check-in: Creator, admin, or guard
 */
export const canCancelPass = (user: User | undefined, pass: GatePass | undefined): boolean => {
  if (!user || !pass) return false;

  // Handle both string role and {name: string} role formats
  const roleStr = typeof user.role === 'string' ? user.role : (user.role as any)?.name || '';
  const role = roleStr.toLowerCase();
  const isAdmin = ['admin', 'superadmin'].includes(role);
  const isCreator = (pass.createdById || pass.creator?.id) === user.id;
  const isGuard = role === 'staff';
  const isCheckedIn = pass.passStatus === 'checked_in' || pass.status === 'checked_in';

  // Before check-in: Only creator or admin
  if (!isCheckedIn) {
    return isAdmin || isCreator;
  }

  // After check-in: Creator, admin, or guard
  return isAdmin || isCreator || isGuard;
};

/**
 * Check if user can extend a pass
 * Only creator or admin allowed
 */
export const canExtendPass = (user: User | undefined, pass: GatePass | undefined): boolean => {
  if (!user || !pass) return false;

  // Handle both string role and {name: string} role formats
  const roleStr = typeof user.role === 'string' ? user.role : (user.role as any)?.name || '';
  const role = roleStr.toLowerCase();
  const isAdmin = ['admin', 'superadmin'].includes(role);
  const isCreator = (pass.createdById || pass.creator?.id) === user.id;

  return isAdmin || isCreator;
};

/**
 * Get all permissions for a user role
 */
export const getRolePermissions = (userRole: string | undefined): string[] => {
  if (!userRole) return [];
  const role = userRole.toLowerCase();
  return ROLE_PERMISSIONS[role] || [];
};

/**
 * Check if user should see "All Passes" tab
 */
export const shouldShowAllPassesTab = (userRole: string | undefined): boolean => {
  return canViewAllPasses(userRole);
};

/**
 * Check if user should see "My Passes" tab
 */
export const shouldShowMyPassesTab = (userRole: string | undefined): boolean => {
  return canViewOwnPasses(userRole);
};

/**
 * Check if user should see "Verify" tab
 */
export const shouldShowVerifyTab = (userRole: string | undefined): boolean => {
  return canVerifyPasses(userRole);
};

/**
 * Check if user should see "Analytics" tab
 */
export const shouldShowAnalyticsTab = (userRole: string | undefined): boolean => {
  return canViewAnalytics(userRole);
};

/**
 * Get user-friendly role permission summary
 */
export const getPermissionSummary = (userRole: string | undefined): string => {
  if (!userRole) return 'No permissions';
  
  const role = userRole.toLowerCase();
  
  switch (role) {
    case 'admin':
    case 'superadmin':
      return 'Full access: Create, view all, verify, analytics, cancel, extend';
    case 'staff':
      return 'Guard access: Create, view all, verify, cancel (after check-in)';
    case 'faculty':
      return 'Faculty access: Create, view own passes, cancel own, extend own';
    case 'student':
      return 'Student access: Create, view own passes, cancel own, extend own';
    default:
      return 'Limited access';
  }
};
