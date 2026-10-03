/**
 * Permission/role grants must never target a user, department or school of another
 * university, and *_assign_school holders may not assign review rights to themselves.
 * Prisma and side-effecting dependencies are mocked; handlers run inside a tenant context.
 */
const T = '11111111-1111-1111-1111-111111111111';
const ADMIN = '00000000-0000-4000-8000-000000000001';
const LOCAL_USER = '00000000-0000-4000-8000-000000000002';
const FOREIGN_USER = '00000000-0000-4000-8000-000000000099';
const LOCAL_DEPT = '00000000-0000-4000-8000-0000000000d1';
const FOREIGN_DEPT = '00000000-0000-4000-8000-0000000000d9';
const LOCAL_CDEPT = '00000000-0000-4000-8000-0000000000c1';
const LOCAL_SCHOOL = '00000000-0000-4000-8000-0000000000e1';
const FOREIGN_SCHOOL = '00000000-0000-4000-8000-0000000000e9';
const ROLE = '00000000-0000-4000-8000-0000000000f1';

// Rows that exist in tenant T (anything else behaves as another tenant's row)
const tenantRows = {
  userLogin: [ADMIN, LOCAL_USER],
  department: [LOCAL_DEPT],
  centralDepartment: [LOCAL_CDEPT],
  facultySchoolList: [LOCAL_SCHOOL],
  role: [ROLE],
};
const scopedFindMany = (model) => jest.fn(async ({ where }) =>
  where.id.in.filter((id) => tenantRows[model].includes(id) && (where.universityId === T || where.OR)).map((id) => ({ id })));

const mockPrisma = {
  userLogin: { findMany: scopedFindMany('userLogin'), findUnique: jest.fn(async () => ({ uid: 'U' })), update: jest.fn() },
  department: { findMany: scopedFindMany('department') },
  centralDepartment: { findMany: scopedFindMany('centralDepartment'), findFirst: jest.fn(async () => ({ id: LOCAL_CDEPT })) },
  facultySchoolList: { findMany: scopedFindMany('facultySchoolList') },
  role: {
    findMany: scopedFindMany('role'),
    findUnique: jest.fn(async () => ({ id: ROLE, name: 'R', isActive: true, permissions: { schoolDeptPermissions: { a: true } } })),
  },
  departmentPermission: { upsert: jest.fn(async () => ({ id: 'p1', department: {} })), updateMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(async () => ({ id: 'p2' })), update: jest.fn() },
  centralDepartmentPermission: { upsert: jest.fn(async () => ({ id: 'p3', centralDept: {} })), updateMany: jest.fn(), findFirst: jest.fn(async () => null), findUnique: jest.fn(), create: jest.fn(async () => ({ id: 'p4' })), update: jest.fn() },
  employeeDetails: { updateMany: jest.fn() },
  auditLog: { create: jest.fn() },
};

jest.mock('../../../shared/config/database', () => mockPrisma);
jest.mock('../../../shared/config/redis', () => ({ invalidateUser: jest.fn() }));
jest.mock('../../../shared/utils/auditLogger', () => ({ logPermissionChange: jest.fn(), logDataExport: jest.fn(), getIp: () => '127.0.0.1' }));
jest.mock('../../../shared/utils/centralDeptAnalyticsScopeSupport', () => ({
  getSupportedCentralDeptAnalyticsScopeFields: jest.fn(async () => []),
  withSupportedAnalyticsScopeFields: jest.fn(),
  pickSupportedAnalyticsScopeFields: jest.fn(),
}));
jest.mock('../../../modules/audit/services/audit.service', () => ({ auditService: { log: jest.fn() } }));

const tenantContext = require('../../../shared/tenancy/tenantContext');
const permissionMgmt = require('../../../modules/core/controllers/permissionManagement.controller');
const roleMgmt = require('../../../modules/core/controllers/roleManagement.controller');
const permissionCtrl = require('../../../modules/core/controllers/permission.controller');

const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};
const call = async (handler, { body = {}, user = { id: ADMIN, role: 'admin' } } = {}) => {
  const res = makeRes();
  await tenantContext.runForTenant(T, () => handler({ body, params: {}, user, tenantId: T, get: () => 'ua' }, res));
  return res;
};
const statusOf = (res) => (res.status.mock.calls.length ? res.status.mock.calls[0][0] : 200);

beforeEach(() => jest.clearAllMocks());

describe('grantSchoolDeptPermissions', () => {
  it('404s for a user of another university and writes nothing', async () => {
    const res = await call(permissionMgmt.grantSchoolDeptPermissions, {
      body: { userId: FOREIGN_USER, departmentId: LOCAL_DEPT, permissions: { x: true } },
    });
    expect(statusOf(res)).toBe(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'User not found' });
    expect(mockPrisma.departmentPermission.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.employeeDetails.updateMany).not.toHaveBeenCalled();
  });

  it('404s for a department of another university', async () => {
    const res = await call(permissionMgmt.grantSchoolDeptPermissions, {
      body: { userId: LOCAL_USER, departmentId: FOREIGN_DEPT, permissions: { x: true } },
    });
    expect(statusOf(res)).toBe(404);
    expect(mockPrisma.departmentPermission.upsert).not.toHaveBeenCalled();
  });

  it('grants within the tenant', async () => {
    const res = await call(permissionMgmt.grantSchoolDeptPermissions, {
      body: { userId: LOCAL_USER, departmentId: LOCAL_DEPT, permissions: { x: true } },
    });
    expect(statusOf(res)).toBe(200);
    expect(mockPrisma.departmentPermission.upsert).toHaveBeenCalled();
  });
});

