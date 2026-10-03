/**
 * DELETE /employees/:id must never destroy institutional records: employees with any
 * research/IPR/grant footprint are deactivated; only record-free accounts are deleted.
 */
const countFns = [
  'researchContribution', 'iprApplication', 'grantApplication', 'researchContributionAuthor', 'iprContributor',
  'grantInvestigator', 'researchProgressTracker', 'researchContributionReview', 'iprReview',
  'grantApplicationReview', 'iprFinance',
];
const writeModels = [
  'researchContribution', 'iprApplication', 'grantApplication', 'userDepartmentPermission', 'departmentPermission',
  'centralDepartmentPermission', 'passwordResetToken', 'studentDetails', 'auditLog', 'incentivePolicy',
  'researchIncentivePolicy', 'bookIncentivePolicy', 'bookChapterIncentivePolicy', 'conferenceIncentivePolicy',
  'grantIncentivePolicy', 'iPR', 'card', 'reissueRequest', 'researchProfileIdentity', 'notification', 'userSettings',
  'employeeDetails', 'userLogin',
];

const mockPrisma = {};
for (const m of new Set([...countFns, ...writeModels])) {
  mockPrisma[m] = {
    count: jest.fn().mockResolvedValue(0),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
    findUnique: jest.fn(),
  };
}
mockPrisma.$transaction = jest.fn(async (fn) => fn(mockPrisma));

jest.mock('../../../shared/config/database', () => mockPrisma);
jest.mock('../../../shared/config/redis', () => ({ invalidateUser: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../../shared/utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }));
jest.mock('../../../shared/utils/auditLogger', () => ({}));
jest.mock('../../../modules/auth/services/session.service', () => ({ REVOKE_SESSIONS_DATA: { tokenVersion: { increment: 1 } } }));
jest.mock('../../../modules/core/utils/userCredentials', () => ({}));
jest.mock('../../../shared/validations/employee.validation', () => ({}));

const cache = require('../../../shared/config/redis');
const { deleteEmployee } = require('../../../modules/core/controllers/employee.controller');

const employee = { id: 'emp-1', uid: 'FAC-1', email: 'f@uni.edu', role: 'faculty', status: 'active', universityId: 'uni-1', employeeDetails: { id: 'ed-1' } };

function call({ user = employee, tenantId = 'uni-1', actorId = 'admin-1' } = {}) {
  mockPrisma.userLogin.findUnique.mockResolvedValue(user);
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  return deleteEmployee({ params: { id: 'emp-1' }, tenantId, user: { id: actorId } }, res).then(() => res);
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const m of countFns) mockPrisma[m].count.mockResolvedValue(0);
  mockPrisma.userLogin.delete.mockResolvedValue({});
});

describe('deleteEmployee', () => {
  it('deactivates (never deletes) an employee who has records, and keeps every record', async () => {
    mockPrisma.researchContributionAuthor.count.mockResolvedValue(3);
    const res = await call();

    expect(res.body).toMatchObject({ success: true, action: 'deactivated' });
    expect(mockPrisma.userLogin.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'emp-1' }, data: expect.objectContaining({ status: 'inactive' }) }),
    );
    expect(mockPrisma.userLogin.delete).not.toHaveBeenCalled();
    expect(mockPrisma.researchContribution.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.researchContributionAuthor.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.departmentPermission.deleteMany).toHaveBeenCalledWith({ where: { userId: 'emp-1' } });
    expect(cache.invalidateUser).toHaveBeenCalledWith('emp-1');
  });

  it('deletes an employee with no records', async () => {
    const res = await call();
    expect(res.body).toMatchObject({ success: true, action: 'deleted' });
    expect(mockPrisma.userLogin.delete).toHaveBeenCalledWith({ where: { id: 'emp-1' } });
    expect(cache.invalidateUser).toHaveBeenCalledWith('emp-1');
  });

  it('falls back to deactivation when the database refuses the delete (still referenced)', async () => {
    mockPrisma.userLogin.delete.mockRejectedValueOnce(Object.assign(new Error('fk'), { code: 'P2003' }));
    const res = await call();
    expect(res.body).toMatchObject({ success: true, action: 'deactivated' });
    expect(mockPrisma.userLogin.update).toHaveBeenCalled();
  });

  it('refuses to delete your own account', async () => {
    const res = await call({ actorId: 'emp-1' });
    expect(res.statusCode).toBe(400);
    expect(mockPrisma.userLogin.delete).not.toHaveBeenCalled();
  });

  it('refuses an employee of another university', async () => {
    const res = await call({ tenantId: 'uni-2' });
    expect(res.statusCode).toBe(403);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown employee', async () => {
    const res = await call({ user: null });
    expect(res.statusCode).toBe(404);
  });
});
