/**
 * requirePermission(departmentType, ...permissionNames) passes when the user holds ANY of the
 * listed names (with drd_ prefix variants). Grant review routes rely on the extra names.
 */
jest.mock('../../../shared/config/database', () => ({}));
jest.mock('../../../shared/config/redis', () => ({ getOrSet: jest.fn(), del: jest.fn(), CACHE_KEYS: { USER: 'user:' } }));
jest.mock('../../../shared/utils/licenseState', () => ({ isVerified: () => true }));
jest.mock('../../../modules/bug-reports/utils/securityLogger', () => ({ logAuthenticationFailure: jest.fn() }));
jest.mock('../../../shared/utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }));

const { requirePermission } = require('../../../shared/middleware/auth');

const run = (mw, user) => {
  const res = { statusCode: 200, status: jest.fn(function (c) { this.statusCode = c; return this; }), json: jest.fn() };
  const next = jest.fn();
  mw({ user }, res, next);
  return { passed: next.mock.calls.length === 1, status: res.statusCode };
};

const central = (perms) => ({ id: 'u1', role: 'staff', centralDeptPermissions: [{ permissions: perms }], schoolDeptPermissions: [] });

describe('requirePermission', () => {
  // Exactly the guards used by grant.routes.js
  const start = requirePermission('central-department', 'grant_review', 'research_review');
  const recommend = requirePermission('central-department', 'grant_review', 'research_review');
  const approve = requirePermission('central-department', 'grant_approve', 'research_approve');

  test('user with only research_approve can approve grants', () => {
    expect(run(approve, central({ research_approve: true })).passed).toBe(true);
  });

  test('user with only research_review can start/recommend grant reviews', () => {
    const u = central({ research_review: true });
    expect(run(start, u).passed).toBe(true);
    expect(run(recommend, u).passed).toBe(true);
  });

  test('drd_ prefixed keys are still honoured for secondary names', () => {
    expect(run(approve, central({ drd_research_approve: true })).passed).toBe(true);
  });

  test('user with neither permission gets 403', () => {
    const u = central({ research_view: true, grant_file: true });
    for (const mw of [start, recommend, approve]) {
      const r = run(mw, u);
      expect(r.passed).toBe(false);
      expect(r.status).toBe(403);
    }
  });

  test('false-valued permission does not grant', () => {
    expect(run(approve, central({ research_approve: false, grant_approve: false })).status).toBe(403);
  });

  test('single-name behaviour unchanged (incl. drd_ variants)', () => {
    const mw = requirePermission('central-department', 'ipr_review');
    expect(run(mw, central({ ipr_review: true })).passed).toBe(true);
    expect(run(mw, central({ drd_ipr_review: true })).passed).toBe(true);
    expect(run(mw, central({ research_review: true })).status).toBe(403);
    const drd = requirePermission('central-department', 'drd_ipr_review');
    expect(run(drd, central({ ipr_review: true })).passed).toBe(true);
  });

  test('school-department checks schoolDeptPermissions', () => {
    const mw = requirePermission('school-department', 'a_perm', 'b_perm');
    expect(run(mw, { schoolDeptPermissions: [{ permissions: { b_perm: true } }] }).passed).toBe(true);
    expect(run(mw, { schoolDeptPermissions: [{ permissions: { c_perm: true } }] }).status).toBe(403);
  });

  test('missing user is 403', () => {
    expect(run(approve, undefined).status).toBe(403);
  });
});
