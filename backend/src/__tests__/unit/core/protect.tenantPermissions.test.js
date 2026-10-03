/**
 * protect loads permissions unscoped (runAsSystem); rows and roles that belong to another
 * university must never be honoured for a tenant user.
 */
const T = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
const USER = '00000000-0000-4000-8000-000000000002';

const mockPrisma = {
  userLogin: { findUnique: jest.fn() },
  role: { findMany: jest.fn(async () => []) },
  university: {
    findUnique: jest.fn(async () => ({
      isActive: true,
      subscription: { status: 'active', currentPeriodEnd: new Date(Date.now() + 86400000) },
    })),
  },
};

jest.mock('../../../shared/config/database', () => mockPrisma);
jest.mock('../../../shared/config/redis', () => ({
  getOrSet: jest.fn(async (_key, fn) => ({ data: await fn() })),
  del: jest.fn(),
  CACHE_KEYS: { USER: 'user:' },
}));
jest.mock('../../../shared/utils/licenseState', () => ({ isVerified: () => true }));
jest.mock('../../../modules/bug-reports/utils/securityLogger', () => ({ logAuthenticationFailure: jest.fn() }));
jest.mock('../../../shared/utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }));

const jwt = require('jsonwebtoken');
const config = require('../../../shared/config/app.config');
const { protect } = require('../../../shared/middleware/auth');

const baseUser = (overrides = {}) => ({
  id: USER, uid: 'U1', email: 'u@x', role: 'faculty', status: 'active', universityId: T,
  tokenVersion: 0, anonymizedAt: null, assignedRoleIds: [], employeeDetails: null, studentLogin: null,
  centralDeptPermissions: [
    { universityId: T, centralDeptId: 'own', permissions: { ipr_review: true }, isPrimary: true, centralDept: {} },
    { universityId: OTHER, centralDeptId: 'foreign', permissions: { ipr_approve: true }, isPrimary: false, centralDept: {} },
  ],
  schoolDeptPermissions: [
    { universityId: T, departmentId: 'own-d', permissions: { a: true }, isPrimary: false },
    { universityId: OTHER, departmentId: 'foreign-d', permissions: { b: true }, isPrimary: false },
  ],
  ...overrides,
});

const runProtect = async () => {
  const token = jwt.sign({ id: USER, tv: 0 }, config.jwt.secret, { algorithm: 'HS256' });
  const req = { headers: { authorization: `Bearer ${token}` }, cookies: {} };
  const res = { status: jest.fn(() => res), json: jest.fn(() => res) };
  const next = jest.fn();
  await protect(req, res, next);
  return { req, res, next };
};

beforeEach(() => jest.clearAllMocks());

it('drops permission rows that belong to another university', async () => {
  mockPrisma.userLogin.findUnique.mockResolvedValue(baseUser());
  const { req, next } = await runProtect();
  expect(next).toHaveBeenCalled();
  expect(req.user.centralDeptPermissions.map((p) => p.centralDeptId)).toEqual(['own']);
  expect(req.user.schoolDeptPermissions.map((p) => p.departmentId)).toEqual(['own-d']);
});

it('only loads roles of the user\'s university or global roles', async () => {
  mockPrisma.userLogin.findUnique.mockResolvedValue(baseUser({ assignedRoleIds: ['r1'] }));
  await runProtect();
  expect(mockPrisma.role.findMany.mock.calls[0][0].where).toEqual({
    id: { in: ['r1'] },
    isActive: true,
    OR: [{ universityId: T }, { universityId: null }],
  });
});

it('keeps superadmin behaviour unchanged', async () => {
  mockPrisma.userLogin.findUnique.mockResolvedValue(baseUser({ role: 'superadmin', universityId: null, assignedRoleIds: ['r1'] }));
  const { req } = await runProtect();
  expect(req.user.centralDeptPermissions).toHaveLength(2);
  expect(mockPrisma.role.findMany.mock.calls[0][0].where).toEqual({ id: { in: ['r1'] }, isActive: true });
});
