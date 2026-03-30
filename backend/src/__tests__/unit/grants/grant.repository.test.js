/**
 * Unit Tests: GrantRepository
 * Requirements: 2.8, 2.2
 */

const GrantRepository = require('../../../modules/grants/repositories/grant.repository');

function makePrisma() {
  return {
    grantApplication: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    grantInvestigator: { create: jest.fn(), deleteMany: jest.fn() },
    grantConsortiumOrganization: { deleteMany: jest.fn() },
    grantApplicationStatusHistory: { create: jest.fn() },
    grantApplicationReview: { create: jest.fn() },
    grantApplicationEditSuggestion: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    grantIncentivePolicy: { findFirst: jest.fn() },
    centralDepartment: { findFirst: jest.fn() },
    centralDepartmentPermission: { findFirst: jest.fn() },
    userLogin: { findUnique: jest.fn() },
  };
}

describe('GrantRepository', () => {
  let repo;
  let prisma;

  beforeEach(() => {
    prisma = makePrisma();
    repo = new GrantRepository(prisma);
  });

  test('create() delegates to prisma.grantApplication.create', async () => {
    prisma.grantApplication.create.mockResolvedValue({ id: 'grant-1' });
    await repo.create({ title: 'Test Grant' });
    expect(prisma.grantApplication.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { title: 'Test Grant' } })
    );
  });

  test('findById() passes id and include', async () => {
    prisma.grantApplication.findUnique.mockResolvedValue(null);
    await repo.findById('grant-1', { investigators: true });
    expect(prisma.grantApplication.findUnique).toHaveBeenCalledWith({
      where: { id: 'grant-1' },
      include: { investigators: true },
    });
  });

  test('findAll() applies default orderBy', async () => {
    prisma.grantApplication.findMany.mockResolvedValue([]);
    await repo.findAll({});
    expect(prisma.grantApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } })
    );
  });

  test('findAll() passes skip and take', async () => {
    prisma.grantApplication.findMany.mockResolvedValue([]);
    await repo.findAll({ skip: 0, take: 10 });
    expect(prisma.grantApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 })
    );
  });

  test('count() delegates to prisma.count', async () => {
    prisma.grantApplication.count.mockResolvedValue(3);
    const result = await repo.count({ status: 'draft' });
    expect(result).toBe(3);
  });

  test('update() passes id and data', async () => {
    prisma.grantApplication.update.mockResolvedValue({ id: 'grant-1' });
    await repo.update('grant-1', { title: 'Updated' });
    expect(prisma.grantApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'grant-1' }, data: { title: 'Updated' } })
    );
  });

  test('updateStatus() merges status with extra fields', async () => {
    prisma.grantApplication.update.mockResolvedValue({ id: 'grant-1' });
    await repo.updateStatus('grant-1', 'approved', { approvedAt: '2024-01-01' });
    expect(prisma.grantApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'approved', approvedAt: '2024-01-01' } })
    );
  });

  test('delete() delegates to prisma.delete', async () => {
    prisma.grantApplication.delete.mockResolvedValue({ id: 'grant-1' });
    await repo.delete('grant-1');
    expect(prisma.grantApplication.delete).toHaveBeenCalledWith({ where: { id: 'grant-1' } });
  });

  test('createInvestigator() delegates to prisma.grantInvestigator.create', async () => {
    prisma.grantInvestigator.create.mockResolvedValue({ id: 'inv-1' });
    await repo.createInvestigator({ grantApplicationId: 'grant-1', name: 'Dr. Smith' });
    expect(prisma.grantInvestigator.create).toHaveBeenCalled();
  });

  test('deleteInvestigators() calls deleteMany with grantApplicationId', async () => {
    prisma.grantInvestigator.deleteMany.mockResolvedValue({ count: 2 });
    await repo.deleteInvestigators('grant-1');
    expect(prisma.grantInvestigator.deleteMany).toHaveBeenCalledWith({ where: { grantApplicationId: 'grant-1' } });
  });

  test('deleteConsortiumOrgs() calls deleteMany with grantApplicationId', async () => {
    prisma.grantConsortiumOrganization.deleteMany.mockResolvedValue({ count: 1 });
    await repo.deleteConsortiumOrgs('grant-1');
    expect(prisma.grantConsortiumOrganization.deleteMany).toHaveBeenCalledWith({ where: { grantApplicationId: 'grant-1' } });
  });

  test('createStatusHistory() delegates to prisma.grantApplicationStatusHistory.create', async () => {
    prisma.grantApplicationStatusHistory.create.mockResolvedValue({ id: 'hist-1' });
    await repo.createStatusHistory({ grantApplicationId: 'grant-1', status: 'approved' });
    expect(prisma.grantApplicationStatusHistory.create).toHaveBeenCalled();
  });

  test('findActivePolicy() queries with projectCategory and projectType', async () => {
    prisma.grantIncentivePolicy.findFirst.mockResolvedValue(null);
    await repo.findActivePolicy('government', 'research');
    expect(prisma.grantIncentivePolicy.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ projectCategory: 'government', projectType: 'research', isActive: true }),
      })
    );
  });

  test('findDrdDepartment() queries by DRD code or shortName', async () => {
    prisma.centralDepartment.findFirst.mockResolvedValue({ id: 'drd-1' });
    await repo.findDrdDepartment();
    expect(prisma.centralDepartment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ OR: expect.any(Array) }) })
    );
  });

  test('findDirectPermission() queries by userId and centralDeptId', async () => {
    prisma.centralDepartmentPermission.findFirst.mockResolvedValue(null);
    await repo.findDirectPermission('user-1', 'drd-1');
    expect(prisma.centralDepartmentPermission.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'user-1', centralDeptId: 'drd-1' }) })
    );
  });
});
