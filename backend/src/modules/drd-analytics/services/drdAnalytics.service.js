const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');
const {
  getSupportedCentralDeptAnalyticsScopeFields,
  withSupportedAnalyticsScopeFields,
} = require('../../../shared/utils/centralDeptAnalyticsScopeSupport');

const APPLICANT_ANALYTICS = 'applicant_analytics';
const DRD_MEMBER_ANALYTICS = 'drd_member_analytics';
const APPLICANT_CATEGORY_CONFIG = {
  research: {
    permissionKeys: ['research_applicant_analytics', APPLICANT_ANALYTICS],
    schoolFields: ['assignedResearchAnalyticsSchoolIds', 'assignedSchoolIds'],
    departmentFields: ['assignedResearchAnalyticsDepartmentIds'],
    breakdownKey: 'research',
  },
  book: {
    permissionKeys: ['book_applicant_analytics', APPLICANT_ANALYTICS],
    schoolFields: ['assignedBookAnalyticsSchoolIds', 'assignedSchoolIds'],
    departmentFields: ['assignedBookAnalyticsDepartmentIds'],
    breakdownKey: 'book',
  },
  conference: {
    permissionKeys: ['conference_applicant_analytics', APPLICANT_ANALYTICS],
    schoolFields: ['assignedConferenceAnalyticsSchoolIds', 'assignedSchoolIds'],
    departmentFields: ['assignedConferenceAnalyticsDepartmentIds'],
    breakdownKey: 'conference',
  },
  ipr: {
    permissionKeys: ['ipr_applicant_analytics', APPLICANT_ANALYTICS],
    schoolFields: ['assignedIprAnalyticsSchoolIds', 'assignedSchoolIds'],
    departmentFields: ['assignedIprAnalyticsDepartmentIds'],
    breakdownKey: 'ipr',
  },
  grants: {
    permissionKeys: ['grant_applicant_analytics', APPLICANT_ANALYTICS],
    schoolFields: ['assignedGrantAnalyticsSchoolIds', 'assignedSchoolIds'],
    departmentFields: ['assignedGrantAnalyticsDepartmentIds'],
    breakdownKey: 'grants',
  },
};
const APPLICANT_CATEGORIES = Object.keys(APPLICANT_CATEGORY_CONFIG);
const SUPERVISOR_PERMISSIONS = [
  'ipr_approve',
  'research_approve',
  'grant_approve',
  'book_approve',
  'conference_approve',
  'ipr_assign_school',
  'research_assign_school',
  'grant_assign_school',
  'book_assign_school',
  'conference_assign_school',
];

// Maps CentralDepartmentPermission field names → role.permissions.analyticsScope category key.
// Role analyticsScope is stored as { research: { schools, departments }, ipr: {...}, ... }
const SCHOOL_FIELD_TO_ANALYTICS_CATEGORY = {
  assignedResearchAnalyticsSchoolIds: 'research',
  assignedBookAnalyticsSchoolIds: 'book',
  assignedConferenceAnalyticsSchoolIds: 'conference',
  assignedIprAnalyticsSchoolIds: 'ipr',
  assignedGrantAnalyticsSchoolIds: 'grants',
  // assignedSchoolIds / assignedDrdMemberAnalyticsSchoolIds → union all categories (handled in code)
};
const DEPT_FIELD_TO_ANALYTICS_CATEGORY = {
  assignedResearchAnalyticsDepartmentIds: 'research',
  assignedBookAnalyticsDepartmentIds: 'book',
  assignedConferenceAnalyticsDepartmentIds: 'conference',
  assignedIprAnalyticsDepartmentIds: 'ipr',
  assignedGrantAnalyticsDepartmentIds: 'grants',
  assignedDrdMemberAnalyticsDepartmentIds: null, // covered by union path
};

const IPR_APPROVED_STATUSES = new Set([
  'approved',
  'drd_approved',
  'drd_head_approved',
  'dean_approved',
  'submitted_to_govt',
  'govt_application_filed',
  'published',
  'completed',
  'incentives_processed',
]);
const RESEARCH_APPROVED_STATUSES = new Set(['approved', 'completed']);
const GRANT_APPROVED_STATUSES = new Set(['approved', 'completed']);
const TERMINAL_REVIEW_DECISIONS = new Set([
  'approved',
  'rejected',
  'changes_required',
  'recommended',
  'recommend',
]);

function parseDate(value, fallback) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

// Parse the "to" date and extend it to the very end of the day (23:59:59.999 UTC)
// so that records submitted on that calendar day are always included.
function parseEndDate(value, fallback) {
  const date = parseDate(value, fallback);
  date.setUTCHours(23, 59, 59, 999);
  return date;
}

function toIsoDate(value) {
  return value.toISOString().slice(0, 10);
}

function hasPermission(records = [], permissionKey) {
  return records.some((record) => record?.permissions?.[permissionKey] === true);
}

