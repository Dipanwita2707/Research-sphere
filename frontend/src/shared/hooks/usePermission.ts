import { useMemo, useCallback } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';

/**
 * usePermission Hook
 * Check if the current user has specific permissions
 * 
 * @example
 * const { hasPermission, hasAnyPermission, hasAllPermissions, canAccess } = usePermission();
 * 
 * if (hasPermission('ipr_file_new')) {
 *   // Show IPR filing button
 * }
 * 
 * if (hasAnyPermission(['research_review', 'research_approve'])) {
 *   // Show review section
 * }
 */
export function usePermission() {
  const { user } = useAuthStore();

  // Get user type (admin, staff, faculty, student)
  const userType = useMemo(() => user?.userType || null, [user]);
  
  // Get role name if available
  const roleName = useMemo(() => user?.role?.name || null, [user]);

  // Get the permissions array from user
  const permissions = useMemo(() => {
    if (!user?.permissions) return [];
    if (Array.isArray(user.permissions)) {
      // Handle if permissions is an array of objects with 'name' property
      return user.permissions.map((p: { name?: string } | string) => 
        typeof p ===
   'string' ? p : p.name || ''
      ).filter(Boolean);
    }
    return [];
  }, [user]);

  // Check if user has a specific permission
  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;
      
      // Admin has all permissions
      if (userType ===
   'admin') return true;
      
      return permissions.includes(permission);
    },
    [user, userType, permissions]
  );

  // Check if user has ANY of the specified permissions
  const hasAnyPermission = useCallback(
    (permissionList: string[]): boolean => {
      if (!user) return false;
      
      // Admin has all permissions
      if (userType ===
   'admin') return true;
      
      return permissionList.some(permission => permissions.includes(permission));
    },
    [user, userType, permissions]
  );

  // Check if user has ALL of the specified permissions
  const hasAllPermissions = useCallback(
    (permissionList: string[]): boolean => {
      if (!user) return false;
      
      // Admin has all permissions
      if (userType ===
   'admin') return true;
      
      return permissionList.every(permission => permissions.includes(permission));
    },
    [user, userType, permissions]
  );

  // Check if user has a specific role or user type
  const hasRole = useCallback(
    (role: string | string[]): boolean => {
      if (!user) return false;
      
      const rolesToCheck = Array.isArray(role) ? role : [role];
      
      // Check both userType and role.name
      return rolesToCheck.some(r => 
        userType ===
   r || roleName ===
   r
      );
    },
    [user, userType, roleName]
  );

  // Check if user can access a specific resource
  // Combines role and permission checks
  const canAccess = useCallback(
    (options: {
      permissions?: string[];
      roles?: string[];
      requireAll?: boolean;
    }): boolean => {
      if (!user) return false;
      
      const { permissions: requiredPermissions, roles, requireAll = false } = options;
      
      // Check roles first
      if (roles && roles.length > 0) {
        const hasMatchingRole = roles.some(r => 
          userType ===
   r || roleName ===
   r
        );
        if (!hasMatchingRole) {
          return false;
        }
      }
      
      // Check permissions
      if (requiredPermissions && requiredPermissions.length > 0) {
        if (requireAll) {
          return hasAllPermissions(requiredPermissions);
        }
        return hasAnyPermission(requiredPermissions);
      }
      
      return true;
    },
    [user, userType, roleName, hasAllPermissions, hasAnyPermission]
  );

  // Check if user is a DRD member (any DRD role)
  const isDRD = useMemo(() => {
    if (!user) return false;
    return ['drd_member', 'drd_dean'].includes(roleName || '') || 
           ['drd_member', 'drd_dean'].includes(userType || '');
  }, [user, roleName, userType]);

  // Check if user is an admin
  const isAdmin = useMemo(() => {
    if (!user) return false;
    return userType ===
   'admin';
  }, [user, userType]);

  // Check if user is faculty
  const isFaculty = useMemo(() => {
    if (!user) return false;
    return userType ===
   'faculty';
  }, [user, userType]);

  // Check if user is a student
  const isStudent = useMemo(() => {
    if (!user) return false;
    return userType ===
   'student';
  }, [user, userType]);

  return {
    // Permission checks
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    canAccess,
    
    // Role shortcuts
    isDRD,
    isAdmin,
    isFaculty,
    isStudent,
    
    // Raw data
    permissions,
    user,
    userType,
    roleName,
  };
}
