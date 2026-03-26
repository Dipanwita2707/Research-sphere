const ANALYTICS_SCOPE_FIELD_TO_COLUMN = {
  assignedIprAnalyticsSchoolIds: 'assigned_ipr_analytics_school_ids',
  assignedResearchAnalyticsSchoolIds: 'assigned_research_analytics_school_ids',
  assignedBookAnalyticsSchoolIds: 'assigned_book_analytics_school_ids',
  assignedConferenceAnalyticsSchoolIds: 'assigned_conference_analytics_school_ids',
  assignedGrantAnalyticsSchoolIds: 'assigned_grant_analytics_school_ids',
  assignedIprAnalyticsDepartmentIds: 'assigned_ipr_analytics_department_ids',
  assignedResearchAnalyticsDepartmentIds: 'assigned_research_analytics_department_ids',
  assignedBookAnalyticsDepartmentIds: 'assigned_book_analytics_department_ids',
  assignedConferenceAnalyticsDepartmentIds: 'assigned_conference_analytics_department_ids',
  assignedGrantAnalyticsDepartmentIds: 'assigned_grant_analytics_department_ids',
  assignedDrdMemberAnalyticsSchoolIds: 'assigned_drd_member_analytics_school_ids',
  assignedDrdMemberAnalyticsDepartmentIds: 'assigned_drd_member_analytics_department_ids',
};

let cachedSupport = null;
let cachedAt = 0;
const CACHE_MS = 5 * 60 * 1000;
// Once all columns are confirmed present, never re-query (columns don't disappear at runtime)
let cacheIsPermanent = false;

async function getSupportedCentralDeptAnalyticsScopeFields(prisma) {
  const now = Date.now();
  if (cachedSupport && (cacheIsPermanent || now - cachedAt < CACHE_MS)) {
    return cachedSupport;
  }

  if (typeof prisma.$queryRawUnsafe !== 'function') {
    cachedSupport = Object.keys(ANALYTICS_SCOPE_FIELD_TO_COLUMN);
    cachedAt = now;
    return cachedSupport;
  }

  const rows = await prisma.$queryRawUnsafe(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'central_department_permission'
      AND column_name IN (
        'assigned_ipr_analytics_school_ids',
        'assigned_research_analytics_school_ids',
        'assigned_book_analytics_school_ids',
        'assigned_conference_analytics_school_ids',
        'assigned_grant_analytics_school_ids',
        'assigned_ipr_analytics_department_ids',
        'assigned_research_analytics_department_ids',
        'assigned_book_analytics_department_ids',
        'assigned_conference_analytics_department_ids',
        'assigned_grant_analytics_department_ids',
        'assigned_drd_member_analytics_school_ids',
        'assigned_drd_member_analytics_department_ids'
      )
  `);

  const existingColumns = new Set(rows.map((row) => row.column_name));
  cachedSupport = Object.entries(ANALYTICS_SCOPE_FIELD_TO_COLUMN)
    .filter(([, columnName]) => existingColumns.has(columnName))
    .map(([fieldName]) => fieldName);
  cachedAt = now;
  // If every expected column exists, make cache permanent — columns don't disappear
  if (cachedSupport.length === Object.keys(ANALYTICS_SCOPE_FIELD_TO_COLUMN).length) {
    cacheIsPermanent = true;
  }

  return cachedSupport;
}

function withSupportedAnalyticsScopeFields(base, supportedFields = []) {
  const next = { ...base };
  supportedFields.forEach((field) => {
    next[field] = true;
  });
  return next;
}

function pickSupportedAnalyticsScopeFields(source = {}, supportedFields = []) {
  return supportedFields.reduce((acc, field) => {
    acc[field] = source[field] || [];
    return acc;
  }, {});
}

function resetCentralDeptAnalyticsScopeSupportCache() {
  cachedSupport = null;
  cachedAt = 0;
}

module.exports = {
  getSupportedCentralDeptAnalyticsScopeFields,
  withSupportedAnalyticsScopeFields,
  pickSupportedAnalyticsScopeFields,
  resetCentralDeptAnalyticsScopeSupportCache,
};
