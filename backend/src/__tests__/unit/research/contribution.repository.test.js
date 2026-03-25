/**
 * Unit Tests: ContributionRepository
 * Requirements: 2.8, 2.2
 */

const ContributionRepository = require('../../../modules/research/repositories/contribution.repository');

function makePrisma() {
  return {
    researchContribution: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
  };
}

describe('ContributionRepository', () => {
  let repo;
  let prisma;

  beforeEach(() => {
    prisma = makePrisma();
    repo = new ContributionRepository(prisma);
  });

  test('create() delegates to prisma.researchContribution.create', async () => {
    const data = { title: 'Test' };
    prisma.researchContribution.create.mockResolvedValue({ id: '1', ...data });
    const result = await repo.create(data);
    expect(prisma.researchContribution.create).toHaveBeenCalledWith({ data });
    expect(result.id).toBe('1');
  });

  test('findById() passes id and include to findUnique', async () => {
    prisma.researchContribution.findUnique.mockResolvedValue({ id: 'abc' });
    await repo.findById('abc', { authors: true });
    expect(prisma.researchContribution.findUnique).toHaveBeenCalledWith({
      where: { id: 'abc' },
      include: { authors: true },
    });
  });

  test('findById() with no include omits include key', async () => {
    prisma.researchContribution.findUnique.mockResolvedValue(null);
    await repo.findById('abc');
    expect(prisma.researchContribution.findUnique).toHaveBeenCalledWith({
      where: { id: 'abc' },
      include: {},
    });
  });

  test('findFirst() passes where and options', async () => {
    prisma.researchContribution.findFirst.mockResolvedValue(null);
    await repo.findFirst({ status: 'pending' }, { orderBy: { createdAt: 'desc' } });
    expect(prisma.researchContribution.findFirst).toHaveBeenCalledWith({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
  });

  test('findAll() uses default orderBy when not specified', async () => {
    prisma.researchContribution.findMany.mockResolvedValue([]);
    await repo.findAll({ where: { status: 'approved' } });
    expect(prisma.researchContribution.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } })
    );
  });

  test('findAll() passes skip and take when provided', async () => {
    prisma.researchContribution.findMany.mockResolvedValue([]);
    await repo.findAll({ skip: 10, take: 5 });
    expect(prisma.researchContribution.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 5 })
    );
  });

  test('update() passes id, data, and include', async () => {
    prisma.researchContribution.update.mockResolvedValue({ id: '1' });
    await repo.update('1', { status: 'approved' }, { authors: true });
    expect(prisma.researchContribution.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { status: 'approved' },
      include: { authors: true },
    });
  });

  test('delete() passes id to prisma.delete', async () => {
    prisma.researchContribution.delete.mockResolvedValue({ id: '1' });
    await repo.delete('1');
    expect(prisma.researchContribution.delete).toHaveBeenCalledWith({ where: { id: '1' } });
  });

  test('findByFaculty() filters by applicantUserId', async () => {
    prisma.researchContribution.findMany.mockResolvedValue([]);
    await repo.findByFaculty('user-1', { status: 'approved' });
    expect(prisma.researchContribution.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ applicantUserId: 'user-1', status: 'approved' }) })
    );
  });

  test('findPendingReview() filters by status and mentorUid', async () => {
    prisma.researchContribution.findMany.mockResolvedValue([]);
    await repo.findPendingReview('MENTOR001');
    expect(prisma.researchContribution.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'pending_mentor_approval',
          applicantDetails: { mentorUid: 'MENTOR001' },
        }),
      })
    );
  });

  test('groupBy() delegates to prisma.groupBy', async () => {
    prisma.researchContribution.groupBy.mockResolvedValue([]);
    const opts = { by: ['status'], _count: true };
    await repo.groupBy(opts);
    expect(prisma.researchContribution.groupBy).toHaveBeenCalledWith(opts);
  });
});
