/**
 * Unit tests: incentive cycles — the period incentive policies and the research budget share.
 *   - a policy saved while cycles exist must sit inside one cycle (open-ended → closed at cycle end)
 *   - cycles never overlap; dates cannot move so an enabled policy falls outside
 *   - creating a cycle / moving its dates re-links payout lines by their policy date
 * Prisma is mocked; $transaction runs the callback against the same mock client.
 */

const mockPrisma = {};
jest.mock('../../../shared/config/database', () => mockPrisma);
jest.mock('../../../shared/tenancy/tenantContext', () => ({ getTenantId: () => 'uni-1', get: () => ({ tenantId: 'uni-1' }) }));

const { fitWindowToCycle } = require('../../../modules/research/utils/policyCycle');
const { savePolicy } = require('../../../modules/research/utils/policyWindow');
const cycles = require('../../../modules/finance/services/incentiveCycle.service');

const D = (s) => new Date(`${s}T00:00:00.000Z`);
const FY26 = { id: 'cccccccc-0000-4000-8000-000000002627', universityId: 'uni-1', name: 'FY 2026-27', startDate: D('2026-04-01'), endDate: D('2027-03-31') };
const actor = { id: 'fin' };

function cycleDelegate(rows) {
  const covers = (c, where = {}) => {
    if (where.id) return c.id === where.id;
    if (where.NOT?.id && c.id === where.NOT.id) return false;
    if (where.name) return c.name === where.name;
    const lte = where.startDate?.lte; const gte = where.endDate?.gte;
    return (!lte || c.startDate <= lte) && (!gte || c.endDate >= gte);
  };
  return {
    count: jest.fn(async () => rows.length),
    findFirst: jest.fn(async ({ where } = {}) => rows.find((c) => covers(c, where)) || null),
    findMany: jest.fn(async () => rows),
    create: jest.fn(async ({ data }) => ({ id: 'new-cycle', ...data })),
    update: jest.fn(async ({ where, data }) => ({ ...rows.find((c) => c.id === where.id), ...data, budget: null })),
    delete: jest.fn(async () => ({})),
  };
}

const emptyPolicies = () => ({ findMany: jest.fn().mockResolvedValue([]) });

function reset(cycleRows = [FY26]) {
  for (const k of Object.keys(mockPrisma)) delete mockPrisma[k];
  Object.assign(mockPrisma, {
    $transaction: jest.fn(async (cb) => cb(mockPrisma)),
    incentiveCycle: cycleDelegate(cycleRows),
    incentivePayout: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn(async ({ where }) => ({ count: where.id.in.length })), count: jest.fn().mockResolvedValue(0) },
    researchBudget: { findFirst: jest.fn().mockResolvedValue(null) },
    budgetAllocationEvent: { create: jest.fn() },
    researchIncentivePolicy: emptyPolicies(),
    bookIncentivePolicy: { ...emptyPolicies(), create: jest.fn(async ({ data }) => ({ id: 'p1', ...data })) },
    bookChapterIncentivePolicy: emptyPolicies(),
    conferenceIncentivePolicy: emptyPolicies(),
    incentivePolicy: emptyPolicies(),
    grantIncentivePolicy: emptyPolicies(),
  });
}

beforeEach(() => reset());

describe('policy windows fit their cycle', () => {
  test('no cycles: nothing is enforced', async () => {
    expect(await fitWindowToCycle(cycleDelegate([]), D('2020-01-01'), null)).toBeNull();
  });

  test('open-ended policy is closed at the cycle end; a window inside is kept', async () => {
    const d = cycleDelegate([FY26]);
    expect(await fitWindowToCycle(d, D('2026-06-01'), null)).toMatchObject({ cycle: FY26, effectiveTo: D('2027-03-31') });
    expect((await fitWindowToCycle(d, D('2026-06-01'), D('2026-12-31'))).effectiveTo).toEqual(D('2026-12-31'));
  });

  test('start outside every cycle, or end past the cycle, is refused with a clear message', async () => {
    const d = cycleDelegate([FY26]);
    await expect(fitWindowToCycle(d, D('2026-01-01'), null)).rejects.toMatchObject({ statusCode: 400, code: 'POLICY_OUTSIDE_CYCLES' });
    await expect(fitWindowToCycle(d, D('2026-06-01'), D('2027-06-30'))).rejects.toMatchObject({ statusCode: 400, code: 'POLICY_CROSSES_CYCLE', message: expect.stringContaining('2027-03-31') });
  });

  test('savePolicy closes an open-ended new policy at its cycle end', async () => {
    const { policy } = await savePolicy({
      prisma: mockPrisma, model: 'bookIncentivePolicy', data: { policyName: 'Books', effectiveFrom: D('2026-04-01'), effectiveTo: null }, tenantId: 'uni-1', actorId: 'admin',
    });
    expect(policy.effectiveTo).toEqual(D('2027-03-31'));
  });

  test('savePolicy leaves a legacy policy alone when its dates are not being changed', async () => {
    const existing = { id: 'old', isActive: true, policyName: 'Old', effectiveFrom: D('2024-01-01'), effectiveTo: null };
    mockPrisma.bookIncentivePolicy.update = jest.fn(async ({ data }) => ({ ...existing, ...data }));
    const { policy } = await savePolicy({
      prisma: mockPrisma, model: 'bookIncentivePolicy', existing, data: { policyName: 'Renamed', effectiveFrom: D('2024-01-01'), effectiveTo: null }, tenantId: 'uni-1', actorId: 'admin',
    });
    expect(policy).toMatchObject({ policyName: 'Renamed', effectiveTo: null });
  });
});

