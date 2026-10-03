/**
 * Unit tests: incentive payout ledger (state machine, separation of duties, FY bucketing).
 * Prisma is mocked; $transaction runs the callback against the same mock client.
 */

const mockPrisma = {};
jest.mock('../../../shared/config/database', () => mockPrisma);

const payout = require('../../../modules/finance/services/incentivePayout.service');

function resetPrisma() {
  for (const k of Object.keys(mockPrisma)) delete mockPrisma[k];
  Object.assign(mockPrisma, {
    $transaction: jest.fn(async (cb) => cb(mockPrisma)),
    employeeDetails: { findMany: jest.fn().mockResolvedValue([]) },
    userLogin: { findMany: jest.fn().mockResolvedValue([]) },
    incentivePayout: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      createMany: jest.fn(async ({ data }) => ({ count: data.length })),
      update: jest.fn(async ({ where, data }) => ({ id: where.id, approvedAmount: 0, ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    incentivePayoutEvent: { create: jest.fn(async ({ data }) => data) },
    researchBudget: { findMany: jest.fn().mockResolvedValue([]) },
    budgetAllocation: { findMany: jest.fn().mockResolvedValue([]) },
    budgetAllocationEvent: { create: jest.fn(async ({ data }) => data) },
    studentDetails: { findMany: jest.fn().mockResolvedValue([]) },
    financeSettings: { findFirst: jest.fn().mockResolvedValue(null) },
    payoutBatch: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(async ({ data }) => ({ id: 'batch-1', status: 'draft', ...data })),
      update: jest.fn(async ({ where, data }) => ({ id: where.id, totalAmount: 0, ...data })),
    },
  });
}

const actor = (id) => ({ id });
const line = (over = {}) => ({
  id: 'l1', universityId: 'u1', status: 'pending_verification', batchId: null, approvedAmount: 1000,
  payeeName: 'Dr A', recommendedById: null, ...over,
});

beforeEach(resetPrisma);

// ─── financialYearOf ──────────────────────────────────────────────────────────

describe('financialYearOf()', () => {
  test('31 March 23:00 IST belongs to the previous financial year', () => {
    expect(payout.financialYearOf(new Date('2026-03-31T23:00:00+05:30'))).toBe('2025-26');
  });

  test('1 April 00:30 IST starts the new financial year (even though it is still 31 March in UTC)', () => {
    const d = new Date('2026-04-01T00:30:00+05:30');
    expect(d.getUTCMonth()).toBe(2); // still March in UTC
    expect(payout.financialYearOf(d)).toBe('2026-27');
  });

  test('mid-year date and century wrap', () => {
    expect(payout.financialYearOf(new Date('2026-10-02T10:00:00Z'))).toBe('2026-27');
    expect(payout.financialYearOf(new Date('2099-06-01T00:00:00Z'))).toBe('2099-00');
  });
});

// ─── createLines ──────────────────────────────────────────────────────────────

describe('createLinesForContribution() / createLines()', () => {
  const contribution = {
    id: 'c1', universityId: 'u1', publicationType: 'research_paper', title: 'A paper', applicationNumber: 'RP-1', workKey: 'doi:10.1/x',
  };

  test('creates lines only for internal authors with a user account and a non-zero share', async () => {
    mockPrisma.employeeDetails.findMany.mockResolvedValue([{ userLoginId: 'uA', empId: 'EMP-A' }]);
    const res = await payout.createLinesForContribution(mockPrisma, {
      contribution,
      approvedAt: new Date('2026-05-01T00:00:00Z'),
      actorId: 'drd-head',
      authorShares: [
        { userId: 'uA', name: 'Internal A', authorType: 'first_author', isInternal: true, incentiveShare: 700, pointsShare: 7 },
        { userId: 'uB', name: 'External B', isInternal: false, incentiveShare: 300, pointsShare: 3 },
        { userId: 'uC', name: 'Zero C', isInternal: true, incentiveShare: 0, pointsShare: 0 },
        { userId: null, name: 'No account D', isInternal: true, incentiveShare: 200, pointsShare: 2 },
      ],
    });

    expect(res).toEqual({ created: 1, skippedDuplicates: 0 });
    const { data, skipDuplicates } = mockPrisma.incentivePayout.createMany.mock.calls[0][0];
    expect(skipDuplicates).toBe(true);
    expect(data).toEqual([
      expect.objectContaining({
        sourceType: 'research_contribution', sourceId: 'c1', researchContributionId: 'c1', payeeUserId: 'uA',
        payeeEmployeeId: 'EMP-A', calculatedAmount: 700, approvedAmount: 700, points: 7, financialYear: '2026-27',
        workKey: 'doi:10.1/x', referenceNumber: 'RP-1', workType: 'research_paper',
      }),
    ]);
    expect(mockPrisma.incentivePayoutEvent.create).not.toHaveBeenCalled();
  });

  test('skips authors who already have a line for the same work key through another claim', async () => {
    mockPrisma.incentivePayout.findMany.mockResolvedValue([{ payeeUserId: 'uB' }]);
    const res = await payout.createLinesForContribution(mockPrisma, {
      contribution,
      actorId: 'drd-head',
      authorShares: [
        { userId: 'uA', name: 'A', incentiveShare: 500, pointsShare: 5 },
        { userId: 'uB', name: 'B', incentiveShare: 500, pointsShare: 5 },
      ],
    });

    expect(mockPrisma.incentivePayout.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { workKey: 'doi:10.1/x', payeeUserId: { in: ['uA', 'uB'] }, NOT: { sourceId: 'c1' } },
    }));
    expect(res).toEqual({ created: 1, skippedDuplicates: 1 });
    expect(mockPrisma.incentivePayout.createMany.mock.calls[0][0].data.map((r) => r.payeeUserId)).toEqual(['uA']);
    expect(mockPrisma.incentivePayoutEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'duplicate_skipped', actorId: 'drd-head', universityId: 'u1' }),
    });
  });

  test('does nothing when there are no payees', async () => {
    const res = await payout.createLines(mockPrisma, { payees: [] });
    expect(res).toEqual({ created: 0, skippedDuplicates: 0 });
    expect(mockPrisma.incentivePayout.createMany).not.toHaveBeenCalled();
  });

  test('without a work key no cross-claim lookup is made (grants / IPR)', async () => {
    await payout.createLines(mockPrisma, {
      universityId: 'u1', sourceType: 'grant', sourceId: 'g1', workType: 'grant', title: 'G', approvedAt: new Date(), actorId: 'x',
      payees: [{ userId: 'uA', name: 'A', amount: 5000, points: 10 }],
    });
    expect(mockPrisma.incentivePayout.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.incentivePayout.createMany.mock.calls[0][0].data[0]).toEqual(
      expect.objectContaining({ sourceType: 'grant', workKey: null, researchContributionId: null, approvedAmount: 5000 }),
    );
  });
});

