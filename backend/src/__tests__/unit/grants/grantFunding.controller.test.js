/**
 * Grant sanction + fund receipts: input validation, status/permission gates, FY computation.
 */
const mockPrisma = {
  grantApplication: { findUnique: jest.fn(), update: jest.fn() },
  grantFundReceipt: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), delete: jest.fn() },
  grantApplicationStatusHistory: { create: jest.fn().mockResolvedValue({}) },
};
mockPrisma.$transaction = jest.fn(async (fn) => fn(mockPrisma));

jest.mock('../../../shared/config/database', () => mockPrisma);
jest.mock('../../../modules/audit/services/audit.service', () => ({
  auditService: { log: jest.fn().mockResolvedValue(null) },
  AuditActionType: { CREATE: 'CREATE', UPDATE: 'UPDATE', DELETE: 'DELETE' },
  AuditModule: { RESEARCH: 'research' },
}));

const ctrl = require('../../../modules/grants/controllers/grantFunding.controller');

const NOW = new Date('2026-10-02T06:00:00Z');
const approver = { id: 'u-1', role: 'faculty', centralDeptPermissions: [{ permissions: { grant_approve: true } }] };
const reviewer = { id: 'u-2', role: 'faculty', centralDeptPermissions: [{ permissions: { grant_review: true } }] };
const outsider = { id: 'u-3', role: 'faculty', centralDeptPermissions: [] };
const admin = { id: 'u-4', role: 'admin', centralDeptPermissions: [] };

const grant = (over = {}) => ({
  id: 'g-1', title: 'Grant', status: 'approved', applicationNumber: 'GRT-1', applicantUserId: 'app-1',
  currentReviewerId: null, sanctionedAmount: null, sanctionDate: null, sanctionOrderNumber: null,
  investigators: [], reviews: [], ...over,
});

const mockRes = () => ({
  statusCode: 200,
  body: null,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});

beforeEach(() => jest.clearAllMocks());

