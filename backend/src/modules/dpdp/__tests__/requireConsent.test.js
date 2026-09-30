/**
 * requireConsent / consentGate decisions with Prisma, cache and licence mocked.
 */
const jwt = require('jsonwebtoken');

jest.mock('../../../shared/config/database', () => ({
  userLogin: { findUnique: jest.fn() },
  consentNotice: { findMany: jest.fn() },
  consentRecord: { findMany: jest.fn() },
}));
jest.mock('../../../shared/config/redis', () => ({
  CACHE_KEYS: { USER: 'user:' },
  get: jest.fn(async () => null),
  del: jest.fn(async () => true),
  delPattern: jest.fn(async () => true),
  getOrSet: jest.fn(async (_key, fn) => ({ data: await fn(), fromCache: false })),
}));
jest.mock('../../../shared/utils/licenseState', () => ({ isVerified: () => true }));
jest.mock('../../../shared/middleware/auth', () => ({
  getTenantStatus: jest.fn(async () => ({ allowed: true })),
  protect: (req, res, next) => next(),
}));

const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');
const config = require('../../../shared/config/app.config');
const tenantContext = require('../../../shared/tenancy/tenantContext');
const { requireConsent, consentGate } = require('../middleware/requireConsent');
const { DEFAULT_NOTICE } = require('../dpdp.constants');

const TENANT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NOTICE = { id: 'notice-1', universityId: null, isActive: true, purposes: DEFAULT_NOTICE.purposes };

const mockRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const principal = ({ role = 'faculty', dob = null, guardianFlag = true } = {}) => ({
  id: 'user-1',
  role,
  universityId: TENANT,
  university: { id: TENANT, name: 'U', requireGuardianConsentForMinors: guardianFlag },
  studentLogin: dob ? { dateOfBirth: dob, firstName: 'S' } : null,
});

const run = async (mw, req) => {
  const res = mockRes();
  const next = jest.fn();
  await mw(req, res, next);
  return { res, next };
};

const expectBlocked = ({ res, next }) => {
  expect(next).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(403);
  expect(res.json.mock.calls[0][0]).toMatchObject({ success: false, code: 'CONSENT_REQUIRED' });
};
const expectAllowed = ({ res, next }) => {
  expect(next).toHaveBeenCalledTimes(1);
  expect(res.status).not.toHaveBeenCalled();
};

const reqFor = (user, url = '/api/v1/research/contributions') => ({ user, originalUrl: url, headers: {}, cookies: {} });
const faculty = { id: 'user-1', role: 'faculty', universityId: TENANT, status: 'active', tokenVersion: 0 };

beforeEach(() => {
  jest.clearAllMocks();
  prisma.userLogin.findUnique.mockResolvedValue(principal());
  prisma.consentNotice.findMany.mockResolvedValue([NOTICE]);
  prisma.consentRecord.findMany.mockResolvedValue([]);
});

