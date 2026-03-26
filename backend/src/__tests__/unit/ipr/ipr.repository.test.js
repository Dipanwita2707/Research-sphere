/**
 * Unit Tests: IprRepository
 * Requirements: 2.8, 2.2
 */

const IprRepository = require('../../../modules/ipr/repositories/ipr.repository');

function makePrisma() {
  return {
    iprApplication: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    iprStatusHistory: { create: jest.fn() },
    iprContributor: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    iprApplicantDetails: { upsert: jest.fn(), findUnique: jest.fn() },
    iprSdg: { deleteMany: jest.fn(), createMany: jest.fn() },
    incentivePolicy: { findFirst: jest.fn() },
    userLogin: { findUnique: jest.fn(), findFirst: jest.fn() },
    employeeDetails: { findUnique: jest.fn() },
    studentDetails: { findUnique: jest.fn() },
    notification: { create: jest.fn() },
  };
}

describe('IprRepository', () => {
  let repo;
  let prisma;

  beforeEach(() => {
    prisma = makePrisma();
    repo = new IprRepository(prisma);
  });

  test('create() delegates to prisma.iprApplication.create', async () => {
    prisma.iprApplication.create.mockResolvedValue({ id: 'ipr-1' });
    await repo.create({ title: 'Test Patent' });
    expect(prisma.iprApplication.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { title: 'Test Patent' } })
    );
  });

  test('findById() passes id and include', async () => {
    prisma.iprApplication.findUnique.mockResolvedValue(null);
    await repo.findById('ipr-1', { reviews: true });
    expect(prisma.iprApplication.findUnique).toHaveBeenCalledWith({
      where: { id: 'ipr-1' },
      include: { reviews: true },
    });
  });

  test('findAll() applies default orderBy', async () => {
    prisma.iprApplication.findMany.mockResolvedValue([]);
    await repo.findAll({});
    expect(prisma.iprApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } })
    );
  });

  test('count() delegates to prisma.count', async () => {
    prisma.iprApplication.count.mockResolvedValue(5);
    const result = await repo.count({ status: 'submitted' });
    expect(prisma.iprApplication.count).toHaveBeenCalledWith({ where: { status: 'submitted' } });
    expect(result).toBe(5);
  });

  test('findByStatus() with string status', async () => {
    prisma.iprApplication.findMany.mockResolvedValue([]);
    await repo.findByStatus('approved');
    expect(prisma.iprApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'approved' } })
    );
  });

  test('findByStatus() with array status uses IN clause', async () => {
    prisma.iprApplication.findMany.mockResolvedValue([]);
    await repo.findByStatus(['approved', 'rejected']);
    expect(prisma.iprApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: { in: ['approved', 'rejected'] } } })
    );
  });

  test('findByApplicant() filters by userId', async () => {
    prisma.iprApplication.findMany.mockResolvedValue([]);
    await repo.findByApplicant('user-1', { iprType: 'patent' });
    expect(prisma.iprApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { applicantUserId: 'user-1', iprType: 'patent' } })
    );
  });

  test('updateStatus() merges status with extra fields', async () => {
    prisma.iprApplication.update.mockResolvedValue({ id: 'ipr-1' });
    await repo.updateStatus('ipr-1', 'approved', { reviewedAt: '2024-01-01' });
    expect(prisma.iprApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'approved', reviewedAt: '2024-01-01' } })
    );
  });

  test('delete() delegates to prisma.delete', async () => {
    prisma.iprApplication.delete.mockResolvedValue({ id: 'ipr-1' });
    await repo.delete('ipr-1');
    expect(prisma.iprApplication.delete).toHaveBeenCalledWith({ where: { id: 'ipr-1' } });
  });

  test('createStatusHistory() delegates to prisma.iprStatusHistory.create', async () => {
    prisma.iprStatusHistory.create.mockResolvedValue({ id: 'hist-1' });
    await repo.createStatusHistory({ iprApplicationId: 'ipr-1', status: 'approved' });
    expect(prisma.iprStatusHistory.create).toHaveBeenCalled();
  });

  test('upsertApplicantDetails() calls prisma.iprApplicantDetails.upsert', async () => {
    prisma.iprApplicantDetails.upsert.mockResolvedValue({});
    await repo.upsertApplicantDetails('ipr-1', { name: 'John' });
    expect(prisma.iprApplicantDetails.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { iprApplicationId: 'ipr-1' } })
    );
  });

  test('deleteSdgs() calls deleteMany with iprApplicationId', async () => {
    prisma.iprSdg.deleteMany.mockResolvedValue({ count: 3 });
    await repo.deleteSdgs('ipr-1');
    expect(prisma.iprSdg.deleteMany).toHaveBeenCalledWith({ where: { iprApplicationId: 'ipr-1' } });
  });

  test('findActivePolicy() queries incentivePolicy with isActive and date range', async () => {
    prisma.incentivePolicy.findFirst.mockResolvedValue(null);
    await repo.findActivePolicy('patent');
    expect(prisma.incentivePolicy.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ iprType: 'patent', isActive: true }) })
    );
  });

  test('createNotification() delegates to prisma.notification.create', async () => {
    prisma.notification.create.mockResolvedValue({ id: 'notif-1' });
    await repo.createNotification({ userId: 'user-1', message: 'Test' });
    expect(prisma.notification.create).toHaveBeenCalled();
  });
});

