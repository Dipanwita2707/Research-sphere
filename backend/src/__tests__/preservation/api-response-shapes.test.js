/**
 * Preservation Tests: API Response Shapes
 *
 * Property 2: Preservation - API Behavior Unchanged
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.8
 *
 * These tests MUST PASS on the UNFIXED code.
 * They capture the exact response shapes returned by the research, IPR,
 * and grants controllers so that after refactoring the shapes remain identical.
 *
 * Strategy:
 * - Mock prisma so controllers can run without a real database
 * - Call controller functions with mock req/res objects
 * - Assert on the exact shape of the JSON response
 */

// ── Mock prisma BEFORE requiring any controller ───────────────────────────────
jest.mock('../../shared/config/database', () => ({
  iprApplication: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
    create: jest.fn(),
  },
  grantApplication: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  researchContribution: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
  centralDepartment: { findFirst: jest.fn() },
  centralDepartmentPermission: { findFirst: jest.fn() },
  userLogin: { findUnique: jest.fn() },
  bookIncentivePolicy: { findFirst: jest.fn() },
  bookChapterIncentivePolicy: { findFirst: jest.fn() },
  conferenceIncentivePolicy: { findFirst: jest.fn() },
  researchIncentivePolicy: { findFirst: jest.fn() },
  incentivePolicy: { findFirst: jest.fn() },
}));

jest.mock('../../shared/utils/auditLogger', () => ({
  logResearchFiling: jest.fn(),
  logResearchUpdate: jest.fn(),
  logResearchStatusChange: jest.fn(),
  logIprFiling: jest.fn(),
  logIprUpdate: jest.fn(),
  logIprStatusChange: jest.fn(),
  logFileUpload: jest.fn(),
  getIp: jest.fn(),
}));
jest.mock('../../shared/utils/s3', () => ({ uploadToS3: jest.fn() }));

const prisma = require('../../shared/config/database');
const iprController = require('../../modules/ipr/controllers/ipr.controller');
const grantController = require('../../modules/grants/controllers/grant.controller');

// ── Mock req/res factory ──────────────────────────────────────────────────────

function makeRes() {
  const res = {
    _status: 200,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
  };
  return res;
}

function makeReq(overrides = {}) {
  return {
    user: { id: 'user-1', uid: 'EMP001' },
    params: {},
    query: {},
    body: {},
    file: null,
    ...overrides,
  };
}

// ── Sample data fixtures ──────────────────────────────────────────────────────

const SAMPLE_IPR_APPLICATION = {
  id: 'ipr-1',
  applicationNumber: 'IPR-2024-00001',
  iprType: 'patent',
  status: 'submitted',
  title: 'Test Patent',
  applicantUserId: 'user-1',
  schoolId: 'school-1',
  departmentId: 'dept-1',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  applicantUser: {
    uid: 'EMP001',
    email: 'test@example.com',
    employeeDetails: {
      firstName: 'John',
      lastName: 'Doe',
      displayName: 'John Doe',
    },
  },
  applicantDetails: null,
  sdgs: [],
  school: { facultyName: 'Engineering', facultyCode: 'ENG' },
  department: { departmentName: 'CS', departmentCode: 'CS' },
  reviews: [],
};