describe('validateSanctionInput', () => {
  it('accepts a valid sanction and normalises the amount', () => {
    const out = ctrl.validateSanctionInput({ sanctionedAmount: '12,50,000.5', sanctionDate: '2026-04-01', sanctionOrderNumber: ' DST/123 ' }, NOW);
    expect(out.sanctionedAmount).toBe('1250000.50');
    expect(out.sanctionDate.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(out.sanctionOrderNumber).toBe('DST/123');
  });

  it.each([
    [{ sanctionedAmount: 0, sanctionDate: '2026-01-01' }, 'sanctionedAmount'],
    [{ sanctionedAmount: -5, sanctionDate: '2026-01-01' }, 'sanctionedAmount'],
    [{ sanctionedAmount: '10.123', sanctionDate: '2026-01-01' }, 'sanctionedAmount'],
    [{ sanctionedAmount: 'abc', sanctionDate: '2026-01-01' }, 'sanctionedAmount'],
    [{ sanctionedAmount: 100, sanctionDate: '2026-02-30' }, 'sanctionDate'],
    [{ sanctionedAmount: 100, sanctionDate: '2026-10-03' }, 'sanctionDate'],
    [{ sanctionedAmount: 100 }, 'sanctionDate'],
    [{ sanctionedAmount: 100, sanctionDate: '2026-01-01', sanctionOrderNumber: 'x'.repeat(129) }, 'sanctionOrderNumber'],
  ])('rejects %j', (body, field) => {
    let caught;
    try { ctrl.validateSanctionInput(body, NOW); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(ctrl.FundingValidationError);
    expect(caught.field).toBe(field);
  });
});

describe('validateReceiptInput', () => {
  it('computes the Indian financial year server-side', () => {
    expect(ctrl.validateReceiptInput({ amount: 1000, receivedDate: '2026-03-31' }, NOW).financialYear).toBe('2025-26');
    expect(ctrl.validateReceiptInput({ amount: 1000, receivedDate: '2026-04-01' }, NOW).financialYear).toBe('2026-27');
  });

  it('ignores a client-supplied financialYear', () => {
    expect(ctrl.validateReceiptInput({ amount: 1, receivedDate: '2025-05-01', financialYear: '1999-00' }, NOW).financialYear).toBe('2025-26');
  });

  it('rejects future dates and non-positive amounts', () => {
    expect(() => ctrl.validateReceiptInput({ amount: 1, receivedDate: '2026-12-01' }, NOW)).toThrow('cannot be in the future');
    expect(() => ctrl.validateReceiptInput({ amount: 0, receivedDate: '2026-01-01' }, NOW)).toThrow(ctrl.FundingValidationError);
  });
});

describe('totalsByFinancialYear', () => {
  it('sums per FY, newest first', () => {
    expect(ctrl.totalsByFinancialYear([
      { financialYear: '2025-26', amount: 100.1 },
      { financialYear: '2026-27', amount: 50 },
      { financialYear: '2025-26', amount: 0.2 },
    ])).toEqual([
      { financialYear: '2026-27', total: 50, count: 1 },
      { financialYear: '2025-26', total: 100.3, count: 2 },
    ]);
  });
});

describe('requireFundingManager', () => {
  it.each([
    ['grant approver', approver, true],
    ['admin', admin, true],
    ['reviewer only', reviewer, false],
    ['no permission', outsider, false],
  ])('%s', (_label, user, allowed) => {
    const res = mockRes();
    const next = jest.fn();
    ctrl.requireFundingManager({ user }, res, next);
    expect(next).toHaveBeenCalledTimes(allowed ? 1 : 0);
    if (!allowed) expect(res.statusCode).toBe(403);
  });
});

describe('updateSanction', () => {
  it('rejects grants that are not approved/completed', async () => {
    mockPrisma.grantApplication.findUnique.mockResolvedValue(grant({ status: 'under_review' }));
    const res = mockRes();
    await ctrl.updateSanction({ params: { id: 'g-1' }, body: { sanctionedAmount: 100, sanctionDate: '2025-01-01' }, user: approver }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('GRANT_NOT_APPROVED');
    expect(mockPrisma.grantApplication.update).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid input without touching the database', async () => {
    const res = mockRes();
    await ctrl.updateSanction({ params: { id: 'g-1' }, body: { sanctionedAmount: -1, sanctionDate: '2025-01-01' }, user: approver }, res);
    expect(res.statusCode).toBe(400);
    expect(mockPrisma.grantApplication.findUnique).not.toHaveBeenCalled();
  });

  it('saves and writes a history note', async () => {
    mockPrisma.grantApplication.findUnique.mockResolvedValue(grant());
    mockPrisma.grantApplication.update.mockResolvedValue(grant({ sanctionedAmount: '500000.00', sanctionDate: new Date('2025-01-01'), sanctionOrderNumber: 'A1' }));
    const res = mockRes();
    await ctrl.updateSanction({ params: { id: 'g-1' }, body: { sanctionedAmount: 500000, sanctionDate: '2025-01-01', sanctionOrderNumber: 'A1' }, user: approver }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual({ sanctionedAmount: 500000, sanctionDate: '2025-01-01', sanctionOrderNumber: 'A1' });
    expect(mockPrisma.grantApplicationStatusHistory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ fromStatus: 'approved', toStatus: 'approved', changedById: 'u-1' }),
    }));
  });
});

