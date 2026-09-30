const {
  isMinor,
  computeDueAt,
  getSlaDays,
  computeBoardReportDueAt,
  withBreachFlags,
  isValidBreachTransition,
  normalizeRetentionPolicy,
  resolveEffectivePolicies,
  buildAnonymisedFields,
  mapCorrectionDetails,
  computeConsentState,
  normalizeDecisions,
  consentDecision,
  isConsentExemptPath,
  renderNoticeContent,
  DAY_MS,
} = require('../dpdp.utils');
const { DEFAULT_NOTICE } = require('../dpdp.constants');

const notice = { id: 'n1', purposes: DEFAULT_NOTICE.purposes };

describe('isMinor', () => {
  const now = new Date(Date.UTC(2026, 8, 30)); // 2026-09-30
  it('is true for someone under 18', () => {
    expect(isMinor(new Date(Date.UTC(2010, 0, 1)), now)).toBe(true);
    expect(isMinor('2008-10-01', now)).toBe(true); // turns 18 tomorrow
  });
  it('is false on and after the 18th birthday', () => {
    expect(isMinor('2008-09-30', now)).toBe(false);
    expect(isMinor('2000-01-01', now)).toBe(false);
  });
  it('treats unknown or invalid DOB as not a minor', () => {
    expect(isMinor(null, now)).toBe(false);
    expect(isMinor('not-a-date', now)).toBe(false);
  });
  it('handles a 29 February birthday in a non-leap year', () => {
    const feb28 = new Date(Date.UTC(2026, 1, 28));
    expect(isMinor('2008-02-29', feb28)).toBe(true);
    expect(isMinor('2008-02-29', new Date(Date.UTC(2026, 2, 1)))).toBe(false);
  });
});

describe('request SLA', () => {
  const from = new Date(Date.UTC(2026, 0, 1));
  it('defaults to 30 days', () => {
    expect(getSlaDays({})).toBe(30);
    expect(computeDueAt('access', from, {}).getTime() - from.getTime()).toBe(30 * DAY_MS);
  });
  it('uses DPDP_REQUEST_SLA_DAYS', () => {
    expect(computeDueAt('erasure', from, { DPDP_REQUEST_SLA_DAYS: '15' }).getTime() - from.getTime()).toBe(15 * DAY_MS);
  });
  it('caps grievances at 90 days', () => {
    expect(computeDueAt('grievance', from, { DPDP_REQUEST_SLA_DAYS: '120' }).getTime() - from.getTime()).toBe(90 * DAY_MS);
    expect(computeDueAt('access', from, { DPDP_REQUEST_SLA_DAYS: '120' }).getTime() - from.getTime()).toBe(120 * DAY_MS);
  });
  it('ignores invalid values', () => {
    expect(getSlaDays({ DPDP_REQUEST_SLA_DAYS: '0' })).toBe(30);
    expect(getSlaDays({ DPDP_REQUEST_SLA_DAYS: 'abc' })).toBe(30);
  });
});

describe('breaches', () => {
  it('board report is due 72h after detection', () => {
    const d = new Date('2026-09-01T10:00:00Z');
    expect(computeBoardReportDueAt(d).toISOString()).toBe('2026-09-04T10:00:00.000Z');
  });
  it('flags overdue and due-soon incidents', () => {
    const now = new Date('2026-09-05T00:00:00Z');
    expect(withBreachFlags({ status: 'detected', boardReportDueAt: '2026-09-04T10:00:00Z' }, now).overdue).toBe(true);
    expect(withBreachFlags({ status: 'detected', boardReportDueAt: '2026-09-05T10:00:00Z' }, now).dueSoon).toBe(true);
    expect(withBreachFlags({ status: 'detected', boardNotifiedAt: now, boardReportDueAt: '2026-09-04T10:00:00Z' }, now).overdue).toBe(false);
  });
  it('allows forward transitions only', () => {
    expect(isValidBreachTransition('detected', 'board_notified')).toBe(true);
    expect(isValidBreachTransition('board_notified', 'contained')).toBe(false);
    expect(isValidBreachTransition('closed', 'detected')).toBe(false);
    expect(isValidBreachTransition('detected', 'bogus')).toBe(false);
  });
});