describe('grantCentralDeptPermissions', () => {
  it('404s for a foreign user', async () => {
    const res = await call(permissionMgmt.grantCentralDeptPermissions, {
      body: { userId: FOREIGN_USER, centralDeptId: LOCAL_CDEPT, permissions: {} },
    });
    expect(statusOf(res)).toBe(404);
    expect(mockPrisma.centralDepartmentPermission.upsert).not.toHaveBeenCalled();
  });

  it('404s when an analytics scope references a foreign school', async () => {
    const res = await call(permissionMgmt.grantCentralDeptPermissions, {
      body: { userId: LOCAL_USER, centralDeptId: LOCAL_CDEPT, permissions: {}, assignedResearchAnalyticsSchoolIds: [LOCAL_SCHOOL, FOREIGN_SCHOOL] },
    });
    expect(statusOf(res)).toBe(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'One or more schools not found' });
    expect(mockPrisma.centralDepartmentPermission.upsert).not.toHaveBeenCalled();
  });
});

describe('assign*MemberSchools', () => {
  const drdHead = {
    id: LOCAL_USER, role: 'faculty',
    centralDeptPermissions: [{ permissions: { ipr_assign_school: true, research_assign_school: true } }],
  };

  it('stops an *_assign_school holder from assigning themselves', async () => {
    for (const handler of [permissionMgmt.assignDrdMemberSchools, permissionMgmt.assignResearchMemberSchools]) {
      const res = await call(handler, { body: { userId: LOCAL_USER, schoolIds: [LOCAL_SCHOOL] }, user: drdHead });
      expect(statusOf(res)).toBe(403);
    }
    expect(mockPrisma.centralDepartmentPermission.create).not.toHaveBeenCalled();
    expect(mockPrisma.centralDepartmentPermission.update).not.toHaveBeenCalled();
  });

  it('lets an admin assign themselves', async () => {
    const res = await call(permissionMgmt.assignDrdMemberSchools, { body: { userId: ADMIN, schoolIds: [LOCAL_SCHOOL] } });
    expect(statusOf(res)).toBe(200);
    expect(mockPrisma.centralDepartmentPermission.create).toHaveBeenCalled();
  });

  it('404s for a foreign target user or school', async () => {
    let res = await call(permissionMgmt.assignDrdMemberSchools, { body: { userId: FOREIGN_USER, schoolIds: [LOCAL_SCHOOL] } });
    expect(statusOf(res)).toBe(404);
    res = await call(permissionMgmt.assignGrantMemberSchools, { body: { userId: LOCAL_USER, schoolIds: [FOREIGN_SCHOOL] } });
    expect(statusOf(res)).toBe(404);
    expect(mockPrisma.centralDepartmentPermission.create).not.toHaveBeenCalled();
  });
});

describe('role and legacy permission assignment', () => {
  it('assignRolesToUser 404s for a foreign user', async () => {
    const res = await call(permissionMgmt.assignRolesToUser, { body: { userId: FOREIGN_USER, roleIds: [ROLE] } });
    expect(statusOf(res)).toBe(404);
    expect(mockPrisma.userLogin.update).not.toHaveBeenCalled();
  });

  it('applyRoleToUser 404s for a foreign user or department', async () => {
    let res = await call(roleMgmt.applyRoleToUser, { body: { userId: FOREIGN_USER, roleId: ROLE, departmentId: LOCAL_DEPT } });
    expect(statusOf(res)).toBe(404);
    res = await call(roleMgmt.applyRoleToUser, { body: { userId: LOCAL_USER, roleId: ROLE, departmentId: FOREIGN_DEPT } });
    expect(statusOf(res)).toBe(404);
    expect(mockPrisma.departmentPermission.create).not.toHaveBeenCalled();
  });

  it('applyRoleToUser applies within the tenant', async () => {
    const res = await call(roleMgmt.applyRoleToUser, { body: { userId: LOCAL_USER, roleId: ROLE, departmentId: LOCAL_DEPT } });
    expect(statusOf(res)).toBe(200);
    expect(mockPrisma.departmentPermission.create).toHaveBeenCalled();
  });

  it('grantPermissions (legacy) 404s for a foreign user', async () => {
    mockPrisma.userDepartmentPermission = { upsert: jest.fn() };
    const res = await call(permissionCtrl.grantPermissions, { body: { userId: FOREIGN_USER, department: 'drd', permissions: {} } });
    expect(statusOf(res)).toBe(404);
    expect(mockPrisma.userDepartmentPermission.upsert).not.toHaveBeenCalled();
  });
});
