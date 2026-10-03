/**
 * Who may see and change research budgets.
 *
 *   finance_view / finance_review / finance_approve / finance_budget_manage (and tenant admins,
 *   who hold them by default) → the whole tree, payout lines, notes, history.
 *   DRD applicant-analytics holders (applicant_analytics or a per-category variant)
 *       → read-only, limited to the schools in their analytics scope (a department assignment
 *         shows that department's school). No unassigned lines, no budget notes.
 *   finance_budget_manage (or admin) → create and edit cycles, the budget and allocations.
 *
 * Sets req.budgetScope ({ all: true } | { all: false, schoolIds }) and req.budgetCanEdit.
 */
const prisma = require('../../../shared/config/database');
const { getDefaultPermissions, getPermissionKeyVariants } = require('../../../shared/config/permissions.config');
const logger = require('../../../shared/utils/logger');

const FINANCE_VIEW_KEYS = ['finance_view', 'finance_review', 'finance_approve', 'finance_budget_manage'];
const FINANCE_EDIT_KEYS = ['finance_budget_manage'];
const DRD_ANALYTICS_KEYS = [
  'applicant_analytics',
  'research_applicant_analytics',
  'book_applicant_analytics',
  'conference_applicant_analytics',
  'ipr_applicant_analytics',
  'grant_applicant_analytics',
];
const DRD_SCHOOL_FIELDS = [
  'assignedSchoolIds',
  'assignedResearchAnalyticsSchoolIds',
  'assignedBookAnalyticsSchoolIds',
  'assignedConferenceAnalyticsSchoolIds',
  'assignedIprAnalyticsSchoolIds',
  'assignedGrantAnalyticsSchoolIds',
];
const DRD_DEPARTMENT_FIELDS = [
  'assignedResearchAnalyticsDepartmentIds',
  'assignedBookAnalyticsDepartmentIds',
  'assignedConferenceAnalyticsDepartmentIds',
  'assignedIprAnalyticsDepartmentIds',
  'assignedGrantAnalyticsDepartmentIds',
];

/** Same rule as checkAnyPermission: role defaults, then explicit central-department grants. */
function holdsAny(user, keys) {
  if (!user) return false;
  const variants = [...new Set(keys.flatMap((k) => getPermissionKeyVariants(k)))];
  const defaults = getDefaultPermissions(user.role) || {};
  if (variants.some((k) => defaults[k] === true)) return true;
  return (user.centralDeptPermissions || []).some((p) => p.permissions && variants.some((k) => p.permissions[k] === true));
}

const deny = (res, message = 'You need the View Incentive Payouts permission to see research budgets') =>
  res.status(403).json({ success: false, code: 'FORBIDDEN', message });

/** Resolve the DRD analytics school scope, or null when the user has none. */
async function drdSchoolScope(user) {
  // Loaded lazily: the analytics service pulls in caches the finance module does not otherwise need.
  const drdAnalytics = require('../../drd-analytics/services/drdAnalytics.service');
  let access;
  try {
    access = await drdAnalytics._resolveAccess(user, 'applicant_analytics', {
      permissionKeys: DRD_ANALYTICS_KEYS,
      schoolFields: DRD_SCHOOL_FIELDS,
      departmentFields: DRD_DEPARTMENT_FIELDS,
    });
  } catch (e) {
    if (e.statusCode === 403) return null;
    throw e;
  }
  const schoolIds = new Set(access.allowedSchoolIds || []);
  const deptIds = (access.explicitDepartmentIds || []).filter(Boolean);
  if (deptIds.length) {
    const depts = await prisma.department.findMany({ where: { id: { in: deptIds } }, select: { facultyId: true } });
    depts.forEach((d) => schoolIds.add(d.facultyId));
  }
  return [...schoolIds];
}

async function budgetViewAccess(req, res, next) {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, message: 'Authentication required' });
    if (holdsAny(user, FINANCE_VIEW_KEYS)) {
      req.budgetScope = { all: true };
      req.budgetCanEdit = holdsAny(user, FINANCE_EDIT_KEYS);
      return next();
    }
    const schoolIds = await drdSchoolScope(user);
    if (!schoolIds) return deny(res);
    req.budgetScope = { all: false, schoolIds };
    req.budgetCanEdit = false;
    return next();
  } catch (error) {
    logger.error('Budget access check failed', error);
    return res.status(500).json({ success: false, message: 'Permission check failed' });
  }
}

/** Finance-only views (payout lines behind the figures are already finance data). */
function requireFinanceScope(req, res, next) {
  if (req.budgetScope?.all) return next();
  return deny(res, 'This view is limited to finance users');
}

function requireBudgetEdit(req, res, next) {
  if (req.budgetCanEdit) return next();
  return deny(res, 'Changing incentive cycles and research budgets needs the Manage Research Budget & Cycles (finance_budget_manage) permission');
}

module.exports = { budgetViewAccess, requireBudgetEdit, requireFinanceScope, holdsAny, DRD_ANALYTICS_KEYS };