describe('retention policies', () => {
  it('enforces the audit log floor of 365 days', () => {
    expect(() => normalizeRetentionPolicy({ category: 'audit_log', retentionDays: 364 })).toThrow(/less than 365/);
    expect(normalizeRetentionPolicy({ category: 'audit_log', retentionDays: 365 })).toEqual({ category: 'audit_log', retentionDays: 365, action: 'delete' });
  });
  it('rejects unknown categories and disallowed actions', () => {
    expect(() => normalizeRetentionPolicy({ category: 'foo', retentionDays: 10 })).toThrow(/Unknown/);
    expect(() => normalizeRetentionPolicy({ category: 'inactive_student_accounts', retentionDays: 400, action: 'delete' })).toThrow(/action/);
  });
  it('resolves tenant > platform > default and re-applies floors', () => {
    const rows = [
      { id: 'p', universityId: null, category: 'notifications', retentionDays: 90, action: 'delete' },
      { id: 't', universityId: 'u1', category: 'notifications', retentionDays: 30, action: 'delete' },
      { id: 'bad', universityId: 'u1', category: 'audit_log', retentionDays: 10, action: 'delete' },
      { id: 'tok', universityId: 'u1', category: 'password_reset_tokens', retentionDays: 99, action: 'delete' },
    ];
    const eff = Object.fromEntries(resolveEffectivePolicies(rows, 'u1').map((p) => [p.category, p]));
    expect(eff.notifications).toMatchObject({ retentionDays: 30, source: 'tenant' });
    expect(eff.audit_log.retentionDays).toBe(365);
    expect(eff.bug_reports).toMatchObject({ source: 'default', retentionDays: 730 });
    expect(eff.password_reset_tokens.source).toBe('default'); // platform-only: tenant row ignored
    const other = Object.fromEntries(resolveEffectivePolicies(rows, 'u2').map((p) => [p.category, p]));
    expect(other.notifications).toMatchObject({ retentionDays: 90, source: 'platform' });
  });
});

