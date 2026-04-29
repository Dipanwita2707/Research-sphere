jest.mock('../../../shared/config/database', () => ({
  feeStructure: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  feeHead: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  program: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  programSpecialization: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
}));

const prisma = require('../../../shared/config/database');
const service = require('../../../modules/finance/fee-structure/fee-structure.service');

describe('fee-structure.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('create() stores academic heads with summed semester totals inside a transaction', async () => {
    prisma.feeStructure.findFirst.mockResolvedValue(null);

    const tx = {
      feeStructure: {
        create: jest.fn().mockResolvedValue({ id: 'fs-1' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'fs-1', batchYear: 2024 }),
      },
      feeHead: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const result = await service.create({
      type: 'ACADEMIC',
      batchYear: 2024,
      programId: 'prog-1',
      heads: [
        {
          headName: 'Tuition',
          semesterAmounts: { 1: 100, 2: 200 },
        },
        {
          headName: 'Library',
          amount: 50,
        },
      ],
    });

    expect(prisma.feeStructure.findFirst).toHaveBeenCalledWith({
      where: {
        type: 'ACADEMIC',
        batchYear: 2024,
        programId: 'prog-1',
        specializationId: null,
      },
    });
    expect(tx.feeStructure.create).toHaveBeenCalledWith({
      data: {
        type: 'ACADEMIC',
        batchYear: 2024,
        programId: 'prog-1',
        specializationId: null,
        isActive: true,
      },
    });
    expect(tx.feeHead.createMany).toHaveBeenCalledWith({
      data: [
        {
          feeStructureId: 'fs-1',
          headName: 'Tuition',
          amount: 300,
          semesterAmounts: { 1: 100, 2: 200 },
        },
        {
          feeStructureId: 'fs-1',
          headName: 'Library',
          amount: 50,
          semesterAmounts: null,
        },
      ],
    });
    expect(result).toEqual({ id: 'fs-1', batchYear: 2024 });
  });

  test('bulkCreate() groups rows and creates one academic structure per valid group', async () => {
    prisma.program.findMany.mockResolvedValue([
      {
        id: 'prog-1',
        programCode: 'BTECH',
        durationSemesters: 4,
        specializations: [
          {
            id: 'spec-1',
            specializationCode: 'AI',
          },
        ],
      },
    ]);
    prisma.feeStructure.findMany.mockResolvedValue([]);
    const tx = {
      feeStructure: {
        create: jest.fn()
          .mockResolvedValueOnce({ id: 'fs-base' })
          .mockResolvedValueOnce({ id: 'fs-spec' }),
      },
      feeHead: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const result = await service.bulkCreate([
      { programCode: 'BTECH', batchYear: 2024, specializationCode: '', headName: 'Tuition', sem1: '100', sem2: '200' },
      { programCode: 'BTECH', batchYear: 2024, specializationCode: '', headName: 'Library', sem1: '50', sem2: '50' },
      { programCode: 'BTECH', batchYear: 2024, specializationCode: 'AI', headName: 'AI Lab', sem1: '75', sem2: '75' },
    ]);

    expect(prisma.feeStructure.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            type: 'ACADEMIC',
            batchYear: 2024,
            programId: 'prog-1',
            specializationId: null,
          },
          {
            type: 'ACADEMIC',
            batchYear: 2024,
            programId: 'prog-1',
            specializationId: 'spec-1',
          },
        ],
      },
      include: {
        specialization: {
          select: { specializationName: true },
        },
      },
    });
    expect(tx.feeStructure.create).toHaveBeenCalledTimes(2);
    expect(tx.feeHead.createMany).toHaveBeenNthCalledWith(1, {
      data: [
        {
          feeStructureId: 'fs-base',
          headName: 'Tuition',
          amount: 300,
          semesterAmounts: { 1: 100, 2: 200, 3: 0, 4: 0 },
        },
        {
          feeStructureId: 'fs-base',
          headName: 'Library',
          amount: 100,
          semesterAmounts: { 1: 50, 2: 50, 3: 0, 4: 0 },
        },
      ],
    });
    expect(tx.feeHead.createMany).toHaveBeenNthCalledWith(2, {
      data: [
        {
          feeStructureId: 'fs-spec',
          headName: 'AI Lab',
          amount: 150,
          semesterAmounts: { 1: 75, 2: 75, 3: 0, 4: 0 },
        },
      ],
    });
    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
  });

  test('bulkCreate() reports an error when uploaded semesters exceed configured programme duration', async () => {
    prisma.program.findMany.mockResolvedValue([
      {
        id: 'prog-1',
        programCode: 'BTECH',
        durationSemesters: 2,
        specializations: [],
      },
    ]);
    prisma.feeStructure.findMany.mockResolvedValue([]);

    const result = await service.bulkCreate([
      { programCode: 'BTECH', batchYear: 2024, headName: 'Tuition', sem1: '100', sem2: '100', sem3: '100' },
    ]);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result.created).toBe(0);
    expect(result.errors).toEqual([
      'BTECH/2024/base: uploaded semester columns exceed configured duration (2)',
    ]);
    expect(result.groups[0]).toEqual(
      expect.objectContaining({
        status: 'error',
        headCount: 0,
      })
    );
  });

  test('createAcademicBatch() creates base and specialization structures in one transaction', async () => {
    prisma.program.findUnique.mockResolvedValue({
      id: 'prog-1',
      programCode: 'BTECH',
      programName: 'B.Tech',
    });
    prisma.programSpecialization.findMany.mockResolvedValue([
      {
        id: 'spec-1',
        specializationCode: 'AI',
        specializationName: 'Artificial Intelligence',
      },
    ]);
    prisma.feeStructure.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'fs-base', specializationId: null },
        { id: 'fs-spec', specializationId: 'spec-1' },
      ]);

    const tx = {
      feeStructure: {
        create: jest.fn()
          .mockResolvedValueOnce({ id: 'fs-base' })
          .mockResolvedValueOnce({ id: 'fs-spec' }),
      },
      feeHead: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const result = await service.createAcademicBatch({
      batchYear: 2024,
      programId: 'prog-1',
      baseHeads: [
        { headName: 'Tuition', semesterAmounts: { 1: 100, 2: 200 } },
      ],
      specializationStructures: [
        {
          specializationId: 'spec-1',
          heads: [{ headName: 'AI Lab', amount: 150, semesterAmounts: { 1: 75, 2: 75 } }],
        },
      ],
    });

    expect(prisma.feeStructure.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        type: 'ACADEMIC',
        batchYear: 2024,
        programId: 'prog-1',
        OR: [
          { specializationId: null },
          { specializationId: 'spec-1' },
        ],
      },
      include: {
        specialization: {
          select: { specializationName: true },
        },
      },
    });
    expect(tx.feeStructure.create).toHaveBeenCalledTimes(2);
    expect(tx.feeHead.createMany).toHaveBeenNthCalledWith(1, {
      data: [
        {
          feeStructureId: 'fs-base',
          headName: 'Tuition',
          amount: 300,
          semesterAmounts: { 1: 100, 2: 200 },
        },
      ],
    });
    expect(tx.feeHead.createMany).toHaveBeenNthCalledWith(2, {
      data: [
        {
          feeStructureId: 'fs-spec',
          headName: 'AI Lab',
          amount: 150,
          semesterAmounts: { 1: 75, 2: 75 },
        },
      ],
    });
    expect(result).toEqual([
      { id: 'fs-base', specializationId: null },
      { id: 'fs-spec', specializationId: 'spec-1' },
    ]);
  });
});
