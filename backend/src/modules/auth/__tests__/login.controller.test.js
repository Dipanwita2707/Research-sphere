/**
 * Login controller: lockout, generic errors, account/tenant gating, token/cookie.
 * Prisma and every side-effecting dependency are mocked.
 */
const mockPrisma = {
  userLogin: { findFirst: jest.fn(), update: jest.fn() },
  departmentPermission: { findMany: jest.fn() },
};
const mockGetTenantStatus = jest.fn();
const mockLicense = { isVerified: jest.fn(() => true) };

jest.mock('../../../shared/config/database', () => mockPrisma);
jest.mock('../../../shared/config/redis', () => ({
  invalidateUser: jest.fn(),
  getOrSet: jest.fn(),
  CACHE_KEYS: { USER: 'user:' },
  CACHE_TTL: {},
}));
jest.mock('../../../shared/middleware/auth', () => ({ getTenantStatus: (...a) => mockGetTenantStatus(...a) }));
jest.mock('../../../shared/utils/licenseState', () => mockLicense);
jest.mock('../../../shared/middleware/audit.middleware', () => ({ getClientIp: () => '127.0.0.1' }));
jest.mock('../../../shared/utils/validators', () => ({ sanitizeInput: (v) => v }));
jest.mock('../../../shared/utils/logger', () => ({
  error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(),
  createModuleLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));
jest.mock('../../audit/services/audit.service', () => ({
  auditService: { log: jest.fn(() => Promise.resolve()) },
  AuditActionType: { LOGIN: 'LOGIN', LOGOUT: 'LOGOUT', UPDATE: 'UPDATE' },
  AuditSeverity: { INFO: 'INFO', WARNING: 'WARNING' },
  AuditModule: { AUTH: 'auth', USER: 'user' },
}));
jest.mock('../services/auth.service', () => ({ logout: jest.fn() }));

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../../shared/config/app.config');
const { login } = require('../controllers/auth.controller');

const PASSWORD = 'CorrectPass123';
let passwordHash;

const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.cookie = jest.fn(() => res);
  res.clearCookie = jest.fn(() => res);
  return res;
};
const makeReq = (username, password) => ({
  body: { username, password },
  headers: { 'user-agent': 'jest' },
  originalUrl: '/api/v1/auth/login',
  cookies: {},
});

const baseUser = (overrides = {}) => ({
  id: '11111111-1111-1111-1111-111111111111',
  uid: 'fac001',
  email: 'fac001@uni.edu',
  passwordHash,
  role: 'faculty',
  status: 'active',
  universityId: '22222222-2222-2222-2222-222222222222',
  tokenVersion: 3,
  failedLoginAttempts: 0,
  lockedUntil: null,
  anonymizedAt: null,
  profileImage: null,
  lastLoginAt: null,
  employeeDetails: null,
  studentLogin: null,
  ...overrides,
});

beforeAll(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 4);
});

beforeEach(() => {
  jest.clearAllMocks();
  mockLicense.isVerified.mockReturnValue(true);
  mockGetTenantStatus.mockResolvedValue({ allowed: true });
  mockPrisma.userLogin.update.mockResolvedValue({ failedLoginAttempts: 1 });
  mockPrisma.departmentPermission.findMany.mockResolvedValue([]);
});

