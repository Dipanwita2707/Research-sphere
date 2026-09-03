const ANALYTICS_SCOPE_FIELD_TO_COLUMN = {
  assignedSchoolIds: 'assigned_school_ids',
  assignedResearchSchoolIds: 'assigned_research_school_ids',
  assignedBookSchoolIds: 'assigned_book_school_ids',
  assignedConferenceSchoolIds: 'assigned_conference_school_ids',
  assignedGrantSchoolIds: 'assigned_grant_school_ids',
  assignedMonthlyReportSchoolIds: 'assigned_monthly_report_school_ids',
  assignedMonthlyReportDepartmentIds: 'assigned_monthly_report_department_ids',
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
        'assigned_school_ids',
        'assigned_research_school_ids',
        'assigned_book_school_ids',
        'assigned_conference_school_ids',
        'assigned_grant_school_ids',
        'assigned_monthly_report_school_ids',
        'assigned_monthly_report_department_ids'
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
