'use client';

import { useMemo } from 'react';
import { useAuthStore } from '@/shared/auth/authStore';
import { useStaffDashboardSummary } from '@/shared/hooks/useUserContextQueries';

export const DPDP_MANAGE_PERMISSION = 'dpdp_manage';

function roleOf(user: { role?: { name?: string } | null; userType?: string } | null | undefined): string {
  return (user?.role?.name || user?.userType || '').toLowerCase();
}

/** Flat list of permission keys from the user object (strings or { name }). */
function flatUserPermissions(perms: unknown): string[] {
  if (!Array.isArray(perms)) return [];
  const out: string[] = [];
  for (const p of perms) {
    if (typeof p === 'string') out.push(p);
    else if (p && typeof p === 'object') {
      const obj = p as { name?: unknown; key?: unknown; permissions?: unknown };
      if (typeof obj.name === 'string') out.push(obj.name);
      if (typeof obj.key === 'string') out.push(obj.key);
      if (Array.isArray(obj.permissions)) obj.permissions.forEach((x) => typeof x === 'string' && out.push(x));
    }
  }
  return out;
}

export function useDpdpAccess() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = roleOf(user);
  const isSuperadmin = role === 'superadmin';
  const isAdmin = role === 'admin';
  // Department permissions (same source the navigation uses). Only fetch for non-admins.
  const { data: staffSummary, isLoading: permsLoading } = useStaffDashboardSummary({
    enabled: !!user && !isSuperadmin && !isAdmin,
  });

  const hasDpdpManage = useMemo(() => {
    const flat = flatUserPermissions(user?.permissions);
    if (flat.some((p) => p.toLowerCase() === DPDP_MANAGE_PERMISSION)) return true;
    return (staffSummary?.permissions || []).some((d) =>
      (d.permissions || []).some((p) => p.toLowerCase() === DPDP_MANAGE_PERMISSION),
    );
  }, [user, staffSummary]);

  return {
    user,
    isAuthenticated,
    role,
    isSuperadmin,
    isAdmin,
    canManage: isSuperadmin || isAdmin || hasDpdpManage,
    permsLoading: !isSuperadmin && !isAdmin && permsLoading,
  };
}
