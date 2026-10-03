import { useAuthStore } from '@/shared/auth/authStore';
import { useStaffDashboardSummary } from '@/shared/hooks/useUserContextQueries';

export const FINANCE_PERMISSION_KEYS = ['finance_view', 'finance_review', 'finance_approve', 'finance_budget_manage'] as const;
export type FinancePermissionKey = (typeof FINANCE_PERMISSION_KEYS)[number];

export interface FinancePermissions {
  canView: boolean;
  canReview: boolean;
  canApprove: boolean;
  /** Create cycles and set or distribute research budgets. */
  canManageBudget: boolean;
  /** Recording payment is allowed for reviewers and approvers. */
  canRecordPayment: boolean;
  isLoading: boolean;
}

/** Exact-key check over the grouped permission list returned by /dashboard/staff. */
export function hasFinanceKey(groups: Array<{ permissions?: string[] }> | undefined, key: FinancePermissionKey): boolean {
  return (groups || []).some((g) => (g.permissions || []).includes(key));
}

/** Tenant admins hold every finance permission by default (backend getDefaultPermissions). */
export function isFinanceAdmin(user: { userType?: string; role?: { name?: string } | null } | null | undefined): boolean {
  const role = user?.role?.name || user?.userType || '';
  return user?.userType === 'admin' || role === 'admin' || role === 'superadmin';
}

/**
 * What the signed-in user may do in the finance module. This only shows or hides controls;
 * the backend enforces every permission and the screens handle a 403 regardless.
 */
export function useFinancePermissions(): FinancePermissions {
  const user = useAuthStore((s) => s.user);
  const admin = isFinanceAdmin(user);
  const { data, isLoading } = useStaffDashboardSummary({ enabled: !!user && !admin });
  const groups = data?.permissions;
  const canReview = admin || hasFinanceKey(groups, 'finance_review');
  const canApprove = admin || hasFinanceKey(groups, 'finance_approve');
  const canManageBudget = admin || hasFinanceKey(groups, 'finance_budget_manage');
  const canView = admin || canReview || canApprove || canManageBudget || hasFinanceKey(groups, 'finance_view');
  return {
    canView,
    canReview,
    canApprove,
    canManageBudget,
    canRecordPayment: canReview || canApprove,
    isLoading: !admin && !!user && isLoading,
  };
}