describe('login', () => {
  it('returns the same generic 401 for an unknown user', async () => {
    mockPrisma.userLogin.findFirst.mockResolvedValue(null);
    const res = makeRes();
    await login(makeReq('nobody', 'whatever123'), res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Invalid username or password' });
    expect(mockPrisma.userLogin.update).not.toHaveBeenCalled();
  });

  it('returns the same generic 401 for a wrong password and counts the failure', async () => {
    mockPrisma.userLogin.findFirst.mockResolvedValue(baseUser());
    const res = makeRes();
    await login(makeReq('fac001', 'wrong-password1'), res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Invalid username or password' });
    expect(mockPrisma.userLogin.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { failedLoginAttempts: { increment: 1 } },
    }));
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('locks the account with 423 when the failure limit is reached', async () => {
    mockPrisma.userLogin.findFirst.mockResolvedValue(baseUser());
    mockPrisma.userLogin.update.mockResolvedValueOnce({ failedLoginAttempts: config.security.maxLoginAttempts });
    const res = makeRes();
    await login(makeReq('fac001', 'wrong-password1'), res);

    expect(res.status).toHaveBeenCalledWith(423);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'ACCOUNT_LOCKED',
      minutesRemaining: config.security.lockoutDuration,
    }));
    expect(mockPrisma.userLogin.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ failedLoginAttempts: 0, lockedUntil: expect.any(Date) }),
    }));
  });

  it('refuses a locked account even with the correct password', async () => {
    mockPrisma.userLogin.findFirst.mockResolvedValue(baseUser({ lockedUntil: new Date(Date.now() + 5 * 60000) }));
    const res = makeRes();
    await login(makeReq('fac001', PASSWORD), res);

    expect(res.status).toHaveBeenCalledWith(423);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ACCOUNT_LOCKED', minutesRemaining: 5 }));
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('does not reveal a deactivated account to a wrong password', async () => {
    mockPrisma.userLogin.findFirst.mockResolvedValue(baseUser({ status: 'inactive' }));
    const res = makeRes();
    await login(makeReq('fac001', 'wrong-password1'), res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Invalid username or password' });
  });

  it('reveals deactivation only after a correct password', async () => {
    mockPrisma.userLogin.findFirst.mockResolvedValue(baseUser({ status: 'inactive' }));
    const res = makeRes();
    await login(makeReq('fac001', PASSWORD), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ACCOUNT_DEACTIVATED' }));
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('blocks a non-superadmin without a university (NO_TENANT)', async () => {
    mockPrisma.userLogin.findFirst.mockResolvedValue(baseUser({ universityId: null }));
    const res = makeRes();
    await login(makeReq('fac001', PASSWORD), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'NO_TENANT' }));
  });

  it('blocks users of a suspended tenant with the tenant status code', async () => {
    mockPrisma.userLogin.findFirst.mockResolvedValue(baseUser());
    mockGetTenantStatus.mockResolvedValue({ allowed: false, code: 'TENANT_SUSPENDED', message: 'Suspended.' });
    const res = makeRes();
    await login(makeReq('fac001', PASSWORD), res);

    expect(mockGetTenantStatus).toHaveBeenCalledWith('22222222-2222-2222-2222-222222222222');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, code: 'TENANT_SUSPENDED', message: 'Suspended.' });
  });

  it('returns 503 LICENSE_INVALID on an unlicensed instance', async () => {
    mockLicense.isVerified.mockReturnValue(false);
    const res = makeRes();
    await login(makeReq('fac001', PASSWORD), res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'LICENSE_INVALID' }));
    expect(mockPrisma.userLogin.findFirst).not.toHaveBeenCalled();
  });

  it('on success resets counters, sets an httpOnly cookie with tv, and omits the token from the body', async () => {
    mockPrisma.userLogin.findFirst.mockResolvedValue(baseUser({ failedLoginAttempts: 2 }));
    const res = makeRes();
    await login(makeReq('fac001', PASSWORD), res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.token).toBeUndefined();
    expect(body.user.uid).toBe('fac001');

    expect(mockPrisma.userLogin.update).toHaveBeenCalledWith({
      where: { id: '11111111-1111-1111-1111-111111111111' },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: expect.any(Date) },
    });

    expect(res.cookie).toHaveBeenCalledTimes(1);
    const [name, token, options] = res.cookie.mock.calls[0];
    expect(name).toBe('token');
    expect(options).toEqual(expect.objectContaining({ httpOnly: true, path: '/' }));
    expect(options.maxAge).toBe(config.jwt.cookieExpire * 24 * 60 * 60 * 1000);
    expect(['lax', 'strict', 'none']).toContain(options.sameSite);

    const decoded = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
    expect(decoded).toEqual(expect.objectContaining({
      id: '11111111-1111-1111-1111-111111111111',
      tv: 3,
      role: 'faculty',
    }));
  });

  it('lets a superadmin without a university in without a tenant check', async () => {
    mockPrisma.userLogin.findFirst.mockResolvedValue(baseUser({ role: 'superadmin', universityId: null, tokenVersion: 0 }));
    const res = makeRes();
    await login(makeReq('fac001', PASSWORD), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockGetTenantStatus).not.toHaveBeenCalled();
    const decoded = jwt.decode(res.cookie.mock.calls[0][1]);
    expect(decoded.tv).toBe(0);
  });

  it('rejects missing credentials with 400', async () => {
    const res = makeRes();
    await login(makeReq('', ''), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
