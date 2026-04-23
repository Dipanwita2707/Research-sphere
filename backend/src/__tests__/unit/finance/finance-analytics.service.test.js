jest.mock('../../../shared/config/database', () => ({
  feeStructure: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  loanLetter: {
    count: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  program: {
    findMany: jest.fn(),
  },
}));

const prisma = require('../../../shared/config/database');
const service = require('../../../modules/finance/analytics/finance-analytics.service');

describe('finance-analytics.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getProgramFeeBreakdown aggregates structures, totals, and semester metadata', async () => {
    prisma.feeStructure.findMany.mockResolvedValue([
      {
        id: 'fs-base',
        batchYear: 2024,
        program: {
          id: 'prog-1',
          programCode: 'BTECH',
          programName: 'B.Tech',
          department: {
            id: 'dept-1',
            departmentCode: 'CSE',
            departmentName: 'Computer Science',
            faculty: {
              id: 'school-1',
              facultyCode: 'ENG',
              facultyName: 'Engineering',
            },
          },
        },
        specialization: null,
        heads: [
          {
            headName: 'Tuition',
            amount: '1000',
            semesterAmounts: { 1: 500, 2: 500 },
          },
          {
            headName: 'Library',
            amount: '200',
            semesterAmounts: { 1: 100, 2: 100 },
          },
        ],
      },
      {
        id: 'fs-spec',
        batchYear: 2024,
        program: {
          id: 'prog-1',
          programCode: 'BTECH',
          programName: 'B.Tech',
          department: {
            id: 'dept-1',
            departmentCode: 'CSE',
            departmentName: 'Computer Science',
            faculty: {
              id: 'school-1',
              facultyCode: 'ENG',
              facultyName: 'Engineering',
            },
          },
        },
        specialization: {
          id: 'spec-1',
          specializationCode: 'AI',
          specializationName: 'Artificial Intelligence',
        },
        heads: [
          {
            headName: 'Specialization Lab',
            amount: '300',
            semesterAmounts: { 2: 150, 3: 150 },
          },
        ],
      },
    ]);

    const result = await service.getProgramFeeBreakdown();

    expect(prisma.feeStructure.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { type: 'ACADEMIC' },
      })
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        programId: 'prog-1',
        programCode: 'BTECH',
        schoolId: 'school-1',
        departmentId: 'dept-1',
        totalStructures: 2,
        totalAmount: 1500,
      })
    );
    expect(result[0].specializations).toHaveLength(2);
    expect(result[0].specializations[0]).toEqual(
      expect.objectContaining({
        id: null,
        amount: 1200,
        semesters: [1, 2],
      })
    );
    expect(result[0].specializations[1]).toEqual(
      expect.objectContaining({
        id: 'spec-1',
        code: 'AI',
        amount: 300,
        semesters: [2, 3],
      })
    );
  });

  test('getLoanLetterMonthlyTrend groups current-year letters into month buckets', async () => {
    const currentYear = new Date().getFullYear();

    prisma.loanLetter.findMany.mockResolvedValue([
      { issuedAt: new Date(currentYear, 0, 5) },
      { issuedAt: new Date(currentYear, 0, 22) },
      { issuedAt: new Date(currentYear, 2, 10) },
    ]);

    const result = await service.getLoanLetterMonthlyTrend();

    expect(prisma.loanLetter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          issuedAt: {
            gte: new Date(currentYear, 0, 1),
          },
        },
      })
    );
    expect(result).toHaveLength(12);
    expect(result[0]).toEqual({ month: 'Jan', count: 2 });
    expect(result[2]).toEqual({ month: 'Mar', count: 1 });
    expect(result[11]).toEqual({ month: 'Dec', count: 0 });
  });

  test('getLoanLettersByProgram returns summary counts without embedded detail payloads', async () => {
    prisma.loanLetter.groupBy.mockResolvedValue([
      {
        programId: 'prog-1',
        programCode: 'BTECH',
        programName: 'B.Tech',
        _count: { _all: 3 },
      },
      {
        programId: 'prog-2',
        programCode: 'MBA',
        programName: 'MBA',
        _count: { _all: 1 },
      },
    ]);

    const result = await service.getLoanLettersByProgram();

    expect(prisma.loanLetter.groupBy).toHaveBeenCalledWith({
      by: ['programId', 'programCode', 'programName'],
      _count: { _all: true },
    });
    expect(result).toEqual([
      {
        programId: 'prog-1',
        programCode: 'BTECH',
        programName: 'B.Tech',
        count: 3,
      },
      {
        programId: 'prog-2',
        programCode: 'MBA',
        programName: 'MBA',
        count: 1,
      },
    ]);
    expect(result[0]).not.toHaveProperty('letters');
  });

  test('getLoanLettersBySchool aggregates by programme counts instead of fetching every letter', async () => {
    prisma.loanLetter.groupBy.mockResolvedValue([
      { programId: 'prog-1', _count: { _all: 4 } },
      { programId: 'prog-2', _count: { _all: 2 } },
    ]);
    prisma.program.findMany.mockResolvedValue([
      {
        id: 'prog-1',
        department: {
          faculty: {
            id: 'school-1',
            facultyCode: 'ENG',
            facultyName: 'Engineering',
          },
        },
      },
      {
        id: 'prog-2',
        department: {
          faculty: {
            id: 'school-1',
            facultyCode: 'ENG',
            facultyName: 'Engineering',
          },
        },
      },
    ]);

    const result = await service.getLoanLettersBySchool();

    expect(prisma.loanLetter.findMany).not.toHaveBeenCalled();
    expect(prisma.program.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['prog-1', 'prog-2'] } },
      select: {
        id: true,
        department: {
          select: {
            faculty: { select: { id: true, facultyCode: true, facultyName: true } },
          },
        },
      },
    });
    expect(result).toEqual([
      {
        schoolId: 'school-1',
        schoolCode: 'ENG',
        schoolName: 'Engineering',
        count: 6,
      },
    ]);
  });
});