describe('requireConsent', () => {
  it('blocks a user who has not granted the required purpose', async () => {
    expectBlocked(await run(requireConsent, reqFor(faculty)));
  });

  it('allows once required purposes are granted', async () => {
    prisma.consentRecord.findMany.mockResolvedValue([{ purpose: 'core_services', granted: true, withdrawnAt: null }]);
    expectAllowed(await run(requireConsent, reqFor(faculty)));
  });

  it('blocks again after the required purpose is withdrawn', async () => {
    prisma.consentRecord.findMany.mockResolvedValue([{ purpose: 'core_services', granted: false, withdrawnAt: new Date() }]);
    expectBlocked(await run(requireConsent, reqFor(faculty)));
  });

  it('allows when no notice is active', async () => {
    prisma.consentNotice.findMany.mockResolvedValue([]);
    expectAllowed(await run(requireConsent, reqFor(faculty)));
  });

  it('never blocks superadmin or exempt paths, and does not hit the DB for them', async () => {
    expectAllowed(await run(requireConsent, reqFor({ ...faculty, role: 'superadmin', universityId: null })));
    expectAllowed(await run(requireConsent, reqFor(faculty, '/api/v1/dpdp/consents/me')));
    expectAllowed(await run(requireConsent, reqFor(faculty, '/api/v1/auth/me')));
    expectAllowed(await run(requireConsent, reqFor(faculty, '/api/v1/license/verify')));
    expect(prisma.consentRecord.findMany).not.toHaveBeenCalled();
  });

  it('blocks a minor until the guardian has verified', async () => {
    prisma.userLogin.findUnique.mockResolvedValue(principal({ role: 'student', dob: '2012-05-01' }));
    prisma.consentRecord.findMany.mockResolvedValue([{ purpose: 'core_services', granted: true, withdrawnAt: null, guardianVerifiedAt: null }]);
    const r = await run(requireConsent, reqFor({ ...faculty, role: 'student' }));
    expectBlocked(r);
    expect(r.res.json.mock.calls[0][0].data.guardianPending).toBe(true);

    prisma.consentRecord.findMany.mockResolvedValue([{ purpose: 'core_services', granted: true, withdrawnAt: null, guardianVerifiedAt: new Date() }]);
    expectAllowed(await run(requireConsent, reqFor({ ...faculty, role: 'student' })));
  });

  it('does not require a guardian when the university turned it off', async () => {
    prisma.userLogin.findUnique.mockResolvedValue(principal({ role: 'student', dob: '2012-05-01', guardianFlag: false }));
    prisma.consentRecord.findMany.mockResolvedValue([{ purpose: 'core_services', granted: true, withdrawnAt: null }]);
    expectAllowed(await run(requireConsent, reqFor({ ...faculty, role: 'student' })));
  });

  it('prefers the tenant notice over the platform default', async () => {
    const tenantNotice = { id: 'tenant-notice', universityId: TENANT, isActive: true, purposes: [{ key: 'x_required', required: true }] };
    prisma.consentNotice.findMany.mockResolvedValue([NOTICE, tenantNotice]);
    prisma.consentRecord.findMany.mockResolvedValue([{ purpose: 'core_services', granted: true, withdrawnAt: null }]);
    expectBlocked(await run(requireConsent, reqFor(faculty)));
    expect(prisma.consentRecord.findMany.mock.calls[0][0].where.noticeId).toBe('tenant-notice');
  });

  it('evaluates inside the user tenant context (tenant-scoped cache key)', async () => {
    let seenTenant;
    cache.getOrSet.mockImplementationOnce(async (_key, fn) => {
      seenTenant = tenantContext.getTenantId();
      return { data: await fn() };
    });
    await run(requireConsent, reqFor(faculty));
    expect(seenTenant).toBe(TENANT);
  });

  it('fails open on internal errors', async () => {
    prisma.consentNotice.findMany.mockRejectedValue(new Error('db down'));
    expectAllowed(await run(requireConsent, reqFor(faculty)));
  });
});

describe('consentGate (router level, before protect)', () => {
  const token = (payload = { id: 'user-1', tv: 0 }) => jwt.sign(payload, config.jwt.secret, { algorithm: 'HS256', expiresIn: '1h' });
  const gateReq = (tok, url = '/api/v1/research/contributions') => ({
    originalUrl: url,
    headers: tok ? { authorization: `Bearer ${tok}` } : {},
    cookies: {},
  });

  beforeEach(() => {
    // first findUnique = gate session lookup, second = consent principal
    prisma.userLogin.findUnique
      .mockResolvedValueOnce({ id: 'user-1', role: 'faculty', status: 'active', universityId: TENANT, tokenVersion: 0, anonymizedAt: null })
      .mockResolvedValue(principal());
  });

  it('passes through requests without a token (protect decides)', async () => {
    expectAllowed(await run(consentGate, gateReq(null)));
  });

  it('passes through invalid tokens', async () => {
    expectAllowed(await run(consentGate, gateReq('garbage.token.value')));
  });

  it('passes through revoked sessions (token version mismatch)', async () => {
    expectAllowed(await run(consentGate, gateReq(token({ id: 'user-1', tv: 5 }))));
  });

  it('blocks a valid session without consent', async () => {
    expectBlocked(await run(consentGate, gateReq(token())));
  });

  it('uses the cookie token too', async () => {
    const req = gateReq(null);
    req.cookies.token = token();
    expectBlocked(await run(consentGate, req));
  });

  it('does not gate exempt paths', async () => {
    expectAllowed(await run(consentGate, gateReq(token(), '/api/v1/dpdp/consents')));
    expectAllowed(await run(consentGate, gateReq(token(), '/api/v1/contact')));
  });

  it('runs the rest of the chain outside any tenant context', async () => {
    prisma.consentRecord.findMany.mockResolvedValue([{ purpose: 'core_services', granted: true, withdrawnAt: null }]);
    const res = mockRes();
    let ctxInNext = 'unset';
    await consentGate(gateReq(token()), res, () => { ctxInNext = tenantContext.get(); });
    expect(ctxInNext).toBeUndefined();
  });
});
