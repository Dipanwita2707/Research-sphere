import { DepartmentPermission } from './types';

export const hasPermission = (permissions: DepartmentPermission[], permissionName: string): boolean => {
  const variants = [permissionName, `drd_${permissionName}`, permissionName.replace('drd_', '')];
  for (const dept of permissions) {
    if (dept.permissions.some(p => variants.some(v => p.toLowerCase().includes(v.toLowerCase())))) return true;
  }
  return false;
};

export const hasDrdPermissions = (permissions: DepartmentPermission[]): boolean => {
  if (!permissions || permissions.length ===
   0) return false;
  const drdKeys = [
    'ipr_review', 'ipr_approve', 'ipr_assign_school', 'ipr_recommend',
    'research_review', 'research_approve', 'research_assign_school',
    'book_review', 'book_approve', 'book_assign_school',
    'applicant_analytics', 'drd_member_analytics',
    'ipr_applicant_analytics', 'research_applicant_analytics', 'book_applicant_analytics',
    'conference_applicant_analytics', 'grant_applicant_analytics',
    'drd_review', 'drd_approve', 'drd_recommend', 'drd_view_all',
    'view_all_ipr', 'review_ipr', 'approve_ipr', 'ipr',
  ];
  for (const dept of permissions) {
    const category = dept.category?.toLowerCase() || '';
    if (category.includes('drd') || category.includes('research') || category.includes('development') || category.includes('book')) return true;
    for (const perm of dept.permissions || []) {
      if (drdKeys.some(k => perm.toLowerCase().includes(k.toLowerCase()))) return true;
    }
  }
  return false;
};

export const hasFinancePermissions = (permissions: DepartmentPermission[]): boolean => {
  const keys = ['finance', 'incentive', 'payment'];
  for (const dept of permissions) {
    if (dept.permissions.some(p => keys.some(k => p.toLowerCase().includes(k)))) return true;
  }
  return false;
};

export const hasAnalyticsPermissions = (permissions: DepartmentPermission[]): boolean => {
  const analyticsKeys = [
    'applicant_analytics', 'drd_member_analytics',
    'ipr_applicant_analytics', 'research_applicant_analytics',
    'book_applicant_analytics', 'conference_applicant_analytics',
    'grant_applicant_analytics',
  ];
  for (const dept of permissions) {
    for (const perm of dept.permissions || []) {
      if (analyticsKeys.some(k => perm.toLowerCase().includes(k))) return true;
    }
  }
  return false;
};