describe('cycles', () => {
  test('create: validates dates, refuses overlaps and re-links payout lines in range', async () => {
    reset([]);
    await expect(cycles.createCycle({ name: 'X', startDate: '2027-04-01', endDate: '2027-03-01' }, actor)).rejects.toMatchObject({ code: 'INVALID_DATES' });
    await expect(cycles.createCycle({ name: '', startDate: '2027-04-01', endDate: '2028-03-31' }, actor)).rejects.toMatchObject({ code: 'INVALID_NAME' });
    await expect(cycles.createCycle({ name: 'X', startDate: '2027-02-30', endDate: '2028-03-31' }, actor)).rejects.toMatchObject({ code: 'INVALID_DATE' });

    reset([FY26]);
    await expect(cycles.createCycle({ name: 'FY 2027-28', startDate: '2027-03-01', endDate: '2028-03-31' }, actor)).rejects.toMatchObject({ statusCode: 409, code: 'CYCLE_OVERLAP' });

    const next = { id: 'new-cycle', name: 'FY 2027-28', startDate: D('2027-04-01'), endDate: D('2028-03-31') };
    mockPrisma.incentiveCycle.findMany.mockResolvedValue([FY26, next]);
    mockPrisma.incentivePayout.findMany.mockResolvedValue([{ id: 'l1', cycleId: null, policyDate: D('2027-06-01') }]);
    const created = await cycles.createCycle({ name: 'FY 2027-28', startDate: '2027-04-01', endDate: '2028-03-31' }, actor);
    expect(created).toMatchObject({ name: 'FY 2027-28', startDate: '2027-04-01', endDate: '2028-03-31', relinkedPayoutLines: 1 });
    expect(mockPrisma.incentivePayout.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['l1'] } }, data: { cycleId: 'new-cycle' } });
  });

  test('update: dates cannot move so an enabled policy inside the cycle falls outside', async () => {
    mockPrisma.researchIncentivePolicy.findMany.mockResolvedValue([
      { id: 'rp', policyName: 'SCI papers', effectiveFrom: D('2026-04-01'), effectiveTo: D('2027-03-31'), publicationType: 'research_paper', baseIncentiveAmount: 10000 },
    ]);
    await expect(cycles.updateCycle(FY26.id, { endDate: '2027-02-28' }, actor)).rejects.toMatchObject({ statusCode: 409, code: 'CYCLE_POLICIES_OUTSIDE', message: expect.stringContaining('SCI papers') });
    // Renaming only is fine.
    await expect(cycles.updateCycle(FY26.id, { name: 'Year 2026-27' }, actor)).resolves.toMatchObject({ name: 'Year 2026-27', relinkedPayoutLines: 0 });
  });

  test('delete: refused while a budget or payout lines use the cycle', async () => {
    mockPrisma.incentivePayout.count.mockResolvedValue(3);
    await expect(cycles.deleteCycle(FY26.id)).rejects.toMatchObject({ code: 'CYCLE_IN_USE' });
    mockPrisma.incentivePayout.count.mockResolvedValue(0);
    await expect(cycles.deleteCycle(FY26.id)).resolves.toEqual({ id: FY26.id, deleted: true });
  });

  test('policies of a cycle are listed with whether they sit inside it', async () => {
    mockPrisma.incentivePolicy.findMany.mockResolvedValue([
      { id: 'ip', policyName: 'Patent', effectiveFrom: D('2025-01-01'), effectiveTo: null, iprType: 'patent', baseIncentiveAmount: 50000 },
    ]);
    const res = await cycles.cyclePolicies(FY26.id);
    expect(res.items).toEqual([expect.objectContaining({ type: 'ipr', name: 'Patent', key: 'patent', amount: 50000, fitsCycle: false, href: '/admin/incentive-policies' })]);
    expect(res.byType.find((t) => t.type === 'ipr').count).toBe(1);
  });

  test('"current" resolves to the cycle containing today; unknown refs are 400/404', async () => {
    jest.useFakeTimers().setSystemTime(D('2026-10-03'));
    try {
      await expect(cycles.resolveCycle('current')).resolves.toBe(FY26);
    } finally {
      jest.useRealTimers();
    }
    await expect(cycles.resolveCycle('2026-27')).rejects.toMatchObject({ statusCode: 400 });
    await expect(cycles.resolveCycle('99999999-9999-4999-8999-999999999999')).rejects.toMatchObject({ statusCode: 404 });
  });

  test('the suggested next cycle is the April–March year after the latest', () => {
    expect(cycles.financialYearCycle(D('2026-10-03'))).toEqual({ name: 'FY 2026-27', startDate: '2026-04-01', endDate: '2027-03-31' });
  });
});