const SAMPLE_GRANT_APPLICATION = {
  id: 'grant-1',
  applicationNumber: 'GRT-2024-00001',
  title: 'Test Grant',
  status: 'draft',
  applicantUserId: 'user-1',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  school: null,
  department: null,
  consortiumOrganizations: [],
  investigators: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// IPR Controller Response Shapes
// ─────────────────────────────────────────────────────────────────────────────

describe('Preservation: IPR API response shapes', () => {

  beforeEach(() => jest.clearAllMocks());

  describe('getAllIprApplications', () => {
    test('success response has { success, data, pagination } shape', async () => {
      prisma.iprApplication.findMany.mockResolvedValue([SAMPLE_IPR_APPLICATION]);
      prisma.iprApplication.count.mockResolvedValue(1);

      const req = makeReq({ query: { page: '1', limit: '10' } });
      const res = makeRes();

      await iprController.getAllIprApplications(req, res);

      expect(res._status).toBe(200);
      expect(res._body).toMatchObject({
        success: true,
        data: expect.any(Array),
        pagination: {
          total: expect.any(Number),
          page: expect.any(Number),
          limit: expect.any(Number),
          totalPages: expect.any(Number),
        },
      });
    });

    test('pagination fields are numeric', async () => {
      prisma.iprApplication.findMany.mockResolvedValue([]);
      prisma.iprApplication.count.mockResolvedValue(0);

      const req = makeReq({ query: { page: '2', limit: '5' } });
      const res = makeRes();

      await iprController.getAllIprApplications(req, res);

      const { pagination } = res._body;
      expect(pagination.page).toBe(2);
      expect(pagination.limit).toBe(5);
      expect(pagination.total).toBe(0);
      expect(pagination.totalPages).toBe(0);
    });

    test('error response has { success: false, message, error } shape', async () => {
      prisma.iprApplication.findMany.mockRejectedValue(new Error('DB failure'));

      const req = makeReq({ query: {} });
      const res = makeRes();

      await iprController.getAllIprApplications(req, res);

      expect(res._status).toBe(500);
      expect(res._body).toMatchObject({
        success: false,
        message: expect.any(String),
        error: expect.any(String),
      });
    });
  });

  describe('getIprApplicationById', () => {
    test('found: response has { success: true, data } shape', async () => {
      const fullApplication = {
        ...SAMPLE_IPR_APPLICATION,
        role: 'faculty',
        reviews: [],
        statusHistory: [],
        contributors: [],
        financeRecords: [],
      };
      prisma.iprApplication.findUnique.mockResolvedValue(fullApplication);

      const req = makeReq({ params: { id: 'ipr-1' } });
      const res = makeRes();

      await iprController.getIprApplicationById(req, res);

      expect(res._status).toBe(200);
      expect(res._body).toMatchObject({
        success: true,
        data: expect.objectContaining({ id: 'ipr-1' }),
      });
    });

    test('not found: 404 with { success: false, message }', async () => {
      prisma.iprApplication.findUnique.mockResolvedValue(null);

      const req = makeReq({ params: { id: 'nonexistent' } });
      const res = makeRes();

      await iprController.getIprApplicationById(req, res);

      expect(res._status).toBe(404);
      expect(res._body).toMatchObject({
        success: false,
        message: expect.any(String),
      });
    });

    test('error: 500 with { success: false, message, error }', async () => {
      prisma.iprApplication.findUnique.mockRejectedValue(new Error('DB error'));

      const req = makeReq({ params: { id: 'ipr-1' } });
      const res = makeRes();

      await iprController.getIprApplicationById(req, res);

      expect(res._status).toBe(500);
      expect(res._body).toMatchObject({
        success: false,
        message: expect.any(String),
        error: expect.any(String),
      });
    });
  });

  describe('getMyIprApplications', () => {
    test('success response has { success: true, data, grouped, stats } shape', async () => {
      prisma.iprApplication.findMany.mockResolvedValue([SAMPLE_IPR_APPLICATION]);

      const req = makeReq({ query: {} });
      const res = makeRes();

      await iprController.getMyIprApplications(req, res);

      expect(res._body.success).toBe(true);
      expect(Array.isArray(res._body.data)).toBe(true);
      // getMyIprApplications returns grouped and stats, NOT pagination
      expect(res._body.grouped).toBeDefined();
      expect(res._body.stats).toBeDefined();
      expect(res._body.stats).toHaveProperty('total');
    });
  });

  describe('getIprStatistics', () => {
    test('success response has { success: true, data } shape with stat fields', async () => {
      // getIprStatistics calls count 6 times + groupBy 2 times via Promise.all
      prisma.iprApplication.count.mockResolvedValue(5);
      prisma.iprApplication.groupBy.mockResolvedValue([]);

      const req = makeReq({ query: {} });
      const res = makeRes();

      await iprController.getIprStatistics(req, res);

      expect(res._body.success).toBe(true);
      expect(res._body.data).toBeDefined();
      expect(res._body.data).toHaveProperty('total');
      expect(res._body.data).toHaveProperty('pending');
      expect(res._body.data).toHaveProperty('approved');
      expect(res._body.data).toHaveProperty('rejected');
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Grants Controller Response Shapes
// ─────────────────────────────────────────────────────────────────────────────

describe('Preservation: Grants API response shapes', () => {

  beforeEach(() => jest.clearAllMocks());

  describe('getMyGrantApplications', () => {
    test('success response has { success: true, data } shape', async () => {
      prisma.grantApplication.findMany.mockResolvedValue([SAMPLE_GRANT_APPLICATION]);

      const req = makeReq();
      const res = makeRes();

      await grantController.getMyGrantApplications(req, res);

      expect(res._status).toBe(200);
      expect(res._body).toMatchObject({
        success: true,
        data: expect.any(Array),
      });
    });

    test('unauthenticated request returns 401 with { success: false, message }', async () => {
      const req = makeReq({ user: null });
      const res = makeRes();

      await grantController.getMyGrantApplications(req, res);

      expect(res._status).toBe(401);
      expect(res._body).toMatchObject({
        success: false,
        message: expect.any(String),
      });
    });

    test('error response has { success: false, message, error } shape', async () => {
      prisma.grantApplication.findMany.mockRejectedValue(new Error('DB error'));

      const req = makeReq();
      const res = makeRes();

      await grantController.getMyGrantApplications(req, res);

      expect(res._status).toBe(500);
      expect(res._body).toMatchObject({
        success: false,
        message: expect.any(String),
        error: expect.any(String),
      });
    });
  });

  describe('getGrantApplicationById', () => {
    test('found: response has { success: true, data } shape', async () => {
      prisma.grantApplication.findUnique.mockResolvedValue(SAMPLE_GRANT_APPLICATION);

      const req = makeReq({ params: { id: 'grant-1' } });
      const res = makeRes();

      await grantController.getGrantApplicationById(req, res);

      expect(res._body.success).toBe(true);
      expect(res._body.data).toBeDefined();
    });

    test('not found: 404 with { success: false, message }', async () => {
      prisma.grantApplication.findUnique.mockResolvedValue(null);

      const req = makeReq({ params: { id: 'nonexistent' } });
      const res = makeRes();

      await grantController.getGrantApplicationById(req, res);

      expect(res._status).toBe(404);
      expect(res._body).toMatchObject({
        success: false,
        message: expect.any(String),
      });
    });
  });

  describe('getPendingGrantReviews', () => {
    test('success response has { success: true, data } shape (no pagination)', async () => {
      // getPendingGrantReviews checks permissions first, then returns flat data array
      // Mock user with grant_review permission
      const reqWithPerms = makeReq({
        query: {},
        user: {
          id: 'user-1',
          uid: 'EMP001',
          centralDeptPermissions: [
            { permissions: { grant_review: true } }
          ],
        },
      });

      // Mock the DRD department lookup and permission lookup
      prisma.centralDepartment.findFirst.mockResolvedValue({ id: 'drd-1' });
      prisma.centralDepartmentPermission.findFirst.mockResolvedValue({
        assignedGrantSchoolIds: [],
      });
      prisma.grantApplication.findMany.mockResolvedValue([]);

      const res = makeRes();

      await grantController.getPendingGrantReviews(reqWithPerms, res);

      expect(res._body.success).toBe(true);
      expect(Array.isArray(res._body.data)).toBe(true);
      // No pagination field - returns flat array
      expect(res._body.pagination).toBeUndefined();
    });

    test('no permissions returns 403 with { success: false, message }', async () => {
      const reqNoPerms = makeReq({
        query: {},
        user: {
          id: 'user-1',
          uid: 'EMP001',
          centralDeptPermissions: [],
        },
      });

      const res = makeRes();

      await grantController.getPendingGrantReviews(reqNoPerms, res);

      expect(res._status).toBe(403);
      expect(res._body).toMatchObject({
        success: false,
        message: expect.any(String),
      });
    });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Common response shape invariants
// ─────────────────────────────────────────────────────────────────────────────

describe('Preservation: Response shape invariants', () => {

  beforeEach(() => jest.clearAllMocks());

  test('all success responses include success: true', async () => {
    prisma.iprApplication.findMany.mockResolvedValue([]);
    prisma.iprApplication.count.mockResolvedValue(0);

    const req = makeReq({ query: {} });
    const res = makeRes();

    await iprController.getAllIprApplications(req, res);

    expect(res._body.success).toBe(true);
  });

  test('all error responses include success: false', async () => {
    prisma.iprApplication.findMany.mockRejectedValue(new Error('fail'));

    const req = makeReq({ query: {} });
    const res = makeRes();

    await iprController.getAllIprApplications(req, res);

    expect(res._body.success).toBe(false);
  });

  test('404 responses use status code 404', async () => {
    prisma.iprApplication.findUnique.mockResolvedValue(null);

    const req = makeReq({ params: { id: 'missing' } });
    const res = makeRes();

    await iprController.getIprApplicationById(req, res);

    expect(res._status).toBe(404);
  });

  test('500 responses use status code 500', async () => {
    prisma.iprApplication.findMany.mockRejectedValue(new Error('crash'));

    const req = makeReq({ query: {} });
    const res = makeRes();

    await iprController.getAllIprApplications(req, res);

    expect(res._status).toBe(500);
  });

});