// ─── Line actions ─────────────────────────────────────────────────────────────

describe('recommend()', () => {
  test('recommends lines awaiting verification or on hold', async () => {
    mockPrisma.incentivePayout.findMany.mockResolvedValue([line({ id: 'l1' }), line({ id: 'l2', status: 'on_hold' })]);
    await expect(payout.recommend(['l1', 'l2'], actor('rev'))).resolves.toEqual({ recommended: 2, budgetWarnings: [] });
    expect(mockPrisma.incentivePayout.update).toHaveBeenCalledWith({
      where: { id: 'l2' },
      data: expect.objectContaining({ status: 'recommended', recommendedById: 'rev', holdReason: null }),
    });
    expect(mockPrisma.incentivePayoutEvent.create).toHaveBeenCalledTimes(2);
  });

  test.each([['approved', null], ['paid', null], ['cancelled', null], ['recommended', 'b1']])(
    'rejects a line in status %s (batch %s)',
    async (status, batchId) => {
      mockPrisma.incentivePayout.findMany.mockResolvedValue([line({ status, batchId })]);
      await expect(payout.recommend(['l1'], actor('rev'))).rejects.toMatchObject({ code: 'INVALID_STATUS', statusCode: 409 });
      expect(mockPrisma.incentivePayout.update).not.toHaveBeenCalled();
    },
  );

  test('requires at least one id and that all ids exist', async () => {
    await expect(payout.recommend([], actor('rev'))).rejects.toMatchObject({ statusCode: 400 });
    mockPrisma.incentivePayout.findMany.mockResolvedValue([line()]);
    await expect(payout.recommend(['l1', 'missing'], actor('rev'))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('hold()', () => {
  test('requires a reason', async () => {
    await expect(payout.hold('l1', actor('rev'), '  ')).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  test('holds a recommended line and clears the recommendation', async () => {
    mockPrisma.incentivePayout.findUnique.mockResolvedValue(line({ status: 'recommended', recommendedById: 'rev' }));
    await payout.hold('l1', actor('rev2'), 'Need proof of indexing');
    expect(mockPrisma.incentivePayout.update).toHaveBeenCalledWith({
      where: { id: 'l1' },
      data: { status: 'on_hold', holdReason: 'Need proof of indexing', recommendedById: null, recommendedAt: null },
    });
  });

  test.each(['on_hold', 'approved', 'paid', 'cancelled'])('rejects a line in status %s', async (status) => {
    mockPrisma.incentivePayout.findUnique.mockResolvedValue(line({ status }));
    await expect(payout.hold('l1', actor('rev'), 'a reason')).rejects.toMatchObject({ code: 'INVALID_STATUS' });
  });
});

describe('adjust()', () => {
  test('requires a reason and a non-negative amount', async () => {
    await expect(payout.adjust('l1', actor('rev'), 500, '')).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
    await expect(payout.adjust('l1', actor('rev'), -1, 'policy fix')).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
    await expect(payout.adjust('l1', actor('rev'), 'abc', 'policy fix')).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
  });

  test('changes the amount and sends the line back to verification', async () => {
    mockPrisma.incentivePayout.findUnique.mockResolvedValue(line({ status: 'recommended', recommendedById: 'rev' }));
    await payout.adjust('l1', actor('rev2'), 750.555, 'Q2 not Q1');
    expect(mockPrisma.incentivePayout.update).toHaveBeenCalledWith({
      where: { id: 'l1' },
      data: expect.objectContaining({ approvedAmount: 750.56, adjustmentReason: 'Q2 not Q1', status: 'pending_verification', recommendedById: null }),
    });
  });

  test('rejects batched or closed lines', async () => {
    mockPrisma.incentivePayout.findUnique.mockResolvedValue(line({ status: 'recommended', batchId: 'b1' }));
    await expect(payout.adjust('l1', actor('rev'), 10, 'reason')).rejects.toMatchObject({ code: 'INVALID_STATUS' });
    mockPrisma.incentivePayout.findUnique.mockResolvedValue(line({ status: 'paid' }));
    await expect(payout.adjust('l1', actor('rev'), 10, 'reason')).rejects.toMatchObject({ code: 'INVALID_STATUS' });
  });
});

describe('cancel()', () => {
  test('requires a reason', async () => {
    await expect(payout.cancel('l1', actor('rev'), 'no')).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
  });

  test('cancels an open line and frees its work key', async () => {
    mockPrisma.incentivePayout.findUnique.mockResolvedValue(line({ status: 'on_hold' }));
    await payout.cancel('l1', actor('rev'), 'Duplicate claim');
    expect(mockPrisma.incentivePayout.update).toHaveBeenCalledWith({
      where: { id: 'l1' },
      data: { status: 'cancelled', holdReason: 'Duplicate claim', workKey: null },
    });
  });

  test.each(['approved', 'paid', 'cancelled'])('rejects a line in status %s', async (status) => {
    mockPrisma.incentivePayout.findUnique.mockResolvedValue(line({ status }));
    await expect(payout.cancel('l1', actor('rev'), 'some reason')).rejects.toMatchObject({ code: 'INVALID_STATUS' });
  });
});

// ─── Batches ──────────────────────────────────────────────────────────────────

describe('createBatch()', () => {
  test('only recommended, unbatched lines can be batched', async () => {
    mockPrisma.incentivePayout.findMany.mockResolvedValue([line({ status: 'recommended' }), line({ id: 'l2', status: 'pending_verification' })]);
    await expect(payout.createBatch(['l1', 'l2'], actor('prep'))).rejects.toMatchObject({ code: 'INVALID_STATUS' });

    mockPrisma.incentivePayout.findMany.mockResolvedValue([line({ status: 'recommended', batchId: 'other' })]);
    await expect(payout.createBatch(['l1'], actor('prep'))).rejects.toMatchObject({ code: 'INVALID_STATUS' });
    expect(mockPrisma.payoutBatch.create).not.toHaveBeenCalled();
  });

  test('creates a numbered draft batch with the total of its lines', async () => {
    const fy = payout.financialYearOf(new Date());
    mockPrisma.incentivePayout.findMany.mockResolvedValue([
      line({ status: 'recommended', approvedAmount: 1000.1 }),
      line({ id: 'l2', status: 'recommended', approvedAmount: 499.9 }),
    ]);
    mockPrisma.payoutBatch.findFirst.mockResolvedValue({ batchNumber: `PB-${fy}-0007` });
    mockPrisma.incentivePayout.updateMany.mockResolvedValue({ count: 2 });

    const batch = await payout.createBatch(['l1', 'l2'], actor('prep'), { title: 'October' });
    expect(batch).toMatchObject({ batchNumber: `PB-${fy}-0008`, totalAmount: 1500, lineCount: 2, createdById: 'prep', title: 'October' });
    expect(mockPrisma.incentivePayout.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['l1', 'l2'] }, status: 'recommended', batchId: null },
      data: { batchId: 'batch-1' },
    });
  });

  test('fails with CONFLICT when lines changed meanwhile', async () => {
    mockPrisma.incentivePayout.findMany.mockResolvedValue([line({ status: 'recommended' })]);
    mockPrisma.incentivePayout.updateMany.mockResolvedValue({ count: 0 });
    await expect(payout.createBatch(['l1'], actor('prep'))).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('approveBatch() — separation of duties', () => {
  const draftBatch = () => ({
    id: 'b1', universityId: 'u1', status: 'draft', createdById: 'preparer', totalAmount: 2000,
    payouts: [line({ status: 'recommended', recommendedById: 'reviewer1' }), line({ id: 'l2', status: 'recommended', recommendedById: 'reviewer2' })],
  });

  beforeEach(() => {
    mockPrisma.payoutBatch.findUnique.mockResolvedValue(draftBatch());
    mockPrisma.incentivePayout.updateMany.mockResolvedValue({ count: 2 });
  });

  test('rejects the batch creator', async () => {
    await expect(payout.approveBatch('b1', actor('preparer'))).rejects.toMatchObject({ code: 'SEPARATION_OF_DUTIES', statusCode: 403 });
    expect(mockPrisma.incentivePayout.updateMany).not.toHaveBeenCalled();
  });

  test.each(['reviewer1', 'reviewer2'])('rejects %s who recommended a line', async (who) => {
    await expect(payout.approveBatch('b1', actor(who))).rejects.toMatchObject({ code: 'SEPARATION_OF_DUTIES' });
  });

  test('accepts a third person', async () => {
    const res = await payout.approveBatch('b1', actor('approver'), 'OK to pay');
    expect(res).toMatchObject({ status: 'approved', approvedById: 'approver', approvalComments: 'OK to pay' });
    expect(mockPrisma.incentivePayout.updateMany).toHaveBeenCalledWith({ where: { batchId: 'b1', status: 'recommended' }, data: { status: 'approved' } });
  });

  test('a third person approving is never marked self-approved', async () => {
    const res = await payout.approveBatch('b1', actor('approver'));
    expect(res.selfApproved).toBe(false);
    expect(mockPrisma.incentivePayoutEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'batch_approved' }) });
  });

  describe('when the university allows self-approval', () => {
    beforeEach(() => mockPrisma.financeSettings.findFirst.mockResolvedValue({ allowSelfApproval: true }));

    test('the preparer still needs a reason of at least 10 characters', async () => {
      await expect(payout.approveBatch('b1', actor('preparer'))).rejects.toMatchObject({ statusCode: 400, code: 'SELF_APPROVAL_REASON_REQUIRED', message: expect.stringContaining('prepared the batch') });
      await expect(payout.approveBatch('b1', actor('preparer'), null, { selfApprovalReason: 'only me' })).rejects.toMatchObject({ code: 'SELF_APPROVAL_REASON_REQUIRED' });
      expect(mockPrisma.incentivePayout.updateMany).not.toHaveBeenCalled();
    });

    test('with a reason the preparer or a recommender may approve; the batch is marked and the reason logged', async () => {
      const res = await payout.approveBatch('b1', actor('reviewer1'), 'paid via payroll', { selfApprovalReason: 'Sole finance officer this term' });
      expect(res).toMatchObject({ status: 'approved', approvedById: 'reviewer1', selfApproved: true });
      expect(mockPrisma.incentivePayoutEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
        action: 'batch_self_approved',
        comments: expect.stringMatching(/recommended 1 of its line.*Sole finance officer this term.*paid via payroll/),
      }) });
    });
  });

  test('rejects batches that are not draft, or empty', async () => {
    mockPrisma.payoutBatch.findUnique.mockResolvedValue({ ...draftBatch(), status: 'approved' });
    await expect(payout.approveBatch('b1', actor('approver'))).rejects.toMatchObject({ code: 'INVALID_STATUS' });
    mockPrisma.payoutBatch.findUnique.mockResolvedValue({ ...draftBatch(), payouts: [] });
    await expect(payout.approveBatch('b1', actor('approver'))).rejects.toMatchObject({ code: 'EMPTY_BATCH' });
  });
});

describe('markBatchPaid()', () => {
  const approvedBatch = () => ({
    id: 'b1', universityId: 'u1', status: 'approved', totalAmount: 1000,
    payouts: [line({ status: 'approved', approvedAmount: 1000, batchId: 'b1' })],
  });
  const yesterday = () => new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  test('requires a payment reference', async () => {
    await expect(payout.markBatchPaid('b1', actor('fin'), { paymentReference: ' ', paymentDate: yesterday() }))
      .rejects.toMatchObject({ code: 'REFERENCE_REQUIRED' });
  });

  test('requires a valid payment date', async () => {
    await expect(payout.markBatchPaid('b1', actor('fin'), { paymentReference: 'UTR123' })).rejects.toMatchObject({ code: 'DATE_REQUIRED' });
    await expect(payout.markBatchPaid('b1', actor('fin'), { paymentReference: 'UTR123', paymentDate: 'not a date' }))
      .rejects.toMatchObject({ code: 'DATE_REQUIRED' });
  });

  test('rejects a future payment date', async () => {
    const future = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
    await expect(payout.markBatchPaid('b1', actor('fin'), { paymentReference: 'UTR123', paymentDate: future }))
      .rejects.toMatchObject({ code: 'DATE_INVALID' });
  });

  test('rejects TDS greater than the line amount', async () => {
    mockPrisma.payoutBatch.findUnique.mockResolvedValue(approvedBatch());
    await expect(payout.markBatchPaid('b1', actor('fin'), { paymentReference: 'UTR123', paymentDate: yesterday(), tds: { l1: 1000.01 } }))
      .rejects.toMatchObject({ code: 'INVALID_TDS' });
  });

  test('only approved batches can be paid', async () => {
    mockPrisma.payoutBatch.findUnique.mockResolvedValue({ ...approvedBatch(), status: 'draft' });
    await expect(payout.markBatchPaid('b1', actor('fin'), { paymentReference: 'UTR123', paymentDate: yesterday() }))
      .rejects.toMatchObject({ code: 'INVALID_STATUS' });
  });

  test('marks lines and batch paid with reference and TDS', async () => {
    mockPrisma.payoutBatch.findUnique.mockResolvedValue(approvedBatch());
    const res = await payout.markBatchPaid('b1', actor('fin'), { paymentReference: 'PAYROLL-OCT', paymentDate: yesterday(), tds: { l1: 100 } });
    expect(mockPrisma.incentivePayout.update).toHaveBeenCalledWith({
      where: { id: 'l1' },
      data: expect.objectContaining({ status: 'paid', paymentReference: 'PAYROLL-OCT', tdsAmount: 100 }),
    });
    expect(res).toMatchObject({ status: 'paid', paidById: 'fin', paymentReference: 'PAYROLL-OCT' });
  });
});

describe('cancelBatch()', () => {
  test('requires a reason', async () => {
    await expect(payout.cancelBatch('b1', actor('prep'), '')).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
  });

  test('returns lines to recommended (unbatched) and cancels the draft', async () => {
    mockPrisma.payoutBatch.findUnique.mockResolvedValue({ id: 'b1', universityId: 'u1', status: 'draft', payouts: [line({ status: 'recommended', batchId: 'b1' })] });
    const res = await payout.cancelBatch('b1', actor('prep'), 'Wrong month');
    // Only batchId is cleared: status stays "recommended" so the lines can be re-batched.
    expect(mockPrisma.incentivePayout.updateMany).toHaveBeenCalledWith({ where: { batchId: 'b1' }, data: { batchId: null } });
    expect(res).toMatchObject({ status: 'cancelled', cancelledReason: 'Wrong month' });
  });

  test('only draft batches can be cancelled', async () => {
    mockPrisma.payoutBatch.findUnique.mockResolvedValue({ id: 'b1', status: 'approved', payouts: [] });
    await expect(payout.cancelBatch('b1', actor('prep'), 'Wrong month')).rejects.toMatchObject({ code: 'INVALID_STATUS' });
  });
});

describe('listPayouts() status counts', () => {
  beforeEach(() => {
    resetPrisma();
    Object.assign(mockPrisma.incentivePayout, {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _sum: { approvedAmount: null } }),
      groupBy: jest.fn().mockResolvedValue([
        { status: 'pending_verification', _count: 2, _sum: { approvedAmount: 12500.5 } },
        { status: 'paid', _count: 1, _sum: { approvedAmount: 3000 } },
      ]),
    });
  });

  test('returns per-status totals for the same filters, ignoring the status filter', async () => {
    const res = await payout.listPayouts({ status: 'paid', financialYear: '2026-27', search: 'x', withStatusCounts: 'true' });
    expect(res.statusCounts).toEqual({
      pending_verification: { count: 2, amount: 12500.5 },
      paid: { count: 1, amount: 3000 },
    });
    const { where } = mockPrisma.incentivePayout.groupBy.mock.calls[0][0];
    expect(where.financialYear).toBe('2026-27');
    expect(where.OR).toBeDefined();
    expect(where.status).toBeUndefined();
    expect(mockPrisma.incentivePayout.count.mock.calls[0][0].where.status).toEqual({ in: ['paid'] });
  });

  test('no counts unless asked', async () => {
    const res = await payout.listPayouts({});
    expect(res.statusCounts).toBeUndefined();
    expect(mockPrisma.incentivePayout.groupBy).not.toHaveBeenCalled();
  });
});
