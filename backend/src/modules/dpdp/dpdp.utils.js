/**
 * @module dpdp/utils
 * @description Pure helpers for the DPDP module (no I/O), unit-tested directly.
 */
const {
  DEFAULT_REQUEST_SLA_DAYS,
  GRIEVANCE_MAX_DAYS,
  RETENTION_CATEGORIES,
  RETENTION_MAX_DAYS,
  MINOR_FORBIDDEN_PURPOSES,
  CORRECTABLE_FIELDS,
  BREACH_BOARD_REPORT_HOURS,
  BREACH_STATUS_ORDER,
  CONSENT_EXEMPT_PREFIXES,
  DPO_PLACEHOLDER,
} = require('./dpdp.constants');

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Is a person with this date of birth under 18 on `now`? (DPDP s. 2(f): child = under 18.)
 * Unknown date of birth → not treated as a minor (institutions verify age at admission).
 * @param {Date|string|null} dateOfBirth
 * @param {Date} [now]
 */
const isMinor = (dateOfBirth, now = new Date()) => {
  if (!dateOfBirth) return false;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return false;
  const eighteenthBirthdayCutoff = Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate());
  return dob.getTime() > eighteenthBirthdayCutoff;
};

/** SLA in days from env DPDP_REQUEST_SLA_DAYS (default 30, clamped 1..365). */
const getSlaDays = (env = process.env) => {
  const n = parseInt(env.DPDP_REQUEST_SLA_DAYS, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_REQUEST_SLA_DAYS;
  return Math.min(n, 365);
};

/**
 * Due date of a data principal request. Grievances are capped at 90 days (DPDP Rules 2025).
 * @param {string} type
 * @param {Date} [from]
 * @param {object} [env]
 */
const computeDueAt = (type, from = new Date(), env = process.env) => {
  let days = getSlaDays(env);
  if (type === 'grievance') days = Math.min(days, GRIEVANCE_MAX_DAYS);
  return new Date(from.getTime() + days * DAY_MS);
};

/** Board intimation deadline: detectedAt + 72 hours. */
const computeBoardReportDueAt = (detectedAt) => new Date(new Date(detectedAt).getTime() + BREACH_BOARD_REPORT_HOURS * 3600 * 1000);

/** Add overdue / dueSoon flags to a breach incident. */
const withBreachFlags = (incident, now = new Date()) => {
  const due = new Date(incident.boardReportDueAt).getTime();
  const pending = !incident.boardNotifiedAt && incident.status !== 'closed';
  return {
    ...incident,
    overdue: pending && now.getTime() > due,
    dueSoon: pending && now.getTime() <= due && due - now.getTime() <= 24 * 3600 * 1000,
    hoursToBoardDeadline: pending ? Math.round((due - now.getTime()) / 3600000) : null,
  };
};

/** Breach status may move forward (skipping allowed) but never backward; closed is final. */
const isValidBreachTransition = (from, to) => {
  if (from === to) return true;
  const a = BREACH_STATUS_ORDER.indexOf(from);
  const b = BREACH_STATUS_ORDER.indexOf(to);
  if (a < 0 || b < 0) return false;
  if (from === 'closed') return false;
  return b > a;
};

/**
 * Validate and normalise a retention policy entry. Throws Error with `.statusCode = 400` on invalid input.
 * @returns {{ category, retentionDays, action }}
 */
const normalizeRetentionPolicy = ({ category, retentionDays, action }) => {
  const def = RETENTION_CATEGORIES[category];
  const fail = (msg) => Object.assign(new Error(msg), { statusCode: 400, isOperational: true, status: 'fail' });
  if (!def) throw fail(`Unknown retention category "${category}"`);
  const days = Number(retentionDays);
  if (!Number.isInteger(days)) throw fail(`${category}: retentionDays must be a whole number`);
  if (days < def.minDays) throw fail(`${category}: retention cannot be less than ${def.minDays} days`);
  if (days > RETENTION_MAX_DAYS) throw fail(`${category}: retention cannot exceed ${RETENTION_MAX_DAYS} days`);
  const act = action || def.defaultAction;
  if (!def.actions.includes(act)) throw fail(`${category}: action must be one of ${def.actions.join(', ')}`);
  return { category, retentionDays: days, action: act };
};

/**
 * Effective retention policies: tenant row > platform row (universityId null) > built-in default.
 * Floors are re-applied so a bad DB row can never shorten audit log retention.
 * @param {Array} rows DataRetentionPolicy rows visible to the tenant
 * @param {string|null} tenantId
 */
const resolveEffectivePolicies = (rows, tenantId) => Object.entries(RETENTION_CATEGORIES).map(([category, def]) => {
  const active = (rows || []).filter((r) => r.category === category && r.isActive !== false);
  const tenantRow = def.platformOnly ? null : active.find((r) => tenantId && r.universityId === tenantId);
  const platformRow = active.find((r) => r.universityId === null || r.universityId === undefined);
  const row = tenantRow || platformRow;
  const retentionDays = Math.max(def.minDays, row ? row.retentionDays : def.defaultDays);
  const action = row && def.actions.includes(row.action) ? row.action : def.defaultAction;
  return {
    id: row?.id || null,
    category,
    label: def.label,
    retentionDays,
    action,
    minDays: def.minDays,
    allowedActions: def.actions,
    platformOnly: !!def.platformOnly,
    source: tenantRow ? 'tenant' : platformRow ? 'platform' : 'default',
    universityId: row ? row.universityId ?? null : null,
  };
});

/** Retention cutoff date for a number of days before `now`. */
const retentionCutoff = (days, now = new Date()) => new Date(now.getTime() - days * DAY_MS);

/**
 * Field values that replace personal data when a user is erased. Records that must be kept
 * (academic, financial, research-integrity, audit) stay linked by id but no longer identify the person.
 * @param {string} userId
 */
const buildAnonymisedFields = (userId, now = new Date()) => {
  const compact = String(userId).replace(/-/g, '');
  const placeholderName = 'Erased User';
  return {
    userLogin: {
      uid: `X${compact}`.slice(0, 32),
      email: `erased-${userId}@erased.invalid`,
      phone: null,
      profileImageFilePath: null,
      profileImage: null,
      status: 'erased',
      anonymizedAt: now,
      // unusable hash: bcrypt.compare always fails, so the account can never sign in again
      passwordHash: `!erased!${compact}`,
      failedLoginAttempts: 0,
      lockedUntil: null,
      tokenVersion: { increment: 1 },
    },
    employeeDetails: {
      firstName: 'Erased',
      lastName: 'User',
      displayName: placeholderName,
      photoFilePath: null,
      photo: null,
      email: null,
      phoneNumber: null,
      isActive: false,
      metadata: {},
    },
    studentDetails: {
      firstName: 'Erased',
      middleName: null,
      lastName: 'User',
      displayName: placeholderName,
      email: null,
      phone: null,
      photoFilePath: null,
      photo: null,
      photoPath: null,
      parentContact: null,
      emergencyContact: null,
      address: null,
      dateOfBirth: null,
      gender: null,
      bloodGroup: null,
      nationality: null,
      isActive: false,
      metadata: {},
    },
  };
};

/**
 * Split a correction request's `details` into updates per table, keeping only whitelisted fields.
 * @returns {{ user: object, student: object, employee: object, rejected: string[] }}
 */
const mapCorrectionDetails = (details = {}) => {
  const out = { user: {}, student: {}, employee: {}, rejected: [] };
  for (const [field, raw] of Object.entries(details || {})) {
    const spec = CORRECTABLE_FIELDS[field];
    if (!spec) { out.rejected.push(field); continue; }
    let value = raw === '' ? null : raw;
    if (spec.type === 'date') {
      if (value !== null) {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) { out.rejected.push(field); continue; }
        value = d;
      }
    } else if (value !== null) {
      value = String(value).trim();
      if (spec.max && value.length > spec.max) { out.rejected.push(field); continue; }
    }
    if (spec.user) out.user[spec.user] = value;
    if (spec.student) out.student[spec.student] = value;
    if (spec.employee) out.employee[spec.employee] = value;
  }
  return out;
};