describe('fund receipts', () => {
  it('404s for a user who cannot view the grant', async () => {
    mockPrisma.grantApplication.findUnique.mockResolvedValue(grant());
    const res = mockRes();
    await ctrl.listFundReceipts({ params: { id: 'g-1' }, user: outsider }, res);
    expect(res.statusCode).toBe(404);
  });

  it('lists receipts with FY totals for the applicant (read-only)', async () => {
    mockPrisma.grantApplication.findUnique.mockResolvedValue(grant({ sanctionedAmount: '1000.00' }));
    mockPrisma.grantFundReceipt.findMany.mockResolvedValue([
      { id: 'r1', amount: '400.00', receivedDate: new Date('2026-05-01'), financialYear: '2026-27', reference: null, notes: null, recordedBy: { uid: 'X', employeeDetails: { displayName: 'DRD Head' } }, createdAt: NOW },
      { id: 'r2', amount: '100.00', receivedDate: new Date('2026-01-01'), financialYear: '2025-26', reference: 'UTR1', notes: null, recordedBy: null, createdAt: NOW },
    ]);
    const res = mockRes();
    await ctrl.listFundReceipts({ params: { id: 'g-1' }, user: { id: 'app-1', role: 'faculty' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.totalReceived).toBe(500);
    expect(res.body.data.totalsByFinancialYear.map((t) => t.financialYear)).toEqual(['2026-27', '2025-26']);
    expect(res.body.data.receipts[0].recordedBy).toBe('DRD Head');
    expect(res.body.data.canManage).toBe(false);
    expect(res.body.data.sanction.sanctionedAmount).toBe(1000);
  });

  it('creates a receipt with the server-computed FY', async () => {
    mockPrisma.grantApplication.findUnique.mockResolvedValue(grant({ status: 'completed' }));
    mockPrisma.grantFundReceipt.create.mockImplementation(async ({ data }) => ({ id: 'r9', createdAt: NOW, recordedBy: null, ...data }));
    const res = mockRes();
    await ctrl.addFundReceipt({ params: { id: 'g-1' }, body: { amount: '2500', receivedDate: '2026-04-15', reference: 'UTR9' }, user: approver }, res);
    expect(res.statusCode).toBe(201);
    expect(mockPrisma.grantFundReceipt.create.mock.calls[0][0].data).toEqual(expect.objectContaining({
      grantApplicationId: 'g-1', amount: '2500.00', financialYear: '2026-27', reference: 'UTR9', recordedById: 'u-1',
    }));
    expect(res.body.data.amount).toBe(2500);
  });

  it('rejects a receipt on a grant that is not approved', async () => {
    mockPrisma.grantApplication.findUnique.mockResolvedValue(grant({ status: 'submitted' }));
    const res = mockRes();
    await ctrl.addFundReceipt({ params: { id: 'g-1' }, body: { amount: 1, receivedDate: '2026-04-15' }, user: approver }, res);
    expect(res.statusCode).toBe(400);
    expect(mockPrisma.grantFundReceipt.create).not.toHaveBeenCalled();
  });

  it('deletes only a receipt of the same grant', async () => {
    mockPrisma.grantApplication.findUnique.mockResolvedValue(grant());
    mockPrisma.grantFundReceipt.findFirst.mockResolvedValue(null);
    const res = mockRes();
    await ctrl.deleteFundReceipt({ params: { id: 'g-1', receiptId: 'r-other' }, body: {}, user: admin }, res);
    expect(res.statusCode).toBe(404);
    expect(mockPrisma.grantFundReceipt.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'r-other', grantApplicationId: 'g-1' } }));
    expect(mockPrisma.grantFundReceipt.delete).not.toHaveBeenCalled();
  });

  it('deletes a receipt and records the reason', async () => {
    mockPrisma.grantApplication.findUnique.mockResolvedValue(grant());
    mockPrisma.grantFundReceipt.findFirst.mockResolvedValue({ id: 'r1', amount: '10.00', receivedDate: new Date('2026-05-01'), financialYear: '2026-27', recordedBy: null, createdAt: NOW });
    const res = mockRes();
    await ctrl.deleteFundReceipt({ params: { id: 'g-1', receiptId: 'r1' }, body: { reason: 'duplicate entry' }, user: admin }, res);
    expect(res.statusCode).toBe(200);
    expect(mockPrisma.grantFundReceipt.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
    expect(mockPrisma.grantApplicationStatusHistory.create.mock.calls[0][0].data.comments).toContain('duplicate entry');
  });
});