describe('anonymisation field mapping', () => {
  const id = '11111111-2222-3333-4444-555555555555';
  const f = buildAnonymisedFields(id, new Date('2026-01-01T00:00:00Z'));
  it('replaces identifiers with unique placeholders', () => {
    expect(f.userLogin.email).toBe(`erased-${id}@erased.invalid`);
    expect(f.userLogin.uid).toHaveLength(32);
    expect(f.userLogin.uid.startsWith('X')).toBe(true);
    expect(f.userLogin.status).toBe('erased');
    expect(f.userLogin.anonymizedAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(f.userLogin.tokenVersion).toEqual({ increment: 1 });
    expect(f.userLogin.passwordHash.startsWith('$2')).toBe(false); // never a valid bcrypt hash
  });
  it('clears contact, DOB, address and photo fields', () => {
    for (const k of ['phone', 'profileImageFilePath', 'profileImage']) expect(f.userLogin[k]).toBeNull();
    for (const k of ['email', 'phone', 'address', 'dateOfBirth', 'photoFilePath', 'photoPath', 'parentContact', 'emergencyContact']) {
      expect(f.studentDetails[k]).toBeNull();
    }
    for (const k of ['email', 'phoneNumber', 'photoFilePath']) expect(f.employeeDetails[k]).toBeNull();
    expect(f.studentDetails.displayName).toBe('Erased User');
    expect(f.employeeDetails.displayName).toBe('Erased User');
  });
  it('keeps retained identifiers (student id, emp id, academic data) untouched', () => {
    expect(f.studentDetails).not.toHaveProperty('studentId');
    expect(f.studentDetails).not.toHaveProperty('cgpa');
    expect(f.employeeDetails).not.toHaveProperty('empId');
  });
});

describe('correction mapping', () => {
  it('maps whitelisted fields to their tables and rejects others', () => {
    const out = mapCorrectionDetails({ phone: '9999', firstName: 'A', email: 'x@y.z', role: 'admin' });
    expect(out.user).toEqual({ phone: '9999' });
    expect(out.student).toEqual({ phone: '9999', firstName: 'A' });
    expect(out.employee).toEqual({ phoneNumber: '9999', firstName: 'A' });
    expect(out.rejected).toEqual(['email', 'role']);
  });
  it('parses dates and rejects invalid ones', () => {
    expect(mapCorrectionDetails({ dateOfBirth: '2001-02-03' }).student.dateOfBirth).toBeInstanceOf(Date);
    expect(mapCorrectionDetails({ dateOfBirth: 'nope' }).rejected).toEqual(['dateOfBirth']);
  });
});

describe('consent decisions', () => {
  const granted = (purpose, extra = {}) => ({ purpose, granted: true, withdrawnAt: null, ...extra });

  it('requires all required purposes', () => {
    expect(computeConsentState({ notice, records: [] }).needsConsent).toBe(true);
    expect(computeConsentState({ notice, records: [granted('core_services')] }).blocked).toBe(false);
    expect(computeConsentState({ notice, records: [granted('core_services', { withdrawnAt: new Date() })] }).blocked).toBe(true);
  });
  it('does not block when no notice is active', () => {
    expect(computeConsentState({ notice: null, records: [] }).blocked).toBe(false);
  });
  it('blocks a minor until the guardian verifies, when the university requires it', () => {
    const records = [granted('core_services')];
    expect(computeConsentState({ notice, records, isMinor: true, guardianRequiredByTenant: true })).toMatchObject({ guardianPending: true, blocked: true });
    expect(computeConsentState({ notice, records: [granted('core_services', { guardianVerifiedAt: new Date() })], isMinor: true }).blocked).toBe(false);
    expect(computeConsentState({ notice, records, isMinor: true, guardianRequiredByTenant: false }).blocked).toBe(false);
  });
  it('forces analytics off for minors and rejects missing required consent', () => {
    const r = normalizeDecisions(notice, [{ purpose: 'core_services', granted: true }, { purpose: 'analytics', granted: true }], { isMinor: true });
    expect(r.decisions.find((d) => d.purpose === 'analytics').granted).toBe(false);
    expect(r.forcedOff).toEqual(['analytics']);
    expect(r.errors).toEqual([]);
    const adult = normalizeDecisions(notice, [{ purpose: 'core_services', granted: true }, { purpose: 'analytics', granted: true }]);
    expect(adult.decisions.find((d) => d.purpose === 'analytics').granted).toBe(true);
    expect(normalizeDecisions(notice, [{ purpose: 'core_services', granted: false }]).errors.length).toBe(1);
    expect(normalizeDecisions(notice, [{ purpose: 'core_services', granted: true }, { purpose: 'zzz', granted: true }]).errors[0]).toMatch(/Unknown/);
  });
  it('middleware decision: exemptions, superadmin, blocked state', () => {
    const user = { id: 'u', role: 'faculty', universityId: 't' };
    const blocked = { blocked: true };
    expect(consentDecision({ user, path: '/research/list', state: blocked })).toBe('block');
    expect(consentDecision({ user, path: '/dpdp/consents/me', state: blocked })).toBe('allow');
    expect(consentDecision({ user, path: '/auth/me', state: blocked })).toBe('allow');
    expect(consentDecision({ user: { ...user, role: 'superadmin' }, path: '/research', state: blocked })).toBe('allow');
    expect(consentDecision({ user: null, path: '/research', state: blocked })).toBe('allow');
    expect(consentDecision({ user, path: '/research', state: { blocked: false } })).toBe('allow');
    expect(isConsentExemptPath('/authx')).toBe(false);
  });
});

describe('notice rendering', () => {
  it('fills DPO placeholders or a fallback', () => {
    expect(renderNoticeContent('{{DPO_EMAIL}}', { dpoEmail: 'dpo@u.in' })).toBe('dpo@u.in');
    expect(renderNoticeContent('{{DPO_NAME}}', null)).toMatch(/Not yet published/);
  });
  it('default notice covers the mandatory topics', () => {
    const c = DEFAULT_NOTICE.content;
    for (const phrase of ['What we collect', 'Why we use it', 'withdraw', 'Your rights', 'Data Protection Board of India', '{{DPO_EMAIL}}']) {
      expect(c).toContain(phrase);
    }
    expect(DEFAULT_NOTICE.purposes.filter((p) => p.required).map((p) => p.key)).toEqual(['core_services']);
  });
});