/** Purposes of a notice as a clean array. */
const noticePurposes = (notice) => (Array.isArray(notice?.purposes) ? notice.purposes : []);

/** A record currently counts as a grant. */
const isGranted = (record) => !!record && record.granted === true && !record.withdrawnAt;

/**
 * Consent state of one user for one notice. Pure: all inputs are passed in.
 * @param {object} p
 * @param {object|null} p.notice active notice (or null)
 * @param {Array} p.records ConsentRecord rows of this user for this notice
 * @param {boolean} p.isMinor
 * @param {boolean} p.guardianRequiredByTenant University.requireGuardianConsentForMinors
 */
const computeConsentState = ({ notice, records = [], isMinor: minor = false, guardianRequiredByTenant = true }) => {
  const requiresGuardian = !!(minor && guardianRequiredByTenant);
  if (!notice) {
    return { needsConsent: false, isMinor: minor, requiresGuardian, guardianPending: false, blocked: false };
  }
  const byPurpose = new Map(records.map((r) => [r.purpose, r]));
  const required = noticePurposes(notice).filter((p) => p.required);
  const needsConsent = required.some((p) => !isGranted(byPurpose.get(p.key)));
  const guardianPending = requiresGuardian && !needsConsent
    && required.some((p) => !byPurpose.get(p.key)?.guardianVerifiedAt);
  return { needsConsent, isMinor: minor, requiresGuardian, guardianPending, blocked: needsConsent || guardianPending };
};

