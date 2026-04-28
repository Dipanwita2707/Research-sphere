jest.mock('../../../shared/config/database', () => ({
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
  loanLetter: {
    count: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  auditLog: {
    findMany: jest.fn(),
  },
  feeStructure: {
    findFirst: jest.fn(),
  },
  program: {
    findUnique: jest.fn(),
  },
  programSpecialization: {
    findUnique: jest.fn(),
  },
}));

jest.mock('../../../modules/audit/services/audit.service', () => ({
  auditService: {
    log: jest.fn(),
  },
  AuditActionType: {
    DOWNLOAD: 'DOWNLOAD',
  },
  AuditModule: {
    FINANCE: 'finance',
  },
  AuditSeverity: {
    INFO: 'INFO',
  },
}));

const prisma = require('../../../shared/config/database');
const {
  auditService,
  AuditActionType,
  AuditModule,
  AuditSeverity,
} = require('../../../modules/audit/services/audit.service');
const service = require('../../../modules/finance/loan-letter/loan-letter.service');

describe('loan-letter.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('list() narrows ownOnly results with deduped reprint ids and enriches reprint metadata', async () => {
    prisma.auditLog.findMany
      .mockResolvedValueOnce([
        {
          id: 'log-1',
          targetId: 'letter-2',
          createdAt: new Date('2026-04-20T10:00:00.000Z'),
          actor: {
            id: 'user-1',
            uid: 'EMP001',
            employeeDetails: { displayName: 'Finance User' },
          },
        },
      ]);
    prisma.$queryRaw
      .mockResolvedValueOnce([{ id: 'letter-2' }])
      .mockResolvedValueOnce([{ count: 1 }]);
    prisma.loanLetter.findMany.mockResolvedValue([
      {
        id: 'letter-2',
        uniqueNumber: 'LL-2026-00002',
        applicationNumber: 'APP-2',
        studentName: 'Student Two',
        studentEmail: 'two@example.com',
        programName: 'B.Tech',
        issuedAt: new Date('2026-04-20T08:00:00.000Z'),
        selectedSemesters: [1, 2],
        transportIncluded: false,
        hostelIncluded: false,
        printedById: 'user-1',
        printedBy: {
          id: 'user-1',
          uid: 'EMP001',
          employeeDetails: { displayName: 'Finance User' },
        },
      },
    ]);
    prisma.loanLetter.count.mockResolvedValue(1);

    const result = await service.list({ ownOnly: true, userId: 'user-1', page: 1, limit: 10 });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prisma.loanLetter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['letter-2'] } },
      })
    );
    expect(result.total).toBe(1);
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 'letter-2',
        reprintCount: 1,
        lastReprintedBy: {
          id: 'user-1',
          uid: 'EMP001',
          name: 'Finance User',
        },
      })
    );
  });

  test('getById() builds fee breakdown totals across academic, specialization, transport, and hostel fees', async () => {
    prisma.loanLetter.findUnique.mockResolvedValue({
      id: 'letter-1',
      uniqueNumber: 'LL-2026-00001',
      applicationNumber: 'APP-1',
      studentName: 'Student One',
      programId: 'prog-1',
      specializationId: 'spec-1',
      selectedSemesters: [1, 2],
      transportIncluded: true,
      hostelIncluded: true,
      program: {
        id: 'prog-1',
        programCode: 'BTECH',
        programName: 'B.Tech',
        durationYears: 4,
        durationMonths: 48,
        durationSemesters: 8,
      },
      specialization: {
        id: 'spec-1',
        specializationCode: 'AI',
        specializationName: 'Artificial Intelligence',
      },
      printedBy: null,
    });
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.$queryRaw.mockReset();
    prisma.feeStructure.findFirst
      .mockResolvedValueOnce({
        heads: [
          { headName: 'Tuition', amount: '1000', semesterAmounts: { 1: 500, 2: 500 } },
          { headName: 'Library', amount: '200', semesterAmounts: { 1: 100, 2: 100 } },
        ],
      })
      .mockResolvedValueOnce({
        heads: [
          { headName: 'AI Lab', amount: '300', semesterAmounts: { 1: 150, 2: 150 } },
        ],
      })
      .mockResolvedValueOnce({
        heads: [
          { headName: 'Bus', amount: '400' },
        ],
      })
      .mockResolvedValueOnce({
        heads: [
          { headName: 'Hostel', amount: '600' },
        ],
      });

    const result = await service.getById('letter-1');

    expect(prisma.feeStructure.findFirst).toHaveBeenCalledTimes(4);
    expect(result.feeBreakdown).toEqual(
      expect.objectContaining({
        selectedSemesters: [1, 2],
        selectedYears: 1,
        selectedAccommodationMonths: 11,
        grandTotal: 12500,
      })
    );
    expect(result.feeBreakdown.academic).toEqual([
      {
        headName: 'Tuition',
        semesterAmounts: { 1: 500, 2: 500 },
        total: 1000,
      },
      {
        headName: 'Library',
        semesterAmounts: { 1: 100, 2: 100 },
        total: 200,
      },
    ]);
    expect(result.feeBreakdown.specialization[0].total).toBe(300);
    expect(result.feeBreakdown.transport[0]).toEqual(
      expect.objectContaining({
        headName: 'Bus',
        amount: 400,
        months: 11,
        years: 1,
        yearlyTotal: 4400,
      })
    );
    expect(result.feeBreakdown.hostel[0]).toEqual(
      expect.objectContaining({
        headName: 'Hostel',
        amount: 600,
        months: 11,
        years: 1,
        yearlyTotal: 6600,
      })
    );
  });

  test('recordReprint() writes an audit entry and returns refreshed letter data', async () => {
    prisma.loanLetter.findUnique.mockResolvedValue({
      id: 'letter-9',
      uniqueNumber: 'LL-2026-00009',
      applicationNumber: 'APP-9',
      studentName: 'Student Nine',
    });
    auditService.log.mockResolvedValue({ id: 'audit-1' });
    const getByIdSpy = jest.spyOn(service, 'getById').mockResolvedValue({ id: 'letter-9', refreshed: true });

    const result = await service.recordReprint({
      id: 'letter-9',
      actorId: 'user-9',
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(auditService.log).toHaveBeenCalledWith({
      actorId: 'user-9',
      action: 'Loan letter reprinted',
      actionType: AuditActionType.DOWNLOAD,
      module: AuditModule.FINANCE,
      category: 'loan-letter',
      severity: AuditSeverity.INFO,
      targetTable: 'loan_letter',
      targetId: 'letter-9',
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
      details: {
        uniqueNumber: 'LL-2026-00009',
        applicationNumber: 'APP-9',
        studentName: 'Student Nine',
      },
    });
    expect(getByIdSpy).toHaveBeenCalledWith('letter-9');
    expect(result).toEqual({ id: 'letter-9', refreshed: true });
  });

  test('create() maps database uniqueness collisions to a friendly conflict response', async () => {
    prisma.loanLetter.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing-letter' });
    prisma.program.findUnique.mockResolvedValue({
      id: 'prog-1',
      programCode: 'BTECH',
      programName: 'B.Tech',
    });
    prisma.$queryRaw.mockResolvedValue([{ last_value: 1 }]);
    prisma.loanLetter.create.mockRejectedValue({
      code: 'P2002',
      meta: { target: ['application_number'] },
    });
    const getByIdSpy = jest.spyOn(service, 'getById').mockResolvedValue({ id: 'existing-letter' });

    await expect(service.create({
      applicationNumber: 'APP-1',
      studentEmail: 'student@example.com',
      studentName: 'Student One',
      relationPrefix: 'S/O',
      relationName: 'Parent',
      programId: 'prog-1',
      specializationId: null,
      selectedSemesters: [1, 2],
      transportIncluded: false,
      hostelIncluded: false,
      printedById: 'user-1',
    })).rejects.toMatchObject({
      status: 409,
      code: 'APPLICATION_NUMBER_EXISTS',
      data: { id: 'existing-letter' },
    });

    expect(getByIdSpy).toHaveBeenCalledWith('existing-letter');
  });

  test('create() allocates loan-letter numbers from the database counter inside the write transaction', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ last_value: 42 }]),
      loanLetter: {
        create: jest.fn().mockResolvedValue({ id: 'letter-42' }),
      },
    };

    prisma.loanLetter.findFirst.mockResolvedValue(null);
    prisma.program.findUnique.mockResolvedValue({
      id: 'prog-1',
      programCode: 'BTECH',
      programName: 'B.Tech',
    });
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    const getByIdSpy = jest.spyOn(service, 'getById').mockResolvedValue({ id: 'letter-42' });

    const result = await service.create({
      applicationNumber: 'APP-42',
      studentEmail: 'student@example.com',
      studentName: 'Student Forty Two',
      relationPrefix: 'S/O',
      relationName: 'Parent',
      programId: 'prog-1',
      specializationId: null,
      selectedSemesters: [1, 2],
      transportIncluded: false,
      hostelIncluded: false,
      printedById: 'user-1',
    });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.loanLetter.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        uniqueNumber: `LL-${new Date().getFullYear()}-00042`,
        applicationNumber: 'APP-42',
      }),
    });
    expect(prisma.loanLetter.count).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'letter-42' });
    expect(getByIdSpy).toHaveBeenCalledWith('letter-42');
  });
});