function hasAnyPermission(records = [], permissionKeys = []) {
  return records.some((record) =>
    permissionKeys.some((permissionKey) => record?.permissions?.[permissionKey] === true)
  );
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function buildScopeLevel(explicitSchoolIds, explicitDepartmentIds, isUniversity = false) {
  if (isUniversity) return 'university';
  if (explicitSchoolIds.length > 1) return 'multi_school';
  if (explicitSchoolIds.length === 1 && explicitDepartmentIds.length > 0) return 'mixed';
  if (explicitSchoolIds.length === 1) return 'school';
  if (explicitDepartmentIds.length > 0) return 'department';
  return 'department';
}

function getRecordDate(record) {
  return record.submittedAt || record.createdAt || null;
}

function getViewerName(user) {
  return user?.employeeDetails?.displayName || user?.uid || 'Unknown';
}

function createScopeWhere(access, schoolId, departmentId) {
  if (access.isUniversity) {
    const where = {};
    if (schoolId) where.schoolId = schoolId;
    if (departmentId) where.departmentId = departmentId;
    return where;
  }

  // Build the user's base access scope as an OR of what they're allowed to see.
  // This is separate from any drill-down filter (schoolId/departmentId) the caller
  // is requesting — those are ANDed on top of the access scope so they narrow the
  // result rather than bypass it.
  const accessOrConditions = [];
  if (access.allowedSchoolIds.length > 0) {
    accessOrConditions.push({ schoolId: { in: access.allowedSchoolIds } });
  }
  if (access.allowedDepartmentIds.length > 0) {
    accessOrConditions.push({ departmentId: { in: access.allowedDepartmentIds } });
  }

  if (accessOrConditions.length === 0) {
    // User has permission but no school/dept scope assigned → return zero results.
    // Use an empty `in` array; Prisma short-circuits this to [] without a DB round-trip
    // and it is also safe as a nested relation filter (no UUID parsing error).
    return { id: { in: [] } };
  }

  // Build the access scope (OR)
  const accessScope =
    accessOrConditions.length === 1 ? accessOrConditions[0] : { OR: accessOrConditions };

  // Apply drill-down filters as AND conditions on top of the access scope.
  // Without this, e.g. a department condition would match records from ALL schools,
  // bypassing any school drill-down the caller requested.
  const drillDown = [];
  if (schoolId) drillDown.push({ schoolId });
  if (departmentId) drillDown.push({ departmentId });

  if (drillDown.length === 0) return accessScope;
  return { AND: [accessScope, ...drillDown] };
}

function buildMeta(type, access, from, to) {
  return {
    analyticsType: type,
    scopeApplied: {
      schoolIds: access.allowedSchoolIds,
      departmentIds: access.allowedDepartmentIds,
      scopeLevel: access.scopeLevel,
      resolution: 'union',
    },
    timeRange: {
      from: toIsoDate(from),
      to: toIsoDate(to),
    },
  };
}

function combineAccess(accessList = []) {
  const available = accessList.filter(Boolean);
  const schoolIds = unique(available.flatMap((access) => access.allowedSchoolIds || []));
  const departmentIds = unique(available.flatMap((access) => access.allowedDepartmentIds || []));
  const isUniversity = available.some((access) => access.isUniversity);
  const explicitSchoolIds = unique(available.flatMap((access) => access.explicitSchoolIds || []));
  const explicitDepartmentIds = unique(available.flatMap((access) => access.explicitDepartmentIds || []));

  return {
    isUniversity,
    explicitSchoolIds,
    explicitDepartmentIds,
    allowedSchoolIds: schoolIds,
    allowedDepartmentIds: departmentIds,
    scopeLevel: buildScopeLevel(explicitSchoolIds, explicitDepartmentIds, isUniversity),
    canViewAllReviewers: available.some((access) => access.canViewAllReviewers),
  };
}

function withDateScope(scopeWhere, from, to, extraConditions = []) {
  return {
    AND: [
      scopeWhere,
      // Use submittedAt only (not OR with createdAt) so Postgres can use the composite
      // submittedAt indexes without falling back to a bitmap-OR / seq-scan on createdAt.
      // Drafts (submittedAt = null) are intentionally excluded from analytics.
      { submittedAt: { gte: from, lte: to } },
      ...extraConditions,
    ],
  };
}

function personSeed(record, category) {
  const schoolName = record.school?.shortName || record.school?.facultyName || 'Unassigned';
  const departmentName =
    record.department?.shortName || record.department?.departmentName || 'Unassigned';
  return {
    personId: record.applicantUserId || `${category}-${record.id}`,
    applicantUid: record.applicantUser?.uid || null,
    applicantName:
      record.applicantUser?.employeeDetails?.displayName ||
      record.applicantUser?.studentLogin?.displayName ||
      record.applicantUser?.uid ||
      'Unknown Applicant',
    schoolId: record.schoolId || null,
    schoolName,
    departmentId: record.departmentId || null,
    departmentName,
    filingCounts: {
      research: 0,
      book: 0,
      conference: 0,
      ipr: 0,
      grants: 0,
    },
    approvedCount: 0,
    totalIncentive: 0,
    totalApplications: 0,
  };
}

function schoolSeed(record) {
  return {
    schoolId: record.schoolId || 'unassigned',
    schoolName: record.school?.shortName || record.school?.facultyName || 'Unassigned',
    totalApplications: 0,
    totalApproved: 0,
    totalIncentive: 0,
    filingCounts: { research: 0, book: 0, conference: 0, ipr: 0, grants: 0 },
    approvedCounts: { research: 0, book: 0, conference: 0, ipr: 0, grants: 0 },
  };
}

function departmentSeed(record) {
  return {
    departmentId: record.departmentId || 'unassigned',
    departmentName: record.department?.shortName || record.department?.departmentName || 'Unassigned',
    schoolId: record.schoolId || null,
    schoolName: record.school?.shortName || record.school?.facultyName || 'Unassigned',
    totalApplicants: 0,
    totalApplications: 0,
    totalApproved: 0,
    totalIncentive: 0,
    filingCounts: { research: 0, book: 0, conference: 0, ipr: 0, grants: 0 },
    approvedCounts: { research: 0, book: 0, conference: 0, ipr: 0, grants: 0 },
  };
}

function addApplicantRecord({ personMap, schoolMap, departmentMap, record, category, isApproved, incentive }) {
  const personKey = record.applicantUserId || `${category}-${record.id}`;
  if (!personMap.has(personKey)) {
    personMap.set(personKey, personSeed(record, category));
  }
  if (!schoolMap.has(record.schoolId || 'unassigned')) {
    schoolMap.set(record.schoolId || 'unassigned', schoolSeed(record));
  }
  if (!departmentMap.has(record.departmentId || 'unassigned')) {
    departmentMap.set(record.departmentId || 'unassigned', departmentSeed(record));
  }

  const person = personMap.get(personKey);
  const school = schoolMap.get(record.schoolId || 'unassigned');
  const department = departmentMap.get(record.departmentId || 'unassigned');

  person.totalApplications += 1;
  person.filingCounts[category] += 1;
  school.totalApplications += 1;
  school.filingCounts[category] += 1;
  department.totalApplications += 1;
  department.filingCounts[category] += 1;

  if (isApproved) {
    person.approvedCount += 1;
    person.totalIncentive += incentive;
    school.totalApproved += 1;
    school.totalIncentive += incentive;
    school.approvedCounts[category] += 1;
    department.totalApproved += 1;
    department.totalIncentive += incentive;
    department.approvedCounts[category] += 1;
  }
}

function avgHours(values) {
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function buildMonthKey(value) {
  const date = new Date(value);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

function buildMonthLabel(key) {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
}

function createMonthlyBucketMap(from, to, createValues) {
  const map = new Map();
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);

  while (cursor <= end) {
    const key = buildMonthKey(cursor);
    map.set(key, {
      month: key,
      label: buildMonthLabel(key),
      ...createValues(),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return map;
}

function updateMonthlyBucket(bucketMap, value, updater) {
  if (!value) return;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return;
  const bucket = bucketMap.get(buildMonthKey(date));
  if (!bucket) return;
  updater(bucket);
}

function getTrackerUserDisplayName(user) {
  return (
    user?.employeeDetails?.displayName ||
    user?.studentLogin?.displayName ||
    user?.uid ||
    'Unknown'
  );
}

function getTrackerSchoolName(tracker) {
  return tracker?.school?.shortName || tracker?.school?.facultyName || 'Unassigned';
}

function getTrackerDepartmentName(tracker) {
  return (
    tracker?.department?.shortName ||
    tracker?.department?.departmentName ||
    'Unassigned'
  );
}

function mapTrackerRecord(record) {
  return {
    id: record.id,
    trackingNumber: record.trackingNumber,
    userId: record.userId,
    userName: getTrackerUserDisplayName(record.user),
    title: record.title,
    publicationType: record.publicationType,
    currentStatus: record.currentStatus,
    schoolId: record.schoolId || null,
    schoolName: getTrackerSchoolName(record),
    departmentId: record.departmentId || null,
    departmentName: getTrackerDepartmentName(record),
    expectedCompletionDate: record.expectedCompletionDate,
    actualCompletionDate: record.actualCompletionDate,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    latestStatusChangedAt:
      record.statusHistory?.[0]?.changedAt || record.updatedAt || record.createdAt,
    researchContribution: record.researchContribution
      ? {
          id: record.researchContribution.id,
          applicationNumber: record.researchContribution.applicationNumber || null,
          status: record.researchContribution.status,
          incentiveAmount: record.researchContribution.incentiveAmount ?? null,
          pointsAwarded: record.researchContribution.pointsAwarded ?? null,
        }
      : null,
  };
}

function buildApplicantMonthlyTrend({ researchRows, iprRows, grantRows, from, to }) {
  const bucketMap = createMonthlyBucketMap(from, to, () => ({
    totalApplications: 0,
    research: 0,
    book: 0,
    conference: 0,
    ipr: 0,
    grants: 0,
    approvedCount: 0,
    totalIncentive: 0,
  }));

  const consumeApplicantRow = (row, category, approvedStatuses) => {
    const recordDate = getRecordDate(row);
    updateMonthlyBucket(bucketMap, recordDate, (bucket) => {
      bucket.totalApplications += 1;
      bucket[category] += 1;
      if (approvedStatuses.has(row.status)) {
        bucket.approvedCount += 1;
        bucket.totalIncentive += Number(row.incentiveAmount || 0);
      }
    });
  };

  (researchRows || []).forEach((row) =>
    consumeApplicantRow(row, row.__analyticsCategory || 'research', RESEARCH_APPROVED_STATUSES)
  );
  iprRows.forEach((row) => consumeApplicantRow(row, 'ipr', IPR_APPROVED_STATUSES));
  grantRows.forEach((row) => consumeApplicantRow(row, 'grants', GRANT_APPROVED_STATUSES));

  return [...bucketMap.values()].map((bucket) => ({
    ...bucket,
    totalIncentive: Number(bucket.totalIncentive.toFixed(2)),
  }));
}

function buildReviewerMonthlyTrend({
  assignedResearch,
  assignedIpr,
  assignedGrants,
  researchReviews,
  iprReviews,
  grantReviews,
  from,
  to,
}) {
  const bucketMap = createMonthlyBucketMap(from, to, () => ({
    assigned: 0,
    responded: 0,
    completed: 0,
    research: 0,
    book: 0,
    conference: 0,
    ipr: 0,
    grants: 0,
  }));

  const assignedSeen = new Set();
  const firstResponses = new Map();
  const firstCompletions = new Map();

  const registerAssigned = (application, category) => {
    if (!application?.id) return;
    const key = `${category}:${application.id}`;
    if (assignedSeen.has(key)) return;
    assignedSeen.add(key);
    updateMonthlyBucket(bucketMap, getRecordDate(application), (bucket) => {
      bucket.assigned += 1;
      bucket[category] += 1;
    });
  };

  const registerReview = (review, category, application) => {
    if (!application?.id || !review?.reviewedAt) return;
    const key = `${category}:${application.id}`;
    const reviewedAt = new Date(review.reviewedAt);
    if (Number.isNaN(reviewedAt.getTime())) return;

    if (!firstResponses.has(key) || reviewedAt < firstResponses.get(key)) {
      firstResponses.set(key, reviewedAt);
    }

    if (TERMINAL_REVIEW_DECISIONS.has(review.decision)) {
      if (!firstCompletions.has(key) || reviewedAt < firstCompletions.get(key)) {
        firstCompletions.set(key, reviewedAt);
      }
    }
  };

  assignedResearch.forEach((application) => registerAssigned(application, 'research'));
  assignedIpr.forEach((application) => registerAssigned(application, 'ipr'));
  assignedGrants.forEach((application) => registerAssigned(application, 'grants'));

  researchReviews.forEach((review) => registerReview(review, 'research', review.researchContribution));
  iprReviews.forEach((review) => registerReview(review, 'ipr', review.iprApplication));
  grantReviews.forEach((review) => registerReview(review, 'grants', review.grantApplication));

  firstResponses.forEach((value) => {
    updateMonthlyBucket(bucketMap, value, (bucket) => {
      bucket.responded += 1;
    });
  });

  firstCompletions.forEach((value) => {
    updateMonthlyBucket(bucketMap, value, (bucket) => {
      bucket.completed += 1;
    });
  });

  return [...bucketMap.values()];
}

// ─── Cross-request access resolution cache ──────────────────────────────────
// Caches the fully-resolved access scope per (user, permissionKeys, schoolFields,
// departmentFields) for 5 minutes. Eliminates repeated DB roundtrips for
// centralDeptPermission / departmentPermission / role on every analytics request.
const _accessResultCache = new Map(); // key → { value, expiresAt }
const ACCESS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function _buildAccessCacheKey(userId, permissionKeys, schoolFields, departmentFields) {
  return `${userId}|${[...permissionKeys].sort().join(',')}|${[...schoolFields].sort().join(',')}|${[...departmentFields].sort().join(',')}`;
}

function _getAccessCached(key) {
  const entry = _accessResultCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _accessResultCache.delete(key);
    return null;
  }
  return entry.value;
}

function _setAccessCached(key, value) {
  // Evict stale entries when cache grows (prevents memory leak with many concurrent users)
  if (_accessResultCache.size >= 500) {
    const now = Date.now();
    for (const [k, v] of _accessResultCache) {
      if (now > v.expiresAt) _accessResultCache.delete(k);
    }
  }
  _accessResultCache.set(key, { value, expiresAt: Date.now() + ACCESS_CACHE_TTL_MS });
}

class DrdAnalyticsService {
  /**
   * Fetch every piece of user permission data needed for access resolution — once.
   * Pass the returned object as `_base` to `_resolveAccess` /
   * `_resolveApplicantAccessByCategory` so the same DB rows are never re-queried
   * across multiple per-category resolution calls within the same request.
   */
  async _fetchUserBasePermissions(user) {
    const supportedAnalyticsScopeFields = await getSupportedCentralDeptAnalyticsScopeFields(prisma);

    const [directCentralPerms, directDepartmentPerms] = await Promise.all([
      prisma.centralDepartmentPermission.findMany({
        where: { userId: user.id, isActive: true },
        select: withSupportedAnalyticsScopeFields({
          permissions: true,
          assignedSchoolIds: true,
          assignedResearchSchoolIds: true,
          assignedBookSchoolIds: true,
          assignedConferenceSchoolIds: true,
          assignedGrantSchoolIds: true,
        }, supportedAnalyticsScopeFields),
      }),
      prisma.departmentPermission.findMany({
        where: { userId: user.id, isActive: true },
        include: {
          department: {
            select: {
              id: true,
              facultyId: true,
            },
          },
        },
      }),
    ]);

    // Fetch role analytics scopes once
    let assignedRoles = [];
    if (user.assignedRoleIds && user.assignedRoleIds.length > 0) {
      assignedRoles = await prisma.role.findMany({
        where: { id: { in: user.assignedRoleIds }, isActive: true },
        select: { permissions: true },
      });
    }

    // For admin users pre-fetch all schools + departments to avoid re-querying per category
    let adminDepts = null;
    let adminSchools = null;
    if (user.role === 'admin') {
      [adminDepts, adminSchools] = await Promise.all([
        prisma.department.findMany({ where: { isActive: true }, select: { id: true } }),
        prisma.facultySchoolList.findMany({ where: { isActive: true }, select: { id: true } }),
      ]);
    }

    return { directCentralPerms, directDepartmentPerms, assignedRoles, adminDepts, adminSchools };
  }

  /**
   * Resolve a user's analytics access scope.
   * Pass `_base` (from `_fetchUserBasePermissions`) to skip re-fetching permission
   * rows that are identical across all categories in a single request.
   */
  async _resolveAccess(user, analyticsPermission, options = {}, _base = null) {
    const permissionKeys = options.permissionKeys || [analyticsPermission];
    const schoolFields = options.schoolFields || ['assignedSchoolIds'];
    const departmentFields = options.departmentFields || [];

    // Fast-path: return cached result if available (avoids ALL DB queries on warm requests)
    const cacheKey = _buildAccessCacheKey(user.id, permissionKeys, schoolFields, departmentFields);
    const cachedAccess = _getAccessCached(cacheKey);
    if (cachedAccess) return cachedAccess;

    // Reuse pre-fetched base permissions if provided, otherwise fetch them now
    const { directCentralPerms, directDepartmentPerms, assignedRoles, adminDepts, adminSchools } =
      _base || await this._fetchUserBasePermissions(user);

    const mergedCentralPerms = user.centralDeptPermissions || [];
    const mergedDepartmentPerms = user.schoolDeptPermissions || [];
    const canView =
      user.role === 'admin' ||
      hasAnyPermission(mergedCentralPerms, permissionKeys) ||
      hasAnyPermission(mergedDepartmentPerms, permissionKeys) ||
      hasAnyPermission(directCentralPerms, permissionKeys) ||
      hasAnyPermission(directDepartmentPerms, permissionKeys);

    if (!canView) {
      const error = new Error('You do not have permission to view this analytics section');
      error.statusCode = 403;
      throw error;
    }

    if (user.role === 'admin') {
      // Use pre-fetched admin data when available
      const allDepartments = adminDepts || await prisma.department.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      const allSchools = adminSchools || await prisma.facultySchoolList.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      const adminResult = {
        isUniversity: true,
        explicitSchoolIds: allSchools.map((school) => school.id),
        explicitDepartmentIds: allDepartments.map((department) => department.id),
        allowedSchoolIds: allSchools.map((school) => school.id),
        allowedDepartmentIds: allDepartments.map((department) => department.id),
        scopeLevel: 'university',
        canViewAllReviewers: true,
      };
      _setAccessCached(cacheKey, adminResult);
      return adminResult;
    }

    const explicitSchoolIds = [];
    const directCentralDeptIds = [];
    directCentralPerms.forEach((permission) => {
      if (!permissionKeys.some((permissionKey) => permission.permissions?.[permissionKey] === true)) return;
      schoolFields.forEach((field) => {
        if (!(field in permission)) return;
        explicitSchoolIds.push(...(permission[field] || []));
      });
      departmentFields.forEach((field) => {
        if (!(field in permission)) return;
        directCentralDeptIds.push(...(permission[field] || []));
      });
    });

    // Extract analytics scope from pre-fetched assigned roles (no extra DB query)
    // Role analyticsScope format: { research: { schools: [...], departments: [...] }, ipr: {...}, ... }
    assignedRoles.forEach((role) => {
      const rolePerms = role.permissions || {};
      if (!permissionKeys.some((key) => rolePerms.centralDeptPermissions?.[key] === true)) return;
      const analyticsScope = rolePerms.analyticsScope || {};
      schoolFields.forEach((field) => {
        const category = SCHOOL_FIELD_TO_ANALYTICS_CATEGORY[field];
        if (category) {
          // e.g. field 'assignedResearchAnalyticsSchoolIds' → category 'research'
          explicitSchoolIds.push(...(analyticsScope[category]?.schools || []));
          directCentralDeptIds.push(...(analyticsScope[category]?.departments || []));
        } else if (field === 'assignedSchoolIds' || field === 'assignedDrdMemberAnalyticsSchoolIds') {
          // Legacy / DRD-member scope: union all category schools & depts
          Object.values(analyticsScope).forEach((catScope) => {
            if (Array.isArray(catScope?.schools)) explicitSchoolIds.push(...catScope.schools);
            if (Array.isArray(catScope?.departments)) directCentralDeptIds.push(...catScope.departments);
          });
        }
      });
      departmentFields.forEach((field) => {
        const category = DEPT_FIELD_TO_ANALYTICS_CATEGORY[field];
        if (category) directCentralDeptIds.push(...(analyticsScope[category]?.departments || []));
      });
    });

    const explicitDepartmentIds = [
      ...directDepartmentPerms
        .filter((permission) => permissionKeys.some((permissionKey) => permission.permissions?.[permissionKey] === true))
        .map((permission) => permission.departmentId),
      ...directCentralDeptIds,
    ];

    const schoolIds = unique(explicitSchoolIds);
    const departmentIds = unique(explicitDepartmentIds);

    let expandedDepartmentIds = [...departmentIds];
    if (schoolIds.length > 0) {
      const schoolDepartments = await prisma.department.findMany({
        where: {
          facultyId: { in: schoolIds },
          isActive: true,
        },
        select: { id: true },
      });
      expandedDepartmentIds.push(...schoolDepartments.map((department) => department.id));
    }

    expandedDepartmentIds = unique(expandedDepartmentIds);
    const scopeLevel = buildScopeLevel(schoolIds, departmentIds, false);

    const nonAdminResult = {
      isUniversity: false,
      explicitSchoolIds: schoolIds,
      explicitDepartmentIds: departmentIds,
      allowedSchoolIds: schoolIds,
      allowedDepartmentIds: expandedDepartmentIds,
      scopeLevel,
      canViewAllReviewers:
        user.role === 'admin' || hasAnyPermission(mergedCentralPerms, SUPERVISOR_PERMISSIONS),
    };
    _setAccessCached(cacheKey, nonAdminResult);
    return nonAdminResult;
  }

  async _resolveApplicantAccessByCategory(user, category, _base = null) {
    const config = APPLICANT_CATEGORY_CONFIG[category];
    if (!config) {
      const error = new Error(`Unsupported applicant analytics category: ${category}`);
      error.statusCode = 400;
      throw error;
    }

    return this._resolveAccess(user, APPLICANT_ANALYTICS, {
      permissionKeys: config.permissionKeys,
      schoolFields: config.schoolFields,
      departmentFields: config.departmentFields || [],
    }, _base);
  }

  _researchPublicationWhere(category) {
    if (category === 'research') return { publicationType: 'research_paper' };
    if (category === 'book') return { publicationType: { in: ['book', 'book_chapter'] } };
    if (category === 'conference') return { publicationType: 'conference_paper' };
    return {};
  }

  /**
   * Compute university-wide average per-applicant filing counts.
   * Cached for 5 minutes to avoid repeating expensive aggregate queries.
   */
  async _computeUniversityAverage(from, to) {
    const cacheKey = `drd:uniAvg:${toIsoDate(from)}:${toIsoDate(to)}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const dateRange = { submittedAt: { gte: from, lte: to } };

    const [researchCount, bookCount, conferenceCount, iprCount, grantCount] = await Promise.all([
      prisma.researchContribution.count({ where: { ...dateRange, publicationType: 'research_paper' } }),
      prisma.researchContribution.count({ where: { ...dateRange, publicationType: { in: ['book', 'book_chapter'] } } }),
      prisma.researchContribution.count({ where: { ...dateRange, publicationType: 'conference_paper' } }),
      prisma.iprApplication.count({ where: dateRange }),
      prisma.grantApplication.count({ where: dateRange }),
    ]);

    // Count distinct applicants across all models
    const [researchApplicants, iprApplicants, grantApplicants] = await Promise.all([
      prisma.researchContribution.groupBy({ by: ['applicantUserId'], where: dateRange }).then((r) => r.length),
      prisma.iprApplication.groupBy({ by: ['applicantUserId'], where: dateRange }).then((r) => r.length),
      prisma.grantApplication.groupBy({ by: ['applicantUserId'], where: dateRange }).then((r) => r.length),
    ]);

    // Rough unique applicant count (some may overlap across models)
    const estApplicants = Math.max(researchApplicants, iprApplicants, grantApplicants, 1);

    const totalSubmissions = researchCount + bookCount + conferenceCount + iprCount + grantCount;
    const avgTotal = +(totalSubmissions / estApplicants).toFixed(2);

    const result = {
      research: +(researchCount / estApplicants).toFixed(2),
      book: +(bookCount / estApplicants).toFixed(2),
      conference: +(conferenceCount / estApplicants).toFixed(2),
      ipr: +(iprCount / estApplicants).toFixed(2),
      grants: +(grantCount / estApplicants).toFixed(2),
      totalSubmissions: avgTotal,
      totalApplicants: estApplicants,
    };

    await cache.set(cacheKey, result, 300); // 5 min
    return result;
  }

  _reviewPublicationWhere(category) {
    if (category === 'all') {
      return { publicationType: { in: ['research_paper', 'book', 'book_chapter', 'conference_paper'] } };
    }
    return this._researchPublicationWhere(category);
  }

  _researchBreakdownKey(publicationType) {
    if (publicationType === 'research_paper') return 'research';
    if (publicationType === 'conference_paper') return 'conference';
    if (publicationType === 'book' || publicationType === 'book_chapter') return 'book';
    return 'research';
  }

  // Lean select shared by all three analytics tables — no relation JOINs.
  // Names (school, dept, user) are resolved in a single batch after all rows are
  // fetched; see _attachApplicantNames().
  _leanApplicantSelect(extra = {}) {
    return {
      id: true,
      applicantUserId: true,
      status: true,
      incentiveAmount: true,
      submittedAt: true,
      createdAt: true,
      schoolId: true,
      departmentId: true,
      ...extra,
    };
  }

  async _fetchApplicantRowsByCategory(category, access, from, to, filters = {}) {
    const scopeWhere = createScopeWhere(access, filters.schoolId, filters.departmentId);

    if (category === 'ipr') {
      return prisma.iprApplication.findMany({
        where: withDateScope(scopeWhere, from, to),
        select: this._leanApplicantSelect(),
      });
    }

    if (category === 'grants') {
      return prisma.grantApplication.findMany({
        where: withDateScope(scopeWhere, from, to),
        select: this._leanApplicantSelect(),
      });
    }

    return prisma.researchContribution.findMany({
      where: withDateScope(scopeWhere, from, to, [this._researchPublicationWhere(category)]),
      select: this._leanApplicantSelect({ publicationType: true }),
    });
  }

  /**
   * After all category rows have been fetched (lean — no JOINs), resolve
   * school names, department names and applicant display names in three
   * parallel batch queries and attach them back onto each row in-place.
   *
   * This replaces the previous approach of embedding three JOIN sub-selects
   * into every individual row query, which added a 3-table JOIN cost
   * per analytics request regardless of row count.
   */
  async _attachApplicantNames(categoryRows) {
    const allRows = categoryRows.flatMap((cr) => cr.rows);
    if (allRows.length === 0) return;

    const uniqueSchoolIds = unique(allRows.map((r) => r.schoolId).filter(Boolean));
    const uniqueDeptIds = unique(allRows.map((r) => r.departmentId).filter(Boolean));
    const uniqueUserIds = unique(allRows.map((r) => r.applicantUserId).filter(Boolean));

    const [schools, depts, users] = await Promise.all([
      uniqueSchoolIds.length
        ? prisma.facultySchoolList.findMany({
            where: { id: { in: uniqueSchoolIds } },
            select: { id: true, shortName: true, facultyName: true },
          })
        : [],
      uniqueDeptIds.length
        ? prisma.department.findMany({
            where: { id: { in: uniqueDeptIds } },
            select: { id: true, shortName: true, departmentName: true },
          })
        : [],
      uniqueUserIds.length
        ? prisma.userLogin.findMany({
            where: { id: { in: uniqueUserIds } },
            select: {
              id: true,
              uid: true,
              employeeDetails: { select: { displayName: true } },
              studentLogin: { select: { displayName: true } },
            },
          })
        : [],
    ]);

    const schoolMap = new Map(schools.map((s) => [s.id, s]));
    const deptMap = new Map(depts.map((d) => [d.id, d]));
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Mutate rows in-place to attach resolved name objects — same shape as
    // the old JOIN result so personSeed / schoolSeed / departmentSeed work unchanged.
    categoryRows.forEach((cr) => {
      cr.rows = cr.rows.map((row) => ({
        ...row,
        school: schoolMap.get(row.schoolId) || null,
        department: deptMap.get(row.departmentId) || null,
        applicantUser: userMap.get(row.applicantUserId) || null,
      }));
    });
  }

  async getApplicantAnalytics(user, filters = {}) {
    const from = parseDate(filters.from, new Date(new Date().setMonth(new Date().getMonth() - 12)));
    const to = parseEndDate(filters.to, new Date());
    const requestedCategory = filters.category || 'all';
    const categories =
      requestedCategory === 'all'
        ? APPLICANT_CATEGORIES
        : APPLICANT_CATEGORY_CONFIG[requestedCategory]
          ? [requestedCategory]
          : null;

    if (!categories) {
      const error = new Error(`Unsupported applicant analytics category: ${requestedCategory}`);
      error.statusCode = 400;
      throw error;
    }

    // Analytics result cache — 2 minutes. Eliminates repeated data-fetch DB queries.
    // Key includes userId so scoped users don't see each other's data.
    const analyticsCacheKey = `drd:applicant:${user.id}:${toIsoDate(from)}:${toIsoDate(to)}:${filters.schoolId || ''}:${filters.departmentId || ''}:${requestedCategory}`;
    const cachedResult = await cache.get(analyticsCacheKey);
    if (cachedResult) return cachedResult;

    // Only fetch base permissions if any category's access is not yet cached.
    // On warm requests (all categories cached) this avoids ALL DB queries for permissions.
    const _base = categories.some((cat) => {
      const cfg = APPLICANT_CATEGORY_CONFIG[cat];
      return cfg && !_getAccessCached(_buildAccessCacheKey(user.id, cfg.permissionKeys, cfg.schoolFields, cfg.departmentFields || []));
    }) ? await this._fetchUserBasePermissions(user) : null;

    // Resolve all category access scopes in parallel (non-sequential, shared base perms)
    const accessSettled = await Promise.allSettled(
      categories.map(async (cat) => {
        const access = await this._resolveApplicantAccessByCategory(user, cat, _base);
        return { category: cat, access };
      })
    );

    const accessEntries = [];
    for (const result of accessSettled) {
      if (result.status === 'fulfilled') {
        accessEntries.push(result.value);
      } else {
        if (requestedCategory === 'all' && result.reason?.statusCode === 403) continue;
        throw result.reason;
      }
    }

    if (accessEntries.length === 0) {
      const error = new Error('You do not have permission to view applicant analytics for the selected categories');
      error.statusCode = 403;
      throw error;
    }

    const categoryRows = await Promise.all(
      accessEntries.map(async ({ category, access }) => ({
        category,
        access,
        rows: await this._fetchApplicantRowsByCategory(category, access, from, to, filters),
      }))
    );

    // Batch-resolve school / department / user names in 3 parallel queries
    // (replaces per-row JOIN overhead from the old findMany selects).
    await this._attachApplicantNames(categoryRows);

    const personMap = new Map();
    const schoolMap = new Map();
    const departmentMap = new Map();
    const researchRows = [];
    const iprRows = [];
    const grantRows = [];

    categoryRows.forEach(({ category, rows }) => {
      rows.forEach((row) => {
        const isIpr = category === 'ipr';
        const isGrant = category === 'grants';
        const breakdownKey = APPLICANT_CATEGORY_CONFIG[category].breakdownKey;
        const approvedStatuses = isIpr
          ? IPR_APPROVED_STATUSES
          : isGrant
            ? GRANT_APPROVED_STATUSES
            : RESEARCH_APPROVED_STATUSES;
        const normalizedRow = { ...row, __analyticsCategory: breakdownKey };

        addApplicantRecord({
          personMap,
          schoolMap,
          departmentMap,
          record: normalizedRow,
          category: breakdownKey,
          isApproved: approvedStatuses.has(row.status),
          incentive: approvedStatuses.has(row.status) ? Number(row.incentiveAmount || 0) : 0,
        });

        if (isIpr) iprRows.push(normalizedRow);
        else if (isGrant) grantRows.push(normalizedRow);
        else researchRows.push(normalizedRow);
      });
    });

    const people = [...personMap.values()].sort(
      (left, right) => right.totalIncentive - left.totalIncentive || right.totalApplications - left.totalApplications
    );
    const departmentApplicantCounts = people.reduce((acc, person) => {
      if (person.departmentId) {
        acc[person.departmentId] = (acc[person.departmentId] || 0) + 1;
      }
      return acc;
    }, {});
    const schoolWise = [...schoolMap.values()].sort(
      (left, right) => right.totalIncentive - left.totalIncentive || right.totalApplications - left.totalApplications
    );
    const departmentWise = [...departmentMap.values()]
      .map((department) => ({
        ...department,
        totalApplicants: departmentApplicantCounts[department.departmentId] || 0,
      }))
      .sort(
        (left, right) => right.totalIncentive - left.totalIncentive || right.totalApplications - left.totalApplications
      );

    const combinedAccess = combineAccess(categoryRows.map((entry) => entry.access));
    const categoryScopes = categoryRows.reduce((acc, entry) => {
      acc[entry.category] = {
        schoolIds: entry.access.allowedSchoolIds,
        departmentIds: entry.access.allowedDepartmentIds,
        scopeLevel: entry.access.scopeLevel,
      };
      return acc;
    }, {});

    const result = {
      meta: buildMeta('applicant', combinedAccess, from, to),
      kpis: {
        totalApplications: researchRows.length + iprRows.length + grantRows.length,
        totalResearchSubmissions: researchRows.filter((row) => row.__analyticsCategory === 'research').length,
        totalBookSubmissions: researchRows.filter((row) => row.__analyticsCategory === 'book').length,
        totalConferenceSubmissions: researchRows.filter((row) => row.__analyticsCategory === 'conference').length,
        totalPatentSubmissions: iprRows.length,
        totalGrantSubmissions: grantRows.length,
        approvedCount:
          researchRows.filter((row) => RESEARCH_APPROVED_STATUSES.has(row.status)).length +
          iprRows.filter((row) => IPR_APPROVED_STATUSES.has(row.status)).length +
          grantRows.filter((row) => GRANT_APPROVED_STATUSES.has(row.status)).length,
        totalIncentive: Number(
          [...people].reduce((sum, person) => sum + Number(person.totalIncentive || 0), 0).toFixed(2)
        ),
        totalPeople: people.length,
      },
      schoolWise,
      departmentWise,
      people,
      reviewers: [],
      extensions: {
        requestedCategory,
        availableCategories: categoryRows.map((entry) => entry.category),
        categoryScopes,
        monthlyTrend: buildApplicantMonthlyTrend({
          researchRows,
          iprRows,
          grantRows,
          from,
          to,
        }),
      },
    };

    // Store in analytics cache (5 min TTL)
    await cache.set(analyticsCacheKey, result, 300);
    return result;
  }

  async getApplicantPersonAnalytics(user, personId, filters = {}) {
    const from = parseDate(filters.from, new Date(new Date().setMonth(new Date().getMonth() - 12)));
    const to = parseEndDate(filters.to, new Date());
    const requestedCategory = filters.category || 'all';
    const categories =
      requestedCategory === 'all'
        ? APPLICANT_CATEGORIES
        : APPLICANT_CATEGORY_CONFIG[requestedCategory]
          ? [requestedCategory]
          : null;

    if (!categories) {
      const error = new Error(`Unsupported applicant analytics category: ${requestedCategory}`);
      error.statusCode = 400;
      throw error;
    }

    // Only fetch base permissions if any category's access is not yet cached
    const _base = categories.some((cat) => {
      const cfg = APPLICANT_CATEGORY_CONFIG[cat];
      return cfg && !_getAccessCached(_buildAccessCacheKey(user.id, cfg.permissionKeys, cfg.schoolFields, cfg.departmentFields || []));
    }) ? await this._fetchUserBasePermissions(user) : null;

    // Resolve per-category access scopes in parallel using shared base perms
    const accessSettled = await Promise.allSettled(
      categories.map(async (cat) => {
        const access = await this._resolveApplicantAccessByCategory(user, cat, _base);
        return { category: cat, access };
      })
    );
    const accessEntries = [];
    for (const result of accessSettled) {
      if (result.status === 'fulfilled') {
        accessEntries.push(result.value);
      } else {
        if (requestedCategory === 'all' && result.reason?.statusCode === 403) continue;
        throw result.reason;
      }
    }
    if (accessEntries.length === 0) {
      const error = new Error('You do not have permission to view applicant analytics');
      error.statusCode = 403;
      throw error;
    }

    // Build the common select for applicant lookup rows
    const applicantSelect = {
      id: true,
      applicantUserId: true,
      status: true,
      incentiveAmount: true,
      submittedAt: true,
      createdAt: true,
      schoolId: true,
      departmentId: true,
      school: { select: { facultyName: true, shortName: true } },
      department: { select: { departmentName: true, shortName: true } },
      applicantUser: {
        select: {
          uid: true,
          employeeDetails: { select: { displayName: true } },
          studentLogin: { select: { displayName: true } },
        },
      },
    };

    // Fetch ONLY this person's rows — O(person's submissions) instead of O(entire scope)
    const categoryRows = await Promise.all(
      accessEntries.map(async ({ category, access }) => {
        const scopeWhere = createScopeWhere(access, null, null);
        const personDateScope = (extra = []) => ({
          AND: [
            { applicantUserId: personId },
            { submittedAt: { gte: from, lte: to } },
            scopeWhere,
            ...extra,
          ],
        });

        let rows;
        if (category === 'ipr') {
          rows = await prisma.iprApplication.findMany({ where: personDateScope(), select: applicantSelect });
        } else if (category === 'grants') {
          rows = await prisma.grantApplication.findMany({ where: personDateScope(), select: applicantSelect });
        } else {
          rows = await prisma.researchContribution.findMany({
            where: personDateScope([this._researchPublicationWhere(category)]),
            select: { ...applicantSelect, publicationType: true },
          });
        }
        return { category, access, rows };
      })
    );

    const personMap = new Map();
    const schoolMap = new Map();
    const departmentMap = new Map();
    const researchRows = [];
    const iprRows = [];
    const grantRows = [];

    categoryRows.forEach(({ category, rows }) => {
      rows.forEach((row) => {
        const isIpr = category === 'ipr';
        const isGrant = category === 'grants';
        const breakdownKey = APPLICANT_CATEGORY_CONFIG[category].breakdownKey;
        const approvedStatuses = isIpr
          ? IPR_APPROVED_STATUSES
          : isGrant
            ? GRANT_APPROVED_STATUSES
            : RESEARCH_APPROVED_STATUSES;
        const normalizedRow = { ...row, __analyticsCategory: breakdownKey };

        addApplicantRecord({
          personMap,
          schoolMap,
          departmentMap,
          record: normalizedRow,
          category: breakdownKey,
          isApproved: approvedStatuses.has(row.status),
          incentive: approvedStatuses.has(row.status) ? Number(row.incentiveAmount || 0) : 0,
        });

        if (isIpr) iprRows.push(normalizedRow);
        else if (isGrant) grantRows.push(normalizedRow);
        else researchRows.push(normalizedRow);
      });
    });

    if (personMap.size === 0) {
      const error = new Error('Applicant analytics not found for the selected person');
      error.statusCode = 404;
      throw error;
    }

    const person = personMap.get(personId) || [...personMap.values()][0];
    const schoolWise = [...schoolMap.values()];
    const departmentWise = [...departmentMap.values()];
    const combinedAccess = combineAccess(accessEntries.map((e) => e.access));

    // Tracker works are personal to the user (filtered by userId), so we don't need
    // additional scope filtering by school/department. This prevents filtering out
    // tracker works that have NULL schoolId/departmentId or don't match the user's
    // allowed schools/departments.
    const trackerRows = await prisma.researchProgressTracker.findMany({
      where: {
        AND: [
          { userId: personId },
          {
            OR: [
              // Works created in this period
              { createdAt: { gte: from, lte: to } },
              // Works updated in this period
              { updatedAt: { gte: from, lte: to } },
              // Works with expected completion in this period
              { expectedCompletionDate: { gte: from, lte: to } },
              // Works with actual completion in this period
              { actualCompletionDate: { gte: from, lte: to } },
              // Ongoing works (not completed yet)
              {
                AND: [
                  { createdAt: { lte: to } },
                  { currentStatus: { in: ['writing', 'communicated', 'submitted'] } },
                ],
              },
            ],
          },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 50, // Increased limit to show more works
      select: {
        id: true,
        trackingNumber: true,
        userId: true,
        title: true,
        publicationType: true,
        currentStatus: true,
        schoolId: true,
        departmentId: true,
        expectedCompletionDate: true,
        actualCompletionDate: true,
        createdAt: true,
        updatedAt: true,
        school: { select: { facultyName: true, shortName: true } },
        department: { select: { departmentName: true, shortName: true } },
        user: {
          select: {
            uid: true,
            employeeDetails: { select: { displayName: true } },
            studentLogin: { select: { displayName: true } },
          },
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          take: 1,
          select: { changedAt: true },
        },
        researchContribution: {
          select: {
            id: true,
            applicationNumber: true,
            status: true,
            incentiveAmount: true,
            pointsAwarded: true,
          },
        },
      },
    });

    const completedStatuses = new Set(['accepted', 'published']);
    const ongoingStatuses = new Set(['writing', 'communicated', 'submitted']);
    const trackerWorkItems = trackerRows.map(mapTrackerRecord);
    
    // Debug logging
    console.log('=== TRACKER WORKS DEBUG ===');
    console.log('Total tracker rows fetched:', trackerRows.length);
    console.log('Tracker work items after mapping:', trackerWorkItems.length);
    console.log('Status distribution:', trackerWorkItems.reduce((acc, item) => {
      acc[item.currentStatus] = (acc[item.currentStatus] || 0) + 1;
      return acc;
    }, {}));
    
    const completedWorks = trackerWorkItems.filter((record) => completedStatuses.has(record.currentStatus));
    const ongoingWorks = trackerWorkItems.filter((record) => ongoingStatuses.has(record.currentStatus));
    const publishedWorks = trackerWorkItems.filter((record) => record.currentStatus === 'published');
    const rejectedWorks = trackerWorkItems.filter((record) => record.currentStatus === 'rejected');
    
    console.log('Completed works:', completedWorks.length);
    console.log('Ongoing works:', ongoingWorks.length);
    console.log('Published works:', publishedWorks.length);
    console.log('Rejected works:', rejectedWorks.length);
    console.log('=== END DEBUG ===');

    return {
      meta: buildMeta('applicant', combinedAccess, from, to),
      kpis: {
        totalApplications: researchRows.length + iprRows.length + grantRows.length,
        totalResearchSubmissions: researchRows.filter((r) => r.__analyticsCategory === 'research').length,
        totalBookSubmissions: researchRows.filter((r) => r.__analyticsCategory === 'book').length,
        totalConferenceSubmissions: researchRows.filter((r) => r.__analyticsCategory === 'conference').length,
        totalPatentSubmissions: iprRows.length,
        totalGrantSubmissions: grantRows.length,
        approvedCount:
          researchRows.filter((r) => RESEARCH_APPROVED_STATUSES.has(r.status)).length +
          iprRows.filter((r) => IPR_APPROVED_STATUSES.has(r.status)).length +
          grantRows.filter((r) => GRANT_APPROVED_STATUSES.has(r.status)).length,
        totalIncentive: Number(person.totalIncentive.toFixed(2)),
        totalPeople: 1,
      },
      schoolWise,
      departmentWise,
      people: [person],
      reviewers: [],
      extensions: {
        requestedCategory,
        monthlyTrend: buildApplicantMonthlyTrend({ researchRows, iprRows, grantRows, from, to }),
        trackerWorks: {
          totalTrackers: trackerWorkItems.length,
          ongoingCount: ongoingWorks.length,
          completedCount: completedWorks.length,
          publishedCount: publishedWorks.length,
          rejectedCount: rejectedWorks.length,
          ongoingWorks,
          completedWorks,
        },
        universityAverage: await this._computeUniversityAverage(from, to),
      },
    };
  }


  async getApplicantPersonSubmissions(user, personId, filters = {}) {
    const from = parseDate(filters.from, new Date(new Date().setMonth(new Date().getMonth() - 12)));
    const to = parseEndDate(filters.to, new Date());
    const category = filters.category || 'all';

    const categories = category === 'all' ? APPLICANT_CATEGORIES : [category];

    // Only fetch base permissions if any category's access is not yet cached
    const _base = categories.some((cat) => {
      const cfg = APPLICANT_CATEGORY_CONFIG[cat];
      return cfg && !_getAccessCached(_buildAccessCacheKey(user.id, cfg.permissionKeys, cfg.schoolFields, cfg.departmentFields || []));
    }) ? await this._fetchUserBasePermissions(user) : null;

    // Resolve access only for the requested category (or all when requested)
    const accessSettled = await Promise.allSettled(
      categories.map(async (cat) => {
        const access = await this._resolveApplicantAccessByCategory(user, cat, _base);
        return { category: cat, access };
      })
    );
    const accessEntries = [];
    for (const result of accessSettled) {
      if (result.status === 'fulfilled') {
        accessEntries.push(result.value);
      } else {
        if (category === 'all' && result.reason?.statusCode === 403) continue;
        throw result.reason;
      }
    }
    if (accessEntries.length === 0) {
      const error = new Error('You do not have permission to view applicant analytics');
      error.statusCode = 403;
      throw error;
    }
    const combinedAccess = combineAccess(accessEntries.map((e) => e.access));
    const scopeWhere = createScopeWhere(combinedAccess, null, null);

    // Lightweight scope validation: find any record for this person in the caller's scope
    // (much cheaper than running full analytics — just needs one matching row)
    const scopeGate = { AND: [{ applicantUserId: personId }, scopeWhere] };
    let anchorRecord = null;
    if (category === 'ipr') {
      anchorRecord = await prisma.iprApplication.findFirst({
        where: scopeGate,
        select: { id: true, school: { select: { shortName: true, facultyName: true } }, department: { select: { departmentName: true, shortName: true } }, applicantUser: { select: { uid: true, employeeDetails: { select: { displayName: true } }, studentLogin: { select: { displayName: true } } } } },
      });
    } else if (category === 'grants') {
      anchorRecord = await prisma.grantApplication.findFirst({
        where: scopeGate,
        select: { id: true, school: { select: { shortName: true, facultyName: true } }, department: { select: { departmentName: true, shortName: true } }, applicantUser: { select: { uid: true, employeeDetails: { select: { displayName: true } }, studentLogin: { select: { displayName: true } } } } },
      });
    } else {
      anchorRecord = await prisma.researchContribution.findFirst({
        where: scopeGate,
        select: { id: true, school: { select: { shortName: true, facultyName: true } }, department: { select: { departmentName: true, shortName: true } }, applicantUser: { select: { uid: true, employeeDetails: { select: { displayName: true } }, studentLogin: { select: { displayName: true } } } } },
      });
    }

    if (!anchorRecord) {
      const err = new Error('Applicant not found in your analytics scope');
      err.statusCode = 404;
      throw err;
    }

    // Extract person meta from the anchor record
    const personName =
      anchorRecord.applicantUser?.employeeDetails?.displayName ||
      anchorRecord.applicantUser?.studentLogin?.displayName ||
      anchorRecord.applicantUser?.uid ||
      'Unknown';
    const schoolName = anchorRecord.school?.shortName || anchorRecord.school?.facultyName || 'Unassigned';
    const departmentName = anchorRecord.department?.shortName || anchorRecord.department?.departmentName || 'Unassigned';

    const researchPubTypes = {
      all:        ['research_paper', 'book', 'book_chapter', 'conference_paper'],
      research:   ['research_paper'],
      book:       ['book', 'book_chapter'],
      conference: ['conference_paper'],
    };

    const submissions = [];

    // ── Research / Book / Conference ────────────────────────────────────────
    if (['all', 'research', 'book', 'conference'].includes(category)) {
      const pubTypes = researchPubTypes[category] || researchPubTypes.all;
      const rows = await prisma.researchContribution.findMany({
        where: {
          applicantUserId: personId,
          publicationType: { in: pubTypes },
          submittedAt: { gte: from, lte: to },
          status: { notIn: ['draft'] },
        },
        select: {
          id: true,
          applicationNumber: true,
          title: true,
          publicationType: true,
          status: true,
          submittedAt: true,
          publicationDate: true,
          journalName: true,
          conferenceName: true,
          bookTitle: true,
          doi: true,
          paperDoi: true,
          weblink: true,
          paperweblink: true,
          indexedIn: true,
          quartile: true,
          impactFactor: true,
          naasRating: true,
          nationalInternational: true,
          incentiveAmount: true,
          calculatedIncentiveAmount: true,
          pointsAwarded: true,
          authors: {
            orderBy: { authorOrder: 'asc' },
            select: {
              id: true,
              uid: true,
              name: true,
              affiliation: true,
              department: true,
              authorOrder: true,
              isCorresponding: true,
              authorType: true,
              isInternal: true,
            },
          },
        },
        orderBy: { submittedAt: 'desc' },
      });

      const categoryMap = {
        research_paper: 'research',
        book: 'book',
        book_chapter: 'book',
        conference_paper: 'conference',
      };

      rows.forEach((r) => {
        const isApproved = RESEARCH_APPROVED_STATUSES.has(r.status);
        submissions.push({
          id: r.id,
          submissionType: categoryMap[r.publicationType] || 'research',
          publicationType: r.publicationType,
          applicationNumber: r.applicationNumber,
          title: r.title,
          status: r.status,
          isApproved,
          submittedAt: r.submittedAt,
          publicationDate: r.publicationDate,
          venue: r.journalName || r.conferenceName || r.bookTitle || null,
          doi: r.paperDoi || r.doi || null,
          weblink: r.paperweblink || r.weblink || null,
          indexedIn: r.indexedIn || null,
          quartile: r.quartile || null,
          impactFactor: r.impactFactor ? Number(r.impactFactor) : null,
          naasRating: r.naasRating ? Number(r.naasRating) : null,
          nationalInternational: r.nationalInternational || null,
          incentiveAmount: r.incentiveAmount ? Number(r.incentiveAmount) : null,
          calculatedIncentiveAmount: r.calculatedIncentiveAmount ? Number(r.calculatedIncentiveAmount) : null,
          pointsAwarded: r.pointsAwarded || null,
          authors: (r.authors || []).map((author) => ({
            id: author.id,
            uid: author.uid || null,
            name: author.name,
            affiliation: author.affiliation || null,
            department: author.department || null,
            authorOrder: author.authorOrder,
            isCorresponding: !!author.isCorresponding,
            authorType: author.authorType,
            isInternal: !!author.isInternal,
          })),
        });
      });
    }

    // ── IPR / Patents ────────────────────────────────────────────────────────
    if (['all', 'ipr'].includes(category)) {
      const rows = await prisma.iprApplication.findMany({
        where: {
          applicantUserId: personId,
          submittedAt: { gte: from, lte: to },
          status: { notIn: ['draft'] },
        },
        select: {
          id: true,
          applicationNumber: true,
          title: true,
          iprType: true,
          filingType: true,
          status: true,
          submittedAt: true,
          govtApplicationId: true,
          govtFilingDate: true,
          publicationDate: true,
          publicationId: true,
          incentiveAmount: true,
          pointsAwarded: true,
        },
        orderBy: { submittedAt: 'desc' },
      });

      rows.forEach((r) => {
        const isApproved = IPR_APPROVED_STATUSES.has(r.status);
        submissions.push({
          id: r.id,
          submissionType: 'ipr',
          publicationType: `ipr_${r.iprType}`,
          applicationNumber: r.applicationNumber,
          title: r.title,
          status: r.status,
          isApproved,
          submittedAt: r.submittedAt,
          publicationDate: r.publicationDate || r.govtFilingDate || null,
          venue: null,
          doi: null,
          weblink: null,
          indexedIn: null,
          quartile: null,
          impactFactor: null,
          naasRating: null,
          nationalInternational: null,
          incentiveAmount: r.incentiveAmount ? Number(r.incentiveAmount) : null,
          calculatedIncentiveAmount: null,
          pointsAwarded: r.pointsAwarded || null,
          extra: {
            iprType: r.iprType,
            filingType: r.filingType,
            govtApplicationId: r.govtApplicationId,
            publicationId: r.publicationId,
          },
        });
      });
    }

    // ── Grants ───────────────────────────────────────────────────────────────
    if (['all', 'grants'].includes(category)) {
      const rows = await prisma.grantApplication.findMany({
        where: {
          applicantUserId: personId,
          submittedAt: { gte: from, lte: to },
          status: { notIn: ['draft'] },
        },
        select: {
          id: true,
          applicationNumber: true,
          title: true,
          projectType: true,
          projectCategory: true,
          fundingAgencyName: true,
          status: true,
          submittedAt: true,
          dateOfSubmission: true,
          submittedAmount: true,
          incentiveAmount: true,
          pointsAwarded: true,
          projectStartDate: true,
          projectEndDate: true,
        },
        orderBy: { submittedAt: 'desc' },
      });

      rows.forEach((r) => {
        const isApproved = GRANT_APPROVED_STATUSES.has(r.status);
        submissions.push({
          id: r.id,
          submissionType: 'grants',
          publicationType: 'grant',
          applicationNumber: r.applicationNumber,
          title: r.title,
          status: r.status,
          isApproved,
          submittedAt: r.submittedAt || r.dateOfSubmission,
          publicationDate: null,
          venue: r.fundingAgencyName || null,
          doi: null,
          weblink: null,
          indexedIn: null,
          quartile: null,
          impactFactor: null,
          naasRating: null,
          nationalInternational: null,
          incentiveAmount: r.incentiveAmount ? Number(r.incentiveAmount) : null,
          calculatedIncentiveAmount: null,
          pointsAwarded: r.pointsAwarded || null,
          extra: {
            projectType: r.projectType,
            projectCategory: r.projectCategory,
            submittedAmount: r.submittedAmount ? Number(r.submittedAmount) : null,
            projectStartDate: r.projectStartDate,
            projectEndDate: r.projectEndDate,
          },
        });
      });
    }

    // Sort all by submittedAt desc, approved first
    submissions.sort((a, b) => {
      if (a.isApproved !== b.isApproved) return a.isApproved ? -1 : 1;
      const aDate = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const bDate = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return bDate - aDate;
    });

    return {
      personId,
      personName,
      schoolName,
      departmentName,
      category,
      totalCount: submissions.length,
      approvedCount: submissions.filter((s) => s.isApproved).length,
      submissions,
    };
  }

  async getDrdMemberAnalytics(user, filters = {}) {
    const access = await this._resolveAccess(user, DRD_MEMBER_ANALYTICS, {
      schoolFields: ['assignedDrdMemberAnalyticsSchoolIds', 'assignedSchoolIds'],
      departmentFields: ['assignedDrdMemberAnalyticsDepartmentIds'],
    });
    const from = parseDate(filters.from, new Date(new Date().setMonth(new Date().getMonth() - 12)));
    const to = parseEndDate(filters.to, new Date());
    const scopeWhere = createScopeWhere(access, filters.schoolId, filters.departmentId);
    const category = filters.category || 'all';
    const usesResearchWorkflow = ['all', 'research', 'book', 'conference'].includes(category);
    const reviewerId = access.canViewAllReviewers ? filters.reviewerId : user.id;

    const [researchReviews, iprReviews, grantReviews, assignedResearch, assignedIpr, assignedGrants] = await Promise.all([
      usesResearchWorkflow
        ? prisma.researchContributionReview.findMany({
            where: {
              ...(reviewerId ? { reviewerId } : {}),
              reviewedAt: { gte: from, lte: to },
              researchContribution: {
                AND: [scopeWhere, this._reviewPublicationWhere(category)],
              },
            },
            select: {
              reviewerId: true,
              decision: true,
              reviewedAt: true,
              researchContribution: {
                select: {
                  id: true,
                  title: true,
                  publicationType: true,
                  submittedAt: true,
                  createdAt: true,
                  currentReviewerId: true,
                  schoolId: true,
                  departmentId: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      category === 'all' || category === 'ipr'
        ? prisma.iprReview.findMany({
            where: {
              ...(reviewerId ? { reviewerId } : {}),
              reviewedAt: { gte: from, lte: to },
              iprApplication: scopeWhere,
            },
            select: {
              reviewerId: true,
              decision: true,
              reviewedAt: true,
              iprApplication: {
                select: {
                  id: true,
                  title: true,
                  submittedAt: true,
                  createdAt: true,
                  currentReviewerId: true,
                  schoolId: true,
                  departmentId: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      category === 'all' || category === 'grants'
        ? prisma.grantApplicationReview.findMany({
            where: {
              ...(reviewerId ? { reviewerId } : {}),
              reviewedAt: { gte: from, lte: to },
              grantApplication: scopeWhere,
            },
            select: {
              reviewerId: true,
              decision: true,
              reviewedAt: true,
              grantApplication: {
                select: {
                  id: true,
                  title: true,
                  submittedAt: true,
                  createdAt: true,
                  currentReviewerId: true,
                  schoolId: true,
                  departmentId: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      usesResearchWorkflow
        ? prisma.researchContribution.findMany({
            where: withDateScope(
              scopeWhere,
              from,
              to,
              [
                this._reviewPublicationWhere(category),
                reviewerId ? { currentReviewerId: reviewerId } : { currentReviewerId: { not: null } },
              ]
            ),
            select: {
              id: true,
              title: true,
              publicationType: true,
              submittedAt: true,
              createdAt: true,
              currentReviewerId: true,
              schoolId: true,
              departmentId: true,
            },
          })
        : Promise.resolve([]),
      category === 'all' || category === 'ipr'
        ? prisma.iprApplication.findMany({
            where: withDateScope(scopeWhere, from, to, reviewerId ? [{ currentReviewerId: reviewerId }] : [{ currentReviewerId: { not: null } }]),
            select: {
              id: true,
              title: true,
              submittedAt: true,
              createdAt: true,
              currentReviewerId: true,
              schoolId: true,
              departmentId: true,
            },
          })
        : Promise.resolve([]),
      category === 'all' || category === 'grants'
        ? prisma.grantApplication.findMany({
            where: withDateScope(scopeWhere, from, to, reviewerId ? [{ currentReviewerId: reviewerId }] : [{ currentReviewerId: { not: null } }]),
            select: {
              id: true,
              title: true,
              submittedAt: true,
              createdAt: true,
              currentReviewerId: true,
              schoolId: true,
              departmentId: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const reviewerMap = new Map();

    const upsertReviewer = (reviewerKey) => {
      if (!reviewerMap.has(reviewerKey)) {
        reviewerMap.set(reviewerKey, {
          reviewerId: reviewerKey,
          reviewerName: reviewerKey === user.id ? getViewerName(user) : reviewerKey,
          assignedCount: 0,
          respondedCount: 0,
          completedCount: 0,
          pendingCount: 0,
          completionRate: 0,
          avgFirstResponseHours: 0,
          avgCompletionHours: 0,
          categoryBreakdown: {
            research: 0,
            book: 0,
            conference: 0,
            ipr: 0,
            grants: 0,
          },
          _apps: new Map(),
          _responseDurations: [],
          _completionDurations: [],
        });
      }
      return reviewerMap.get(reviewerKey);
    };

    const consumeReview = (review, categoryKey, application) => {
      const reviewer = upsertReviewer(review.reviewerId);
      reviewer.categoryBreakdown[categoryKey] += 1;

      const appKey = `${categoryKey}:${application.id}`;
      if (!reviewer._apps.has(appKey)) {
        const submittedAt = getRecordDate(application);
        reviewer._apps.set(appKey, {
          submittedAt,
          hasResponse: false,
          hasCompletion: false,
          isPending: application.currentReviewerId === review.reviewerId,
        });
      }

      const appState = reviewer._apps.get(appKey);
      if (!appState.hasResponse && appState.submittedAt && review.reviewedAt) {
        reviewer._responseDurations.push(
          (new Date(review.reviewedAt).getTime() - new Date(appState.submittedAt).getTime()) / 36e5
        );
        appState.hasResponse = true;
      }

      if (!appState.hasCompletion && TERMINAL_REVIEW_DECISIONS.has(review.decision)) {
        if (appState.submittedAt && review.reviewedAt) {
          reviewer._completionDurations.push(
            (new Date(review.reviewedAt).getTime() - new Date(appState.submittedAt).getTime()) / 36e5
          );
        }
        appState.hasCompletion = true;
      }
    };

    researchReviews.forEach((review) =>
      consumeReview(
        review,
        this._researchBreakdownKey(review.researchContribution?.publicationType),
        review.researchContribution
      )
    );
    iprReviews.forEach((review) =>
      consumeReview(review, 'ipr', review.iprApplication)
    );
    grantReviews.forEach((review) =>
      consumeReview(review, 'grants', review.grantApplication)
    );

    const consumeAssigned = (application, categoryKey) => {
      const assignedReviewerId = application.currentReviewerId;
      if (!assignedReviewerId) return;
      const reviewer = upsertReviewer(assignedReviewerId);
      const appKey = `${categoryKey}:${application.id}`;
      if (!reviewer._apps.has(appKey)) {
        reviewer.categoryBreakdown[categoryKey] += 1;
        reviewer._apps.set(appKey, {
          submittedAt: getRecordDate(application),
          hasResponse: false,
          hasCompletion: false,
          isPending: true,
        });
      } else {
        reviewer._apps.get(appKey).isPending = true;
      }
    };

    assignedResearch.forEach((application) =>
      consumeAssigned(application, this._researchBreakdownKey(application.publicationType))
    );
    assignedIpr.forEach((application) => consumeAssigned(application, 'ipr'));
    assignedGrants.forEach((application) => consumeAssigned(application, 'grants'));

    const reviewerIds = [...reviewerMap.keys()];
    if (reviewerIds.length > 0) {
      const users = await prisma.userLogin.findMany({
        where: { id: { in: reviewerIds } },
        select: {
          id: true,
          uid: true,
          employeeDetails: { select: { displayName: true } },
        },
      });
      const userMap = new Map(users.map((entry) => [entry.id, entry]));
      reviewerMap.forEach((reviewer, key) => {
        const profile = userMap.get(key);
        if (profile) {
          reviewer.reviewerName = profile.employeeDetails?.displayName || profile.uid || key;
        }
      });
    }

    const reviewers = [...reviewerMap.values()]
      .map((reviewer) => {
        const appStates = [...reviewer._apps.values()];
        reviewer.assignedCount = appStates.length;
        reviewer.respondedCount = appStates.filter((app) => app.hasResponse).length;
        reviewer.completedCount = appStates.filter((app) => app.hasCompletion).length;
        reviewer.pendingCount = appStates.filter((app) => app.isPending && !app.hasCompletion).length;
        reviewer.completionRate = reviewer.assignedCount
          ? Number(((reviewer.completedCount / reviewer.assignedCount) * 100).toFixed(2))
          : 0;
        reviewer.avgFirstResponseHours = avgHours(reviewer._responseDurations);
        reviewer.avgCompletionHours = avgHours(reviewer._completionDurations);
        delete reviewer._apps;
        delete reviewer._responseDurations;
        delete reviewer._completionDurations;
        return reviewer;
      })
      .sort((left, right) => right.completedCount - left.completedCount || left.avgFirstResponseHours - right.avgFirstResponseHours);

    return {
      meta: buildMeta('drd_member', access, from, to),
      kpis: {
        totalReviewers: reviewers.length,
        assignedCount: reviewers.reduce((sum, reviewer) => sum + reviewer.assignedCount, 0),
        respondedCount: reviewers.reduce((sum, reviewer) => sum + reviewer.respondedCount, 0),
        completedCount: reviewers.reduce((sum, reviewer) => sum + reviewer.completedCount, 0),
        pendingCount: reviewers.reduce((sum, reviewer) => sum + reviewer.pendingCount, 0),
        avgFirstResponseHours: avgHours(reviewers.map((reviewer) => reviewer.avgFirstResponseHours).filter(Boolean)),
        avgCompletionHours: avgHours(reviewers.map((reviewer) => reviewer.avgCompletionHours).filter(Boolean)),
      },
      schoolWise: [],
      departmentWise: [],
      people: [],
      reviewers,
      extensions: {
        monthlyTrend: buildReviewerMonthlyTrend({
          assignedResearch,
          assignedIpr,
          assignedGrants,
          researchReviews,
          iprReviews,
          grantReviews,
          from,
          to,
        }),
        selfView: !access.canViewAllReviewers,
      },
    };
  }

  async getReviewerAnalytics(user, reviewerId, filters = {}) {
    const analytics = await this.getDrdMemberAnalytics(user, {
      ...filters,
      reviewerId,
    });
    const reviewer = analytics.reviewers.find((entry) => entry.reviewerId === reviewerId);
    if (!reviewer) {
      const error = new Error('Reviewer analytics not found for the selected reviewer');
      error.statusCode = 404;
      throw error;
    }

    return {
      ...analytics,
      reviewers: [reviewer],
    };
  }

  /**
   * DRD Member Performance Overview — turnaround, decision distribution,
   * response-time analytics per reviewer with assignedAt-based clock.
   */
  async getDrdMemberPerformance(user, filters = {}) {
    const access = await this._resolveAccess(user, DRD_MEMBER_ANALYTICS, {
      schoolFields: ['assignedDrdMemberAnalyticsSchoolIds', 'assignedSchoolIds'],
      departmentFields: ['assignedDrdMemberAnalyticsDepartmentIds'],
    });
    const from = parseDate(filters.from, new Date(new Date().setMonth(new Date().getMonth() - 12)));
    const to = parseEndDate(filters.to, new Date());
    const scopeWhere = createScopeWhere(access, filters.schoolId, filters.departmentId);
    const category = filters.category || 'all';
    const reviewerId = access.canViewAllReviewers ? filters.reviewerId : user.id;

    // Fetch reviews with assignedAt from parent application
    const [researchReviews, iprReviews, grantReviews] = await Promise.all([
      ['all', 'research', 'book', 'conference'].includes(category)
        ? prisma.researchContributionReview.findMany({
            where: {
              ...(reviewerId ? { reviewerId } : {}),
              reviewedAt: { gte: from, lte: to },
              researchContribution: {
                AND: [scopeWhere, this._reviewPublicationWhere(category)],
              },
            },
            select: {
              id: true,
              reviewerId: true,
              decision: true,
              reviewedAt: true,
              createdAt: true,
              researchContribution: {
                select: {
                  id: true,
                  title: true,
                  publicationType: true,
                  status: true,
                  submittedAt: true,
                  createdAt: true,
                  schoolId: true,
                  departmentId: true,
                  school: { select: { facultyName: true, shortName: true } },
                  department: { select: { departmentName: true, shortName: true } },
                },
              },
            },
          })
        : [],
      category === 'all' || category === 'ipr'
        ? prisma.iprReview.findMany({
            where: {
              ...(reviewerId ? { reviewerId } : {}),
              reviewedAt: { gte: from, lte: to },
              iprApplication: scopeWhere,
            },
            select: {
              id: true,
              reviewerId: true,
              decision: true,
              reviewedAt: true,
              createdAt: true,
              iprApplication: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  submittedAt: true,
                  createdAt: true,
                  schoolId: true,
                  departmentId: true,
                  school: { select: { facultyName: true, shortName: true } },
                  department: { select: { departmentName: true, shortName: true } },
                },
              },
            },
          })
        : [],
      category === 'all' || category === 'grants'
        ? prisma.grantApplicationReview.findMany({
            where: {
              ...(reviewerId ? { reviewerId } : {}),
              reviewedAt: { gte: from, lte: to },
              grantApplication: scopeWhere,
            },
            select: {
              id: true,
              reviewerId: true,
              decision: true,
              reviewedAt: true,
              createdAt: true,
              grantApplication: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  submittedAt: true,
                  createdAt: true,
                  schoolId: true,
                  departmentId: true,
                  school: { select: { facultyName: true, shortName: true } },
                  department: { select: { departmentName: true, shortName: true } },
                },
              },
            },
          })
        : [],
    ]);

    // Build reviewer performance map with turnaround computed from assignedAt (review.createdAt)
    const reviewerMap = new Map();
    const processReview = (review, categoryKey, application) => {
      if (!application || !review.reviewerId) return;
      const rid = review.reviewerId;
      if (!reviewerMap.has(rid)) {
        reviewerMap.set(rid, {
          reviewerId: rid,
          reviewerName: rid,
          school: '',
          department: '',
          assigned: 0,
          reviewed: 0,
          pending: 0,
          turnaroundHours: [],
          decisions: { approved: 0, rejected: 0, sentBack: 0, revisionRequested: 0 },
          timeline: [],
        });
      }
      const reviewer = reviewerMap.get(rid);
      reviewer.assigned += 1;

      // assignedAt = review.createdAt (when assignment record was created)
      const assignedAt = review.createdAt ? new Date(review.createdAt) : null;
      const respondedAt = review.reviewedAt ? new Date(review.reviewedAt) : null;
      let turnaround = null;
      if (assignedAt && respondedAt) {
        turnaround = Number(((respondedAt.getTime() - assignedAt.getTime()) / 36e5).toFixed(2));
        reviewer.turnaroundHours.push(turnaround);
        reviewer.reviewed += 1;
      } else {
        reviewer.pending += 1;
      }

      // Decision distribution
      const decision = (review.decision || '').toLowerCase();
      if (decision === 'approved' || decision === 'recommended' || decision === 'recommend') {
        reviewer.decisions.approved += 1;
      } else if (decision === 'rejected') {
        reviewer.decisions.rejected += 1;
      } else if (decision === 'changes_required') {
        reviewer.decisions.revisionRequested += 1;
      } else if (decision === 'sent_back') {
        reviewer.decisions.sentBack += 1;
      }

      reviewer.timeline.push({
        applicationId: application.id,
        category: categoryKey,
        title: application.title || 'Untitled',
        submittedAt: application.submittedAt || application.createdAt || null,
        assignedAt: assignedAt ? assignedAt.toISOString() : null,
        firstResponseAt: respondedAt ? respondedAt.toISOString() : null,
        turnaroundHours: turnaround,
        decision: review.decision || 'pending',
        school: application.school?.shortName || application.school?.facultyName || '',
        department: application.department?.shortName || application.department?.departmentName || '',
      });
    };

    researchReviews.forEach((r) => {
      const cat = this._researchBreakdownKey(r.researchContribution?.publicationType);
      processReview(r, cat, r.researchContribution);
    });
    iprReviews.forEach((r) => processReview(r, 'ipr', r.iprApplication));
    grantReviews.forEach((r) => processReview(r, 'grants', r.grantApplication));

    // Enrich reviewer names
    const reviewerIds = [...reviewerMap.keys()];
    if (reviewerIds.length > 0) {
      const users = await prisma.userLogin.findMany({
        where: { id: { in: reviewerIds } },
        select: {
          id: true,
          uid: true,
          employeeDetails: { select: { displayName: true, primaryDepartmentId: true } },
        },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));
      reviewerMap.forEach((reviewer, key) => {
        const profile = userMap.get(key);
        if (profile) {
          reviewer.reviewerName = profile.employeeDetails?.displayName || profile.uid || key;
        }
      });
    }

    // Compute avg/median turnaround
    const computeMedian = (arr) => {
      if (!arr.length) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));
    };

    const reviewerPerformance = [...reviewerMap.values()]
      .map((r) => ({
        reviewerId: r.reviewerId,
        reviewerName: r.reviewerName,
        assigned: r.assigned,
        reviewed: r.reviewed,
        pending: r.pending,
        avgTurnaroundHours: avgHours(r.turnaroundHours),
        medianTurnaroundHours: computeMedian(r.turnaroundHours),
        lastActiveAt: r.timeline.length > 0
          ? r.timeline
              .filter((t) => t.firstResponseAt)
              .sort((a, b) => new Date(b.firstResponseAt) - new Date(a.firstResponseAt))[0]?.firstResponseAt || null
          : null,
        decisionDistribution: r.decisions,
      }))
      .sort((a, b) => b.reviewed - a.reviewed || a.avgTurnaroundHours - b.avgTurnaroundHours);

    // Aggregate KPIs
    const allTurnarounds = reviewerPerformance.flatMap((r) =>
      reviewerMap.get(r.reviewerId)?.turnaroundHours || []
    );

    return {
      meta: buildMeta('drd_member_performance', access, from, to),
      kpis: {
        totalReviewers: reviewerPerformance.length,
        totalAssigned: reviewerPerformance.reduce((s, r) => s + r.assigned, 0),
        totalReviewed: reviewerPerformance.reduce((s, r) => s + r.reviewed, 0),
        totalPending: reviewerPerformance.reduce((s, r) => s + r.pending, 0),
        avgTurnaroundHours: avgHours(allTurnarounds),
        medianTurnaroundHours: computeMedian(allTurnarounds),
      },
      reviewerPerformance,
      trends: {
        monthly: buildReviewerMonthlyTrend({
          assignedResearch: [],
          assignedIpr: [],
          assignedGrants: [],
          researchReviews,
          iprReviews,
          grantReviews,
          from,
          to,
        }),
      },
      extensions: {
        selfView: !access.canViewAllReviewers,
      },
    };
  }

  /**
   * Individual reviewer detail with per-application timeline.
   */
  async getReviewerPerformanceDetail(user, reviewerId, filters = {}) {
    const performance = await this.getDrdMemberPerformance(user, {
      ...filters,
      reviewerId,
    });
    const reviewer = performance.reviewerPerformance.find((r) => r.reviewerId === reviewerId);
    if (!reviewer) {
      const error = new Error('Reviewer performance not found');
      error.statusCode = 404;
      throw error;
    }

    // Get full timeline for this reviewer
    const reviewerData = [...(function* () {
      // Re-derive from the internal map — fallback to re-query
    })()];

    // Re-fetch detailed timeline for this specific reviewer
    const access = await this._resolveAccess(user, DRD_MEMBER_ANALYTICS, {
      schoolFields: ['assignedDrdMemberAnalyticsSchoolIds', 'assignedSchoolIds'],
      departmentFields: ['assignedDrdMemberAnalyticsDepartmentIds'],
    });
    const from = parseDate(filters.from, new Date(new Date().setMonth(new Date().getMonth() - 12)));
    const to = parseEndDate(filters.to, new Date());
    const scopeWhere = createScopeWhere(access, filters.schoolId, filters.departmentId);
    const category = filters.category || 'all';

    const [researchReviews, iprReviews, grantReviews] = await Promise.all([
      ['all', 'research', 'book', 'conference'].includes(category)
        ? prisma.researchContributionReview.findMany({
            where: {
              reviewerId,
              reviewedAt: { gte: from, lte: to },
              researchContribution: {
                AND: [scopeWhere, this._reviewPublicationWhere(category)],
              },
            },
            select: {
              decision: true,
              reviewedAt: true,
              createdAt: true,
              researchContribution: {
                select: {
                  id: true, title: true, publicationType: true, status: true,
                  submittedAt: true, createdAt: true, schoolId: true, departmentId: true,
                  school: { select: { facultyName: true, shortName: true } },
                  department: { select: { departmentName: true, shortName: true } },
                },
              },
            },
          })
        : [],
      category === 'all' || category === 'ipr'
        ? prisma.iprReview.findMany({
            where: { reviewerId, reviewedAt: { gte: from, lte: to }, iprApplication: scopeWhere },
            select: {
              decision: true, reviewedAt: true, createdAt: true,
              iprApplication: {
                select: {
                  id: true, title: true, status: true,
                  submittedAt: true, createdAt: true, schoolId: true, departmentId: true,
                  school: { select: { facultyName: true, shortName: true } },
                  department: { select: { departmentName: true, shortName: true } },
                },
              },
            },
          })
        : [],
      category === 'all' || category === 'grants'
        ? prisma.grantApplicationReview.findMany({
            where: { reviewerId, reviewedAt: { gte: from, lte: to }, grantApplication: scopeWhere },
            select: {
              decision: true, reviewedAt: true, createdAt: true,
              grantApplication: {
                select: {
                  id: true, title: true, status: true,
                  submittedAt: true, createdAt: true, schoolId: true, departmentId: true,
                  school: { select: { facultyName: true, shortName: true } },
                  department: { select: { departmentName: true, shortName: true } },
                },
              },
            },
          })
        : [],
    ]);

    const timeline = [];
    const buildEntry = (review, cat, app) => {
      if (!app) return;
      const assignedAt = review.createdAt ? new Date(review.createdAt) : null;
      const respondedAt = review.reviewedAt ? new Date(review.reviewedAt) : null;
      timeline.push({
        applicationId: app.id,
        category: cat,
        title: app.title || 'Untitled',
        submittedAt: app.submittedAt || app.createdAt || null,
        assignedAt: assignedAt ? assignedAt.toISOString() : null,
        firstResponseAt: respondedAt ? respondedAt.toISOString() : null,
        turnaroundHours: assignedAt && respondedAt
          ? Number(((respondedAt.getTime() - assignedAt.getTime()) / 36e5).toFixed(2))
          : null,
        decision: review.decision || 'pending',
        school: app.school?.shortName || app.school?.facultyName || '',
        department: app.department?.shortName || app.department?.departmentName || '',
      });
    };

    researchReviews.forEach((r) => buildEntry(r, this._researchBreakdownKey(r.researchContribution?.publicationType), r.researchContribution));
    iprReviews.forEach((r) => buildEntry(r, 'ipr', r.iprApplication));
    grantReviews.forEach((r) => buildEntry(r, 'grants', r.grantApplication));

    timeline.sort((a, b) => new Date(b.assignedAt || 0) - new Date(a.assignedAt || 0));

    // Compute monthly trend for this reviewer
    const turnarounds = timeline.filter((t) => t.turnaroundHours !== null).map((t) => t.turnaroundHours);
    const computeMedian = (arr) => {
      if (!arr.length) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));
    };

    // Enrich reviewer name
    let reviewerName = reviewerId;
    try {
      const profile = await prisma.userLogin.findUnique({
        where: { id: reviewerId },
        select: { uid: true, employeeDetails: { select: { displayName: true } } },
      });
      if (profile) {
        reviewerName = profile.employeeDetails?.displayName || profile.uid || reviewerId;
      }
    } catch (_) { /* ignore */ }

    return {
      reviewer: {
        id: reviewerId,
        name: reviewerName,
      },
      kpis: {
        assigned: timeline.length,
        reviewed: timeline.filter((t) => t.firstResponseAt).length,
        pending: timeline.filter((t) => !t.firstResponseAt).length,
        avgTurnaroundHours: avgHours(turnarounds),
        medianTurnaroundHours: computeMedian(turnarounds),
        decisionDistribution: {
          approved: timeline.filter((t) => ['approved', 'recommended', 'recommend'].includes((t.decision || '').toLowerCase())).length,
          rejected: timeline.filter((t) => t.decision?.toLowerCase() === 'rejected').length,
          sentBack: timeline.filter((t) => t.decision?.toLowerCase() === 'sent_back').length,
          revisionRequested: timeline.filter((t) => t.decision?.toLowerCase() === 'changes_required').length,
        },
      },
      timeline,
      meta: buildMeta('reviewer_detail', access, from, to),
    };
  }

  // ─── Progress Tracker Analytics ──────────────────────────────────────────────

  async getProgressTrackerAnalytics(user, filters = {}) {
    const {
      from: fromRaw,
      to: toRaw,
      schoolId,
      departmentId,
      publicationType,
    } = filters;

    const from = parseDate(fromRaw, new Date(Date.now() - 365 * 86400e3));
    const to = parseEndDate(toRaw, new Date());

    // Reuse applicant_analytics scope (same school/dept access model)
    const access = await this._resolveAccess(user, APPLICANT_ANALYTICS, {
      permissionKeys: [APPLICANT_ANALYTICS],
      schoolFields: ['assignedSchoolIds'],
      departmentFields: [],
    });

    // Analytics result cache — 2 minutes
    const trackerCacheKey = `drd:tracker:${user.id}:${toIsoDate(from)}:${toIsoDate(to)}:${schoolId || ''}:${departmentId || ''}:${publicationType || ''}`;
    const cachedTracker = await cache.get(trackerCacheKey);
    if (cachedTracker) return cachedTracker;

    const scopeWhere = createScopeWhere(access, schoolId, departmentId);

    const typeFilter =
      publicationType && publicationType !== 'all' ? { publicationType } : {};

    const baseWhere = {
      AND: [
        scopeWhere,
        typeFilter,
        { createdAt: { gte: from, lte: to } },
      ],
    };

    // Fetch trackers first, then query status history using trackerId IN (trackerIds).
    // This avoids the expensive correlated subquery that Prisma generates for
    // { tracker: baseWhere } — a direct IN-list lets Postgres use the trackerId index.
    // orderBy + take ensures Postgres uses the (schoolId/departmentId, createdAt) composite index.
    const trackers = await prisma.researchProgressTracker.findMany({
      where: baseWhere,
      orderBy: { createdAt: 'desc' },
      take: 2000,
      select: {
        id: true,
        userId: true,
        publicationType: true,
        currentStatus: true,
        schoolId: true,
        departmentId: true,
        createdAt: true,
        actualCompletionDate: true,
        school: { select: { facultyName: true, shortName: true } },
        department: { select: { departmentName: true, shortName: true } },
        user: {
          select: {
            uid: true,
            employeeDetails: { select: { displayName: true } },
            studentLogin: { select: { displayName: true } },
          },
        },
      },
    });

    const trackerIds = trackers.map((t) => t.id);
    const statusHistory = trackerIds.length > 0
      ? await prisma.researchProgressStatusHistory.findMany({
          where: { trackerId: { in: trackerIds } },
          select: {
            trackerId: true,
            fromStatus: true,
            toStatus: true,
            changedAt: true,
          },
          orderBy: { changedAt: 'asc' },
        })
      : [];

    const TERMINAL_STATUSES = new Set(['published', 'rejected']);
    const STATUS_ORDER = [
      'writing',
      'communicated',
      'submitted',
      'accepted',
      'published',
      'rejected',
    ];
    const PUB_TYPES = [
      'research_paper',
      'book',
      'book_chapter',
      'conference_paper',
      'grant_proposal',
    ];

    // ── KPIs ──
    const totalTrackers = trackers.length;
    const activeTrackers = trackers.filter(
      (t) => !TERMINAL_STATUSES.has(t.currentStatus),
    ).length;
    const publishedCount = trackers.filter(
      (t) => t.currentStatus === 'published',
    ).length;
    const rejectedCount = trackers.filter(
      (t) => t.currentStatus === 'rejected',
    ).length;
    const completionRate =
      totalTrackers > 0
        ? Number(((publishedCount / totalTrackers) * 100).toFixed(1))
        : 0;
    const uniqueUsers = new Set(trackers.map((t) => t.userId)).size;

    // ── Status Funnel ──
    const statusCounts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]));
    trackers.forEach((t) => {
      if (statusCounts[t.currentStatus] !== undefined) {
        statusCounts[t.currentStatus] += 1;
      }
    });
    const statusFunnel = STATUS_ORDER.map((s) => ({
      status: s,
      count: statusCounts[s],
    }));

    // ── Category Breakdown ──
    const categoryBreakdown = Object.fromEntries(
      PUB_TYPES.map((pt) => [
        pt,
        { publicationType: pt, total: 0, active: 0, published: 0, rejected: 0 },
      ]),
    );
    trackers.forEach((t) => {
      const cb = categoryBreakdown[t.publicationType];
      if (!cb) return;
      cb.total += 1;
      if (!TERMINAL_STATUSES.has(t.currentStatus)) cb.active += 1;
      if (t.currentStatus === 'published') cb.published += 1;
      if (t.currentStatus === 'rejected') cb.rejected += 1;
    });

    // ── Active Users Leaderboard ──
    const userMap = new Map();
    trackers.forEach((t) => {
      if (!userMap.has(t.userId)) {
        const name =
          t.user?.employeeDetails?.displayName ||
          t.user?.studentLogin?.displayName ||
          t.user?.uid ||
          'Unknown';
        const schoolName =
          t.school?.shortName || t.school?.facultyName || 'Unassigned';
        const deptName =
          t.department?.shortName ||
          t.department?.departmentName ||
          'Unassigned';
        userMap.set(t.userId, {
          userId: t.userId,
          name,
          schoolName,
          departmentName: deptName,
          totalTrackers: 0,
          activeTrackers: 0,
          publishedCount: 0,
          statusTransitions: 0,
        });
      }
      const u = userMap.get(t.userId);
      u.totalTrackers += 1;
      if (!TERMINAL_STATUSES.has(t.currentStatus)) u.activeTrackers += 1;
      if (t.currentStatus === 'published') u.publishedCount += 1;
    });

    const trackerUserMap = new Map(trackers.map((t) => [t.id, t.userId]));
    statusHistory.forEach((h) => {
      const userId = trackerUserMap.get(h.trackerId);
      if (userId && userMap.has(userId)) {
        userMap.get(userId).statusTransitions += 1;
      }
    });

    const activeUsers = [...userMap.values()]
      .sort(
        (a, b) =>
          b.totalTrackers - a.totalTrackers ||
          b.statusTransitions - a.statusTransitions,
      )
      .slice(0, 25);

    // ── School Breakdown ──
    const schoolMap = new Map();
    trackers.forEach((t) => {
      const key = t.schoolId || 'unassigned';
      if (!schoolMap.has(key)) {
        schoolMap.set(key, {
          schoolId: t.schoolId || 'unassigned',
          schoolName:
            t.school?.shortName || t.school?.facultyName || 'Unassigned',
          totalTrackers: 0,
          activeTrackers: 0,
          publishedCount: 0,
        });
      }
      const s = schoolMap.get(key);
      s.totalTrackers += 1;
      if (!TERMINAL_STATUSES.has(t.currentStatus)) s.activeTrackers += 1;
      if (t.currentStatus === 'published') s.publishedCount += 1;
    });

    // ── Department Breakdown ──
    const deptBreakMap = new Map();
    trackers.forEach((t) => {
      const key = t.departmentId || 'unassigned';
      if (!deptBreakMap.has(key)) {
        deptBreakMap.set(key, {
          departmentId: t.departmentId || 'unassigned',
          departmentName:
            t.department?.shortName ||
            t.department?.departmentName ||
            'Unassigned',
          schoolId: t.schoolId || null,
          schoolName:
            t.school?.shortName || t.school?.facultyName || 'Unassigned',
          totalTrackers: 0,
          activeTrackers: 0,
          publishedCount: 0,
        });
      }
      const d = deptBreakMap.get(key);
      d.totalTrackers += 1;
      if (!TERMINAL_STATUSES.has(t.currentStatus)) d.activeTrackers += 1;
      if (t.currentStatus === 'published') d.publishedCount += 1;
    });

    // ── Monthly Trend ──
    const bucketMap = createMonthlyBucketMap(from, to, () => ({
      total: 0,
      research_paper: 0,
      book: 0,
      book_chapter: 0,
      conference_paper: 0,
      grant_proposal: 0,
      published: 0,
    }));
    trackers.forEach((t) => {
      updateMonthlyBucket(bucketMap, t.createdAt, (bucket) => {
        bucket.total += 1;
        if (bucket[t.publicationType] !== undefined) {
          bucket[t.publicationType] += 1;
        }
        if (t.currentStatus === 'published') bucket.published += 1;
      });
    });

    // ── Avg Days in Each Status ──
    const statusDurations = Object.fromEntries(STATUS_ORDER.map((s) => [s, []]));
    const historyByTracker = new Map();
    statusHistory.forEach((h) => {
      if (!historyByTracker.has(h.trackerId)) {
        historyByTracker.set(h.trackerId, []);
      }
      historyByTracker.get(h.trackerId).push(h);
    });
    historyByTracker.forEach((history) => {
      for (let i = 0; i < history.length - 1; i += 1) {
        const current = history[i];
        const next = history[i + 1];
        const status = current.toStatus;
        if (statusDurations[status]) {
          const days =
            (new Date(next.changedAt).getTime() -
              new Date(current.changedAt).getTime()) /
            (1000 * 60 * 60 * 24);
          if (days >= 0 && days < 3650) {
            statusDurations[status].push(days);
          }
        }
      }
    });
    const avgDaysPerStatus = Object.fromEntries(
      STATUS_ORDER.map((s) => {
        const vals = statusDurations[s];
        return [
          s,
          vals.length > 0
            ? Number(
                (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1),
              )
            : null,
        ];
      }),
    );

    const trackerResult = {
      meta: {
        analyticsType: 'progress_tracker',
        scopeApplied: {
          schoolIds: access.allowedSchoolIds,
          departmentIds: access.allowedDepartmentIds,
          scopeLevel: access.scopeLevel,
          resolution: 'union',
        },
        timeRange: { from: toIsoDate(from), to: toIsoDate(to) },
        filters: { publicationType, schoolId, departmentId },
      },
      kpis: {
        totalTrackers,
        activeTrackers,
        publishedCount,
        rejectedCount,
        completionRate,
        uniqueUsers,
        totalStatusTransitions: statusHistory.length,
      },
      statusFunnel,
      categoryBreakdown: Object.values(categoryBreakdown),
      activeUsers,
      schoolWise: [...schoolMap.values()].sort(
        (a, b) => b.totalTrackers - a.totalTrackers,
      ),
      departmentWise: [...deptBreakMap.values()].sort(
        (a, b) => b.totalTrackers - a.totalTrackers,
      ),
      monthlyTrend: [...bucketMap.values()],
      avgDaysPerStatus,
    };

    await cache.set(trackerCacheKey, trackerResult, 300); // 5 minutes
    return trackerResult;
  }

  async getProgressTrackerRecords(user, filters = {}) {
    const {
      from: fromRaw,
      to: toRaw,
      schoolId,
      departmentId,
      publicationType,
      status,
      userId,
    } = filters;

    const from = parseDate(fromRaw, new Date(Date.now() - 365 * 86400e3));
    const to = parseEndDate(toRaw, new Date());

    const access = await this._resolveAccess(user, APPLICANT_ANALYTICS, {
      permissionKeys: [APPLICANT_ANALYTICS],
      schoolFields: ['assignedSchoolIds'],
      departmentFields: [],
    });

    const scopeWhere = createScopeWhere(access, schoolId, departmentId);
    const where = {
      AND: [
        scopeWhere,
        { createdAt: { gte: from, lte: to } },
        publicationType && publicationType !== 'all' ? { publicationType } : {},
        status && status !== 'all' ? { currentStatus: status } : {},
        userId ? { userId } : {},
      ],
    };

    const records = await prisma.researchProgressTracker.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: 150,
      select: {
        id: true,
        trackingNumber: true,
        userId: true,
        title: true,
        publicationType: true,
        currentStatus: true,
        schoolId: true,
        departmentId: true,
        expectedCompletionDate: true,
        actualCompletionDate: true,
        createdAt: true,
        updatedAt: true,
        school: { select: { facultyName: true, shortName: true } },
        department: { select: { departmentName: true, shortName: true } },
        user: {
          select: {
            uid: true,
            employeeDetails: { select: { displayName: true } },
            studentLogin: { select: { displayName: true } },
          },
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          take: 1,
          select: { changedAt: true },
        },
        researchContribution: {
          select: {
            id: true,
            applicationNumber: true,
            status: true,
            incentiveAmount: true,
            pointsAwarded: true,
          },
        },
      },
    });

    return {
      meta: {
        analyticsType: 'progress_tracker_records',
        scopeApplied: {
          schoolIds: access.allowedSchoolIds,
          departmentIds: access.allowedDepartmentIds,
          scopeLevel: access.scopeLevel,
          resolution: 'union',
        },
        timeRange: { from: toIsoDate(from), to: toIsoDate(to) },
        filters: { publicationType, schoolId, departmentId, status, userId },
      },
      totalCount: records.length,
      records: records.map(mapTrackerRecord),
    };
  }

  /**
   * Flat list of research contributions for the analytics "Papers" table.
   * Filters: from, to, schoolId, departmentId, publicationType, status
   */
  async getContributionsList(user, filters = {}) {
    const {
      from: fromRaw,
      to: toRaw,
      schoolId,
      departmentId,
      publicationType,
      status,
    } = filters;

    const from = parseDate(fromRaw, new Date(Date.now() - 365 * 86400e3));
    const to = parseEndDate(toRaw, new Date());

    const access = await this._resolveAccess(user, APPLICANT_ANALYTICS, {
      permissionKeys: [APPLICANT_ANALYTICS],
      schoolFields: ['assignedSchoolIds'],
      departmentFields: [],
    });

    const scopeWhere = createScopeWhere(access, schoolId, departmentId);

    // Determine which tables to query based on publicationType filter
    const filterPub = publicationType && publicationType !== 'all' ? publicationType : null;
    const needsResearch = !filterPub || ['research_paper', 'book', 'book_chapter', 'conference_paper'].includes(filterPub);
    const needsIpr      = !filterPub || filterPub === 'ipr';
    const needsGrant    = !filterPub || filterPub === 'grant_proposal';

    const LEAN_APPLICANT_SELECT = {
      id: true,
      applicationNumber: true,
      title: true,
      status: true,
      submittedAt: true,
      updatedAt: true,
      schoolId: true,
      departmentId: true,
      school: { select: { facultyName: true, shortName: true } },
      department: { select: { departmentName: true, shortName: true } },
      applicantUser: {
        select: {
          id: true,
          uid: true,
          employeeDetails: { select: { displayName: true } },
          studentLogin: { select: { displayName: true } },
        },
      },
    };

    const baseDateWhere = {
      AND: [
        scopeWhere,
        { submittedAt: { gte: from, lte: to } },
        { status: { notIn: ['draft', 'cancelled'] } },
        status && status !== 'all' ? { status } : {},
      ],
    };

    const [researchRows, iprRows, grantRows] = await Promise.all([
      needsResearch
        ? prisma.researchContribution.findMany({
            where: {
              ...baseDateWhere,
              AND: [
                ...(baseDateWhere.AND || []),
                filterPub ? { publicationType: filterPub } : {},
              ],
            },
            orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
            take: 200,
            select: { ...LEAN_APPLICANT_SELECT, publicationType: true },
          })
        : [],
      needsIpr
        ? prisma.iprApplication.findMany({
            where: baseDateWhere,
            orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
            take: 200,
            select: LEAN_APPLICANT_SELECT,
          })
        : [],
      needsGrant
        ? prisma.grantApplication.findMany({
            where: baseDateWhere,
            orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
            take: 200,
            select: LEAN_APPLICANT_SELECT,
          })
        : [],
    ]);

    function mapRow(r, pubType) {
      return {
        id: r.id,
        applicationNumber: r.applicationNumber || null,
        title: r.title,
        publicationType: pubType,
        status: r.status,
        submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
        updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
        userId: r.applicantUser?.id || null,
        userName:
          r.applicantUser?.employeeDetails?.displayName ||
          r.applicantUser?.studentLogin?.displayName ||
          r.applicantUser?.uid ||
          'Unknown',
        schoolId: r.schoolId || null,
        schoolName: r.school?.shortName || r.school?.facultyName || '—',
        departmentId: r.departmentId || null,
        departmentName: r.department?.shortName || r.department?.departmentName || '—',
      };
    }

    const allRecords = [
      ...researchRows.map((r) => mapRow(r, r.publicationType)),
      ...iprRows.map((r) => mapRow(r, 'ipr')),
      ...grantRows.map((r) => mapRow(r, 'grant_proposal')),
    ].sort((a, b) => {
      const at = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const bt = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return bt - at;
    }).slice(0, 200);

    return {
      meta: {
        analyticsType: 'contributions_list',
        scopeApplied: {
          schoolIds: access.allowedSchoolIds,
          departmentIds: access.allowedDepartmentIds,
          scopeLevel: access.scopeLevel,
          resolution: 'union',
        },
        timeRange: { from: toIsoDate(from), to: toIsoDate(to) },
        filters: { publicationType, schoolId, departmentId, status },
      },
      totalCount: allRecords.length,
      records: allRecords,
    };
  }

  /**
   * Category breakdown pie chart data for applicant analytics.
   * Returns per-category counts broken down by classification field:
   *   - research: by indexingCategories (11 categories)
   *   - book:     by bookPublicationType
   *   - conference: by conferenceType + conferenceSubType
   *   - grant:    by fundingAgency
   */
  async getCategoryBreakdown(user, filters = {}) {
    const from = parseDate(filters.from, new Date(new Date().setMonth(new Date().getMonth() - 12)));
    const to = parseEndDate(filters.to, new Date());

    // Cache key — 5 minutes
    const cacheKey = `drd:catBreakdown:${user.id}:${toIsoDate(from)}:${toIsoDate(to)}:${filters.schoolId || ''}:${filters.departmentId || ''}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const _base = await this._fetchUserBasePermissions(user);

    // Resolve access for every category in parallel (gracefully skip 403s)
    const categoryAccessMap = {};
    await Promise.all(
      Object.keys(APPLICANT_CATEGORY_CONFIG).map(async (cat) => {
        try {
          categoryAccessMap[cat] = await this._resolveApplicantAccessByCategory(user, cat, _base);
        } catch (err) {
          if (err.statusCode !== 403) throw err;
        }
      })
    );

    const RESEARCH_CATEGORY_LABELS = {
      nature_science_lancet_cell_nejm: 'Nature/Science/Lancet/Cell/NEJM',
      subsidiary_if_above_20: 'Subsidiary IF > 20',
      scopus: 'Scopus',
      scie_wos: 'SCIE / WoS',
      pubmed: 'PubMed',
      naas_rating_6_plus: 'NAAS Rating ≥ 6',
      abdc_scopus_wos: 'ABDC / Scopus / WoS',
      sgtu_in_house: 'SGT In-House',
      case_centre_uk: 'Case Centre UK',
      other_indexed: 'Other Indexed',
      non_indexed_reputed: 'Non-Indexed Reputed',
    };
    const BOOK_TYPE_LABELS = { authored: 'Authored Book', edited: 'Edited Book', chapter: 'Book Chapter', other: 'Other' };
    const CONF_TYPE_LABELS = { international: 'International', national: 'National' };
    const CONF_SUBTYPE_LABELS = {
      paper_indexed_scopus: 'Paper Indexed (Scopus)',
      paper_not_indexed: 'Paper Not Indexed',
      keynote_speaker_invited_talks: 'Keynote / Invited Talk',
      organizer_coordinator_member: 'Organizer / Coordinator',
    };
    const IPR_TYPE_LABELS = { patent: 'Patent', copyright: 'Copyright', trademark: 'Trademark', design: 'Design' };

    // ── Fire all 5 data queries IN PARALLEL ────────────────────────────────
    const [
      researchRawRows,
      bookRawRows,
      confRawRows,
      iprRawRows,
      grantRawRows,
    ] = await Promise.all([
      categoryAccessMap.research
        ? prisma.researchContribution.findMany({
            where: withDateScope(
              createScopeWhere(categoryAccessMap.research, filters.schoolId, filters.departmentId),
              from, to, [{ publicationType: 'research_paper' }]
            ),
            select: { indexingCategories: true },
          })
        : Promise.resolve([]),

      categoryAccessMap.book
        ? prisma.researchContribution.findMany({
            where: withDateScope(
              createScopeWhere(categoryAccessMap.book, filters.schoolId, filters.departmentId),
              from, to, [{ publicationType: { in: ['book', 'book_chapter'] } }]
            ),
            select: { bookPublicationType: true, publicationType: true },
          })
        : Promise.resolve([]),

      categoryAccessMap.conference
        ? prisma.researchContribution.findMany({
            where: withDateScope(
              createScopeWhere(categoryAccessMap.conference, filters.schoolId, filters.departmentId),
              from, to, [{ publicationType: 'conference_paper' }]
            ),
            select: { conferenceType: true, conferenceSubType: true },
          })
        : Promise.resolve([]),

      categoryAccessMap.ipr
        ? prisma.iprApplication.findMany({
            where: withDateScope(
              createScopeWhere(categoryAccessMap.ipr, filters.schoolId, filters.departmentId),
              from, to
            ),
            select: { iprType: true },
          })
        : Promise.resolve([]),

      categoryAccessMap.grants
        ? prisma.grantApplication.findMany({
            where: withDateScope(
              createScopeWhere(categoryAccessMap.grants, filters.schoolId, filters.departmentId),
              from, to
            ),
            select: { fundingAgencyName: true },
          })
        : Promise.resolve([]),
    ]);

    // ── Process research results ───────────────────────────────────────────
    const researchBreakdown = {};
    researchRawRows.forEach((row) => {
      const cats = Array.isArray(row.indexingCategories) && row.indexingCategories.length > 0
        ? row.indexingCategories
        : ['non_indexed_reputed'];
      cats.forEach((cat) => { researchBreakdown[cat] = (researchBreakdown[cat] || 0) + 1; });
    });
    const researchPie = Object.entries(RESEARCH_CATEGORY_LABELS)
      .map(([key, label]) => ({ key, label, count: researchBreakdown[key] || 0 }))
      .filter((item) => item.count > 0);

    // ── Process book results ───────────────────────────────────────────────
    const bookBreakdown = {};
    bookRawRows.forEach((row) => {
      const key = row.bookPublicationType || (row.publicationType === 'book_chapter' ? 'chapter' : 'other');
      bookBreakdown[key] = (bookBreakdown[key] || 0) + 1;
    });
    const bookPie = Object.entries(bookBreakdown).map(([key, count]) => ({
      key, label: BOOK_TYPE_LABELS[key] || key, count,
    }));

    // ── Process conference results ─────────────────────────────────────────
    const confBreakdownType = {};
    const confBreakdownSubType = {};
    confRawRows.forEach((row) => {
      const typeKey = row.conferenceType || 'national';
      confBreakdownType[typeKey] = (confBreakdownType[typeKey] || 0) + 1;
      if (row.conferenceSubType) {
        confBreakdownSubType[row.conferenceSubType] = (confBreakdownSubType[row.conferenceSubType] || 0) + 1;
      }
    });
    const conferencePie = Object.entries(confBreakdownType).map(([key, count]) => ({
      key, label: CONF_TYPE_LABELS[key] || key, count,
    }));
    const conferenceSubtypePie = Object.entries(confBreakdownSubType).map(([key, count]) => ({
      key, label: CONF_SUBTYPE_LABELS[key] || key, count,
    }));

    // ── Process IPR results ────────────────────────────────────────────────
    const iprBreakdown = {};
    iprRawRows.forEach((row) => { const key = row.iprType || 'other'; iprBreakdown[key] = (iprBreakdown[key] || 0) + 1; });
    const iprPie = Object.entries(iprBreakdown)
      .map(([key, count]) => ({ key, label: IPR_TYPE_LABELS[key] || key, count }))
      .sort((a, b) => b.count - a.count);

    // ── Process grant results ──────────────────────────────────────────────
    const grantBreakdown = {};
    grantRawRows.forEach((row) => {
      const key = (row.fundingAgencyName || 'Other').trim();
      grantBreakdown[key] = (grantBreakdown[key] || 0) + 1;
    });
    const grantPie = Object.entries(grantBreakdown)
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((a, b) => b.count - a.count);

    const result = {
      research: researchPie,
      book: bookPie,
      conference: conferencePie,
      conferenceSubtype: conferenceSubtypePie,
      ipr: iprPie,
      grant: grantPie,
      meta: { timeRange: { from: toIsoDate(from), to: toIsoDate(to) } },
    };

    await cache.set(cacheKey, result, 300); // 5 minutes
    return result;
  }
}

module.exports = new DrdAnalyticsService();