/**
 * Normalise a user's decisions against a notice: unknown purposes rejected, required purposes
 * must be granted, purposes forbidden for minors forced to false.
 * @returns {{ decisions: Array<{purpose, granted}>, forcedOff: string[], errors: string[] }}
 */
const normalizeDecisions = (notice, rawDecisions = [], { isMinor: minor = false } = {}) => {
  const purposes = noticePurposes(notice);
  const known = new Map(purposes.map((p) => [p.key, p]));
  const given = new Map();
  const errors = [];
  for (const d of rawDecisions) {
    if (!known.has(d.purpose)) { errors.push(`Unknown purpose "${d.purpose}"`); continue; }
    given.set(d.purpose, d.granted === true);
  }
  const forcedOff = [];
  const decisions = purposes.map((p) => {
    let granted = given.has(p.key) ? given.get(p.key) : false;
    if (minor && MINOR_FORBIDDEN_PURPOSES.includes(p.key) && granted) { granted = false; forcedOff.push(p.key); }
    if (p.required && !granted) errors.push(`Consent for "${p.label || p.key}" is required to use the service`);
    return { purpose: p.key, granted };
  });
  return { decisions, forcedOff, errors };
};

/**
 * Should the consent gate evaluate this request path at all?
 * @param {string} path path relative to the API prefix, e.g. '/research/list'
 */
const isConsentExemptPath = (path = '') => CONSENT_EXEMPT_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * Decision of the consent middleware given who the user is and their consent state.
 * @returns {'allow'|'block'}
 */
const consentDecision = ({ user, path, state }) => {
  if (!user) return 'allow';
  if (user.role === 'superadmin') return 'allow';
  if (isConsentExemptPath(path)) return 'allow';
  if (!state) return 'allow';
  return state.blocked ? 'block' : 'allow';
};

/** Fill DPO placeholders in notice markdown. */
const renderNoticeContent = (content, university) => String(content || '')
  .replace(/\{\{DPO_NAME\}\}/g, university?.dpoName || DPO_PLACEHOLDER)
  .replace(/\{\{DPO_EMAIL\}\}/g, university?.dpoEmail || DPO_PLACEHOLDER)
  .replace(/\{\{DPO_PHONE\}\}/g, university?.dpoPhone || DPO_PLACEHOLDER);

/** Escape text for inclusion in HTML email bodies. */
const escapeHtml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** A valid inet value for AuditLog.ipAddress, or null. */
const safeIp = (ip) => {
  if (!ip || typeof ip !== 'string') return null;
  const v = ip.startsWith('::ffff:') ? ip.slice(7) : ip.trim();
  return /^[0-9a-fA-F:.]{2,45}$/.test(v) ? v : null;
};

module.exports = {
  DAY_MS,
  isMinor,
  getSlaDays,
  computeDueAt,
  computeBoardReportDueAt,
  withBreachFlags,
  isValidBreachTransition,
  normalizeRetentionPolicy,
  resolveEffectivePolicies,
  retentionCutoff,
  buildAnonymisedFields,
  mapCorrectionDetails,
  noticePurposes,
  isGranted,
  computeConsentState,
  normalizeDecisions,
  isConsentExemptPath,
  consentDecision,
  renderNoticeContent,
  escapeHtml,
  safeIp,
};