describe('IprRepository - extended coverage', () => {
  let repo;
  let prisma;

  beforeEach(() => {
    prisma = {
      iprApplication: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      iprStatusHistory: { create: jest.fn() },
      iprContributor: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
      iprApplicantDetails: { upsert: jest.fn(), findUnique: jest.fn() },
      iprSdg: { deleteMany: jest.fn(), createMany: jest.fn() },
      incentivePolicy: { findFirst: jest.fn() },
      userLogin: { findUnique: jest.fn(), findFirst: jest.fn() },
      employeeDetails: { findUnique: jest.fn() },
      studentDetails: { findUnique: jest.fn() },
      notification: { create: jest.fn() },
    };
    repo = new IprRepository(prisma);
  });

  test('findContributors() delegates to prisma.iprContributor.findMany', async () => {
    prisma.iprContributor.findMany.mockResolvedValue([{ id: 'c-1' }]);
    const result = await repo.findContributors({ iprApplicationId: 'ipr-1' });
    expect(prisma.iprContributor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { iprApplicationId: 'ipr-1' } })
    );
    expect(result).toHaveLength(1);
  });

  test('findFirstContributor() delegates to prisma.iprContributor.findFirst', async () => {
    prisma.iprContributor.findFirst.mockResolvedValue({ id: 'c-1' });
    const result = await repo.findFirstContributor({ iprApplicationId: 'ipr-1', userId: 'user-1' });
    expect(prisma.iprContributor.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { iprApplicationId: 'ipr-1', userId: 'user-1' } })
    );
    expect(result.id).toBe('c-1');
  });

  test('findApplicantDetails() delegates to prisma.iprApplicantDetails.findUnique', async () => {
    prisma.iprApplicantDetails.findUnique.mockResolvedValue({ mentorUid: 'mentor-1' });
    const result = await repo.findApplicantDetails('ipr-1');
    expect(prisma.iprApplicantDetails.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { iprApplicationId: 'ipr-1' } })
    );
    expect(result.mentorUid).toBe('mentor-1');
  });

  test('createManySdgs() delegates to prisma.iprSdg.createMany', async () => {
    prisma.iprSdg.createMany.mockResolvedValue({ count: 2 });
    const data = [
      { iprApplicationId: 'ipr-1', sdgCode: 'SDG1', sdgTitle: 'No Poverty' },
      { iprApplicationId: 'ipr-1', sdgCode: 'SDG2', sdgTitle: 'Zero Hunger' },
    ];
    await repo.createManySdgs(data);
    expect(prisma.iprSdg.createMany).toHaveBeenCalledWith({ data });
  });

  test('groupBy() delegates to prisma.iprApplication.groupBy', async () => {
    prisma.iprApplication.groupBy.mockResolvedValue([{ iprType: 'patent', _count: 3 }]);
    const result = await repo.groupBy({ by: ['iprType'], where: {}, _count: true });
    expect(prisma.iprApplication.groupBy).toHaveBeenCalledWith({ by: ['iprType'], where: {}, _count: true });
    expect(result).toHaveLength(1);
  });

  test('findUserByUid() queries userLogin by uid', async () => {
    prisma.userLogin.findFirst.mockResolvedValue({ id: 'user-1', uid: 'EMP001' });
    const result = await repo.findUserByUid('EMP001');
    expect(prisma.userLogin.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { uid: 'EMP001' } })
    );
    expect(result.uid).toBe('EMP001');
  });

  test('findEmployeeDetails() queries by userLoginId', async () => {
    prisma.employeeDetails.findUnique.mockResolvedValue({ primarySchoolId: 'school-1' });
    const result = await repo.findEmployeeDetails('user-1');
    expect(prisma.employeeDetails.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userLoginId: 'user-1' } })
    );
    expect(result.primarySchoolId).toBe('school-1');
  });

  test('findStudentDetails() queries by userLoginId', async () => {
    prisma.studentDetails.findUnique.mockResolvedValue({ programId: 'prog-1' });
    const result = await repo.findStudentDetails('user-1');
    expect(prisma.studentDetails.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userLoginId: 'user-1' } })
    );
    expect(result.programId).toBe('prog-1');
  });

  test('findFirst() delegates to prisma.iprApplication.findFirst', async () => {
    prisma.iprApplication.findFirst.mockResolvedValue({ id: 'ipr-1' });
    const result = await repo.findFirst({ status: 'draft' });
    expect(prisma.iprApplication.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'draft' } })
    );
    expect(result.id).toBe('ipr-1');
  });

  test('update() delegates to prisma.iprApplication.update', async () => {
    prisma.iprApplication.update.mockResolvedValue({ id: 'ipr-1', title: 'Updated' });
    const result = await repo.update('ipr-1', { title: 'Updated' });
    expect(prisma.iprApplication.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ipr-1' }, data: { title: 'Updated' } })
    );
    expect(result.title).toBe('Updated');
  });

  test('createContributor() delegates to prisma.iprContributor.create', async () => {
    prisma.iprContributor.create.mockResolvedValue({ id: 'contrib-1' });
    await repo.createContributor({ iprApplicationId: 'ipr-1', name: 'John' });
    expect(prisma.iprContributor.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { iprApplicationId: 'ipr-1', name: 'John' } })
    );
  });
});
