/**
 * Unit tests: research budget allocation.
 *   - rules (amounts, children ≤ parent, categories ≤ node, reasons) in budgetMath and the service
 *   - tree sums and utilisation attribution (committed / utilised / pending, unassigned, scope)
 *   - over-budget: warning on recommend / approval, 409 BUDGET_EXCEEDED with enforceLimit
 *   - payee school/department and incentive-cycle snapshot on new payout lines
 *   - permissions (budgetAccess middleware) and tenant scoping
 *   - xlsx export
 * Prisma is mocked; $transaction runs the callback against the same mock client.
 */

const mockPrisma = {};
jest.mock('../../../shared/config/database', () => mockPrisma);
const mockTenant = { id: 'uni-1' };
jest.mock('../../../shared/tenancy/tenantContext', () => ({
  getTenantId: () => mockTenant.id,
  get: () => (mockTenant.id ? { tenantId: mockTenant.id } : undefined),
}));
const mockDrd = { _resolveAccess: jest.fn() };
jest.mock('../../../modules/drd-analytics/services/drdAnalytics.service', () => mockDrd);

const ExcelJS = require('exceljs');
const M = require('../../../modules/finance/services/budgetMath');
const budgets = require('../../../modules/finance/services/budget.service');
const guard = require('../../../modules/finance/services/budgetGuard');
const payout = require('../../../modules/finance/services/incentivePayout.service');
const { budgetViewAccess, requireBudgetEdit } = require('../../../modules/finance/middleware/budgetAccess');

const FY = 'cccccccc-0000-4000-8000-000000002627'; // the incentive cycle the budget belongs to
const CYCLE = { id: FY, universityId: 'uni-1', name: 'FY 2026-27', startDate: new Date('2026-04-01T00:00:00Z'), endDate: new Date('2027-03-31T00:00:00Z') };
const inCycle = (where = {}) => {
  if (where.id) return where.id === CYCLE.id;
  const lte = where.startDate?.lte; const gte = where.endDate?.gte;
  if (lte && gte) return CYCLE.startDate <= lte && CYCLE.endDate >= gte;
  return true;
};
const UNI = { id: 'uni-1', name: 'Test University', code: 'TU' };
const SCH = { A: '11111111-1111-4111-8111-111111111111', B: '22222222-2222-4222-8222-222222222222' };
const DEP = { A1: 'aaaaaaa1-0000-4000-8000-000000000001', A2: 'aaaaaaa2-0000-4000-8000-000000000002', B1: 'bbbbbbb1-0000-4000-8000-000000000001' };
const SCHOOLS = [
  { id: SCH.A, facultyName: 'School A', facultyCode: 'SA', isActive: true },
  { id: SCH.B, facultyName: '=HYPERLINK("x")', facultyCode: 'SB', isActive: true },
];
const DEPTS = [
  { id: DEP.A1, departmentName: 'Dept A1', departmentCode: 'A1', facultyId: SCH.A, isActive: true },
  { id: DEP.A2, departmentName: 'Dept A2', departmentCode: 'A2', facultyId: SCH.A, isActive: true },
  { id: DEP.B1, departmentName: 'Dept B1', departmentCode: 'B1', facultyId: SCH.B, isActive: true },
];

function resetPrisma() {
  for (const k of Object.keys(mockPrisma)) delete mockPrisma[k];
  Object.assign(mockPrisma, {
    $transaction: jest.fn(async (cb) => cb(mockPrisma)),
    incentiveCycle: {
      findFirst: jest.fn(async ({ where } = {}) => (inCycle(where) ? CYCLE : null)),
      findMany: jest.fn().mockResolvedValue([CYCLE]),
      count: jest.fn().mockResolvedValue(1),
    },
    university: { findFirst: jest.fn().mockResolvedValue(UNI) },
    facultySchoolList: {
      findMany: jest.fn().mockResolvedValue(SCHOOLS),
      findFirst: jest.fn(async ({ where }) => SCHOOLS.find((s) => s.id === where.id) || null),
    },
    department: {
      findMany: jest.fn(async ({ where } = {}) => DEPTS.filter((d) => (!where?.facultyId || d.facultyId === where.facultyId)
        && (!where?.NOT || d.id !== where.NOT.id) && (!where?.id?.in || where.id.in.includes(d.id)))),
      findFirst: jest.fn(async ({ where }) => {
        const d = DEPTS.find((x) => x.id === where.id);
        return d ? { ...d, faculty: { facultyName: SCHOOLS.find((s) => s.id === d.facultyId).facultyName } } : null;
      }),
    },
    researchBudget: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(async ({ data }) => ({ id: 'bud-1', warnThresholdPct: 80, enforceLimit: false, ...data })),
      update: jest.fn(async ({ where, data }) => ({ id: where.id, ...data })),
    },
    budgetAllocation: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(async ({ data }) => ({ id: 'alloc-new', ...data })),
      update: jest.fn(async ({ where, data }) => ({ id: where.id, ...data })),
    },
    budgetAllocationEvent: { create: jest.fn(async ({ data }) => data), findMany: jest.fn().mockResolvedValue([]) },
    incentivePayout: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn(async ({ where, data }) => ({ id: where.id, ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn(async ({ data }) => ({ count: data.length })),
    },
    incentivePayoutEvent: { create: jest.fn(async ({ data }) => data) },
    payoutBatch: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn(async ({ where, data }) => ({ id: where.id, totalAmount: 0, ...data })),
    },
    grantFundReceipt: { findMany: jest.fn().mockResolvedValue([]) },
    employeeDetails: { findMany: jest.fn().mockResolvedValue([]) },
    userLogin: { findMany: jest.fn().mockResolvedValue([]) },
    studentDetails: { findMany: jest.fn().mockResolvedValue([]) },
  });
}

const budgetRow = (over = {}) => ({
  id: 'bud-1', universityId: 'uni-1', cycleId: FY, cycle: { name: CYCLE.name }, totalAmount: 1000000, categoryAllocations: {},
  notes: null, enforceLimit: false, warnThresholdPct: 80, ...over,
});
const allocRow = (nodeType, nodeId, amount, over = {}) => ({
  id: `al-${nodeId.slice(0, 4)}`, cycleId: FY, nodeType, nodeId, amount, categoryAllocations: {}, ...over,
});
const agg = (schoolId, departmentId, status, amount, workType = 'research_paper', sourceType = 'research_contribution') => ({
  schoolId, departmentId, status, workType, sourceType, _sum: { approvedAmount: amount }, _count: 1,
});
const actor = { id: 'fin-approver' };

beforeEach(() => {
  resetPrisma();
  mockTenant.id = 'uni-1';
  mockDrd._resolveAccess.mockReset();
});

// ─── budgetMath rules ───────────────────────────────────────────────────────

describe('budgetMath validation', () => {
  test('amounts must be finite and ≥ 0', () => {
    expect(M.parseAmount('1500.456')).toBe(1500.46);
    expect(M.parseAmount(0)).toBe(0);
    expect(() => M.parseAmount(-1)).toThrow(expect.objectContaining({ statusCode: 400, code: 'INVALID_AMOUNT' }));
    expect(() => M.parseAmount('abc')).toThrow(/must be a number/);
    expect(() => M.parseAmount('')).toThrow(/required/);
    expect(() => M.parseAmount(1e14)).toThrow(/too large/);
  });

  test('category split: known keys only, ≥ 0, zeros dropped, must fit the node', () => {
    expect(M.parseCategories({ book: 100, ipr: 0, grant: '' })).toEqual({ book: 100 });
    expect(() => M.parseCategories({ patent: 5 })).toThrow(expect.objectContaining({ code: 'INVALID_CATEGORIES' }));
    expect(() => M.parseCategories({ book: -5 })).toThrow(expect.objectContaining({ code: 'INVALID_AMOUNT' }));
    expect(() => M.parseCategories([1])).toThrow(expect.objectContaining({ code: 'INVALID_CATEGORIES' }));
    expect(() => M.assertCategoriesFit({ book: 60, ipr: 50 }, 100, 'X')).toThrow(expect.objectContaining({ code: 'CATEGORIES_EXCEED_NODE' }));
    expect(() => M.assertCategoriesFit({ book: 60, ipr: 40 }, 100, 'X')).not.toThrow();
  });

  test('children may not exceed the parent; the message says how much is left', () => {
    expect(() => M.assertFitsParent({ amount: 400, siblingsTotal: 700, parentAmount: 1000, label: 'S', parentLabel: 'U', childNoun: 'schools' }))
      .toThrow(expect.objectContaining({ code: 'EXCEEDS_PARENT', details: expect.objectContaining({ maxAllowed: 300 }) }));
    expect(() => M.assertFitsParent({ amount: 300, siblingsTotal: 700, parentAmount: 1000, label: 'S', parentLabel: 'U', childNoun: 'schools' })).not.toThrow();
    // paise arithmetic: 0.1 + 0.2 is exactly 0.3
    expect(() => M.assertFitsParent({ amount: 0.2, siblingsTotal: 0.1, parentAmount: 0.3, label: 'S', parentLabel: 'U', childNoun: 'x' })).not.toThrow();
  });

  test('a parent may not drop below its children', () => {
    expect(() => M.assertCoversChildren({ amount: 99, childrenTotal: 100, label: 'S', childNoun: 'departments' }))
      .toThrow(expect.objectContaining({ code: 'BELOW_CHILDREN' }));
  });

  test('financial year format', () => {
    expect(M.isValidFinancialYear('2026-27')).toBe(true);
    expect(M.isValidFinancialYear('2099-00')).toBe(true);
    expect(M.isValidFinancialYear('2026-28')).toBe(false);
    expect(M.isValidFinancialYear('26-27')).toBe(false);
  });

  test('status: healthy / warning at the threshold / over / unallocated', () => {
    expect(M.nodeStatus(1000, 799)).toBe('healthy');
    expect(M.nodeStatus(1000, 800)).toBe('warning');
    expect(M.nodeStatus(1000, 900, 95)).toBe('healthy');
    expect(M.nodeStatus(1000, 1000.01)).toBe('over');
    expect(M.nodeStatus(0, 0)).toBe('unallocated');
    expect(M.nodeStatus(0, 1)).toBe('over');
  });

  test('payout lines map to budget categories (IPR sub-types roll up)', () => {
    expect(M.categoryOf({ sourceType: 'ipr', workType: 'patent' })).toBe('ipr');
    expect(M.categoryOf({ sourceType: 'research_contribution', workType: 'copyright' })).toBe('ipr');
    expect(M.categoryOf({ sourceType: 'grant', workType: 'grant' })).toBe('grant');
    expect(M.categoryOf({ sourceType: 'research_contribution', workType: 'book_chapter' })).toBe('book_chapter');
    expect(M.categoryOf({ sourceType: 'research_contribution', workType: 'poster' })).toBe('other');
  });

  test('burn rate: average over elapsed months, projected to the end of the cycle', () => {
    const monthly = [{ utilised: 1200 }, { utilised: 0 }, { utilised: 600 }];
    const r = M.burnRate(CYCLE, monthly, 10000, new Date('2026-06-15T00:00:00Z'));
    expect(r).toEqual({ monthsElapsed: 3, totalMonths: 12, avgMonthly: 600, projectedCycleEnd: 7200, projectedPct: 72 });
    expect(M.burnRate('2030-31', monthly, 100, new Date('2026-06-15T00:00:00Z')).monthsElapsed).toBe(0);
    // A custom 18-month cycle projects over 18 months.
    const long = { startDate: new Date('2026-01-01T00:00:00Z'), endDate: new Date('2027-06-30T00:00:00Z') };
    expect(M.monthsOfRange(long.startDate, long.endDate)).toHaveLength(18);
    expect(M.burnRate(long, [{ utilised: 600 }], 0, new Date('2026-01-20T00:00:00Z'))).toMatchObject({ monthsElapsed: 1, totalMonths: 18, projectedCycleEnd: 10800, projectedPct: null });
  });
});

// ─── Tree sums and utilisation attribution ──────────────────────────────────

describe('buildTree()', () => {
  const aggregates = [
    { schoolId: SCH.A, departmentId: DEP.A1, status: 'paid', workType: 'research_paper', sourceType: 'research_contribution', amount: 300, count: 1 },
    { schoolId: SCH.A, departmentId: DEP.A1, status: 'recommended', workType: 'book', sourceType: 'research_contribution', amount: 100, count: 1 },
    { schoolId: SCH.A, departmentId: DEP.A2, status: 'on_hold', workType: 'patent', sourceType: 'ipr', amount: 50, count: 1 },
    { schoolId: SCH.A, departmentId: DEP.A2, status: 'approved', workType: 'grant', sourceType: 'grant', amount: 25, count: 1 },
    { schoolId: SCH.A, departmentId: null, status: 'paid', workType: 'book', sourceType: 'research_contribution', amount: 10, count: 1 },
    { schoolId: SCH.B, departmentId: DEP.B1, status: 'pending_verification', workType: 'book', sourceType: 'research_contribution', amount: 999, count: 1 },
    { schoolId: null, departmentId: null, status: 'paid', workType: 'book', sourceType: 'research_contribution', amount: 70, count: 1 },
  ];
  const allocations = [
    allocRow('school', SCH.A, 600, { categoryAllocations: { research_paper: 200 } }),
    allocRow('department', DEP.A1, 350),
    allocRow('department', DEP.A2, 100),
    allocRow('school', SCH.B, 200),
  ];
  const build = (scope) => M.buildTree({
    university: UNI, budget: budgetRow({ totalAmount: 1000 }), schools: SCHOOLS, departments: DEPTS, allocations, aggregates,
    receipts: [{ schoolId: SCH.A, departmentId: DEP.A1, amount: 5000 }, { schoolId: null, departmentId: null, amount: 1 }], scope,
  });

  test('committed / utilised / pending / available per node, with rollups', () => {
    const t = build({ all: true });
    expect(t).toMatchObject({ allocated: 1000, committed: 175, utilised: 380, pending: 999, consumed: 555, available: 445, childrenAllocated: 800, unallocated: 200 });
    const a = t.children.find((c) => c.id === SCH.A);
    expect(a).toMatchObject({ allocated: 600, committed: 175, utilised: 310, available: 115, status: 'warning', childrenAllocated: 450, unallocated: 150 });
    expect(a.withoutDepartment).toMatchObject({ utilised: 10 });
    const a1 = a.children.find((c) => c.id === DEP.A1);
    expect(a1).toMatchObject({ allocated: 350, committed: 100, utilised: 300, available: -50, status: 'over' });
    expect(a1.externalFunding).toEqual({ amount: 5000, count: 1 });
    const a2 = a.children.find((c) => c.id === DEP.A2);
    expect(a2).toMatchObject({ committed: 75, utilised: 0, utilisationPct: 75, status: 'healthy' });
    const b = t.children.find((c) => c.id === SCH.B);
    expect(b).toMatchObject({ pending: 999, consumed: 0, status: 'healthy' });
  });

  test('lines without a school sit under "Unassigned" and count only at university level', () => {
    const t = build({ all: true });
    const un = t.children.find((c) => c.nodeType === 'unassigned');
    expect(un).toMatchObject({ utilised: 70, status: 'unattributed', externalFunding: { amount: 1, count: 1 } });
    expect(t.children.filter((c) => c.nodeType === 'school').reduce((s, c) => s + c.utilised, 0)).toBe(310);
  });

  test('categories: allocation split and spend per category', () => {
    const a = build({ all: true }).children.find((c) => c.id === SCH.A);
    const byKey = Object.fromEntries(a.categories.map((c) => [c.category, c]));
    expect(byKey.research_paper).toMatchObject({ allocated: 200, utilised: 300 });
    expect(byKey.ipr).toMatchObject({ committed: 50 });
    expect(byKey.grant).toMatchObject({ committed: 25 });
  });

  test('a read-only scope sees only its schools; root sums those schools, no unassigned', () => {
    const t = build({ all: false, schoolIds: [SCH.B] });
    expect(t.children.map((c) => c.id)).toEqual([SCH.B]);
    expect(t).toMatchObject({ allocated: 200, utilised: 0, pending: 999, scoped: true });
    expect(t.externalFunding.amount).toBe(0);
  });

  test('without a budget all statuses are neutral', () => {
    const t = M.buildTree({ university: UNI, budget: null, schools: SCHOOLS, departments: DEPTS, allocations: [], aggregates });
    expect(M.flattenTree(t).filter((n) => n.nodeType !== 'unassigned').every((n) => n.status === 'unallocated')).toBe(true);
  });
});

// ─── Service: budget and allocation writes ──────────────────────────────────

describe('upsertBudget()', () => {
  test('creates the budget and logs budget_created', async () => {
    const res = await budgets.upsertBudget(FY, { totalAmount: 500000, notes: ' Demo ', enforceLimit: true, warnThresholdPct: 85 }, actor);
    expect(mockPrisma.researchBudget.create).toHaveBeenCalledWith({ data: expect.objectContaining({ totalAmount: 500000, notes: 'Demo', enforceLimit: true, warnThresholdPct: 85, cycleId: FY, createdById: 'fin-approver' }) });
    expect(res).toMatchObject({ totalAmount: 500000, enforceLimit: true });
    expect(mockPrisma.budgetAllocationEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'budget_created', nodeType: 'university', nodeId: 'uni-1', newAmount: 500000 }) });
  });

  test('cannot go below what schools hold; changes need a reason', async () => {
    mockPrisma.researchBudget.findFirst.mockResolvedValue(budgetRow());
    mockPrisma.budgetAllocation.findMany.mockResolvedValue([{ amount: 600000 }, { amount: 300000 }]);
    await expect(budgets.upsertBudget(FY, { totalAmount: 800000, reason: 'cut' }, actor)).rejects.toMatchObject({ statusCode: 400, code: 'BELOW_CHILDREN' });
    await expect(budgets.upsertBudget(FY, { totalAmount: 950000 }, actor)).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
    await budgets.upsertBudget(FY, { totalAmount: 950000, reason: 'Revised estimate' }, actor);
    expect(mockPrisma.budgetAllocationEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'budget_updated', oldAmount: 1000000, newAmount: 950000, reason: 'Revised estimate' }) });
  });

  test('invalid threshold, financial year and missing tenant are 400s', async () => {
    await expect(budgets.upsertBudget(FY, { totalAmount: 1, warnThresholdPct: 120 }, actor)).rejects.toMatchObject({ code: 'INVALID_THRESHOLD' });
    await expect(budgets.upsertBudget('2026-28', { totalAmount: 1 }, actor)).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_CYCLE' });
    await expect(budgets.upsertBudget('99999999-9999-4999-8999-999999999999', { totalAmount: 1 }, actor)).rejects.toMatchObject({ statusCode: 404 });
    mockTenant.id = null;
    await expect(budgets.upsertBudget(FY, { totalAmount: 1 }, actor)).rejects.toMatchObject({ code: 'TENANT_REQUIRED' });
  });
});

describe('upsertAllocation()', () => {
  beforeEach(() => mockPrisma.researchBudget.findFirst.mockResolvedValue(budgetRow()));

  test('needs a budget first', async () => {
    mockPrisma.researchBudget.findFirst.mockResolvedValue(null);
    await expect(budgets.upsertAllocation(FY, { nodeType: 'school', nodeId: SCH.A, amount: 1 }, actor)).rejects.toMatchObject({ code: 'NO_BUDGET' });
  });

  test('rejects bad node types / ids and unknown nodes', async () => {
    await expect(budgets.upsertAllocation(FY, { nodeType: 'university', nodeId: SCH.A, amount: 1 }, actor)).rejects.toMatchObject({ code: 'INVALID_NODE' });
    await expect(budgets.upsertAllocation(FY, { nodeType: 'school', nodeId: 'nope', amount: 1 }, actor)).rejects.toMatchObject({ code: 'INVALID_NODE' });
    await expect(budgets.upsertAllocation(FY, { nodeType: 'school', nodeId: '99999999-9999-4999-8999-999999999999', amount: 1 }, actor)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('schools together may not exceed the university total', async () => {
    mockPrisma.budgetAllocation.findMany.mockImplementation(async ({ where }) => (where.nodeType === 'school' ? [{ amount: 700000 }] : []));
    await expect(budgets.upsertAllocation(FY, { nodeType: 'school', nodeId: SCH.A, amount: 400000 }, actor))
      .rejects.toMatchObject({ statusCode: 400, code: 'EXCEEDS_PARENT', details: expect.objectContaining({ maxAllowed: 300000 }) });
  });

  test('a school cannot drop below its departments', async () => {
    mockPrisma.budgetAllocation.findMany.mockImplementation(async ({ where }) => (where.nodeType === 'department' ? [{ amount: 200000 }, { amount: 100000 }] : []));
    await expect(budgets.upsertAllocation(FY, { nodeType: 'school', nodeId: SCH.A, amount: 250000 }, actor)).rejects.toMatchObject({ code: 'BELOW_CHILDREN' });
  });

  test('departments need their school allocated and must fit within it', async () => {
    await expect(budgets.upsertAllocation(FY, { nodeType: 'department', nodeId: DEP.A1, amount: 1 }, actor)).rejects.toMatchObject({ code: 'PARENT_NOT_ALLOCATED' });
    mockPrisma.budgetAllocation.findFirst.mockImplementation(async ({ where }) => (where.nodeType === 'school' ? allocRow('school', SCH.A, 500000) : null));
    mockPrisma.budgetAllocation.findMany.mockResolvedValue([{ amount: 300000 }]); // sibling A2
    await expect(budgets.upsertAllocation(FY, { nodeType: 'department', nodeId: DEP.A1, amount: 250000 }, actor)).rejects.toMatchObject({ code: 'EXCEEDS_PARENT' });
    const saved = await budgets.upsertAllocation(FY, { nodeType: 'department', nodeId: DEP.A1, amount: 200000, categoryAllocations: { book: 50000 } }, actor);
    expect(mockPrisma.budgetAllocation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ nodeType: 'department', nodeId: DEP.A1, departmentId: DEP.A1, schoolId: null, amount: 200000, categoryAllocations: { book: 50000 }, budgetId: 'bud-1' }),
    });
    expect(saved).toMatchObject({ amount: 200000 });
    expect(mockPrisma.budgetAllocationEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'allocation_created', nodeName: 'Dept A1', oldAmount: null, newAmount: 200000, actorId: 'fin-approver' }) });
  });

  test('categories may not exceed the node', async () => {
    await expect(budgets.upsertAllocation(FY, { nodeType: 'school', nodeId: SCH.A, amount: 100, categoryAllocations: { book: 80, ipr: 30 } }, actor))
      .rejects.toMatchObject({ code: 'CATEGORIES_EXCEED_NODE' });
  });

  test('changing an existing allocation needs a reason and records old → new; no-op writes nothing', async () => {
    mockPrisma.budgetAllocation.findFirst.mockResolvedValue(allocRow('school', SCH.A, 300000));
    await expect(budgets.upsertAllocation(FY, { nodeType: 'school', nodeId: SCH.A, amount: 350000 }, actor)).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
    const same = await budgets.upsertAllocation(FY, { nodeType: 'school', nodeId: SCH.A, amount: 300000 }, actor);
    expect(same.unchanged).toBe(true);
    expect(mockPrisma.budgetAllocationEvent.create).not.toHaveBeenCalled();
    await budgets.upsertAllocation(FY, { nodeType: 'school', nodeId: SCH.A, amount: 350000, reason: 'Extra conference funds' }, actor);
    expect(mockPrisma.budgetAllocationEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'allocation_updated', oldAmount: 300000, newAmount: 350000, reason: 'Extra conference funds' }) });
  });

  test('every write locks the budget row first (version bump) to serialise concurrent edits', async () => {
    await budgets.upsertAllocation(FY, { nodeType: 'school', nodeId: SCH.A, amount: 1000 }, actor);
    expect(mockPrisma.researchBudget.update).toHaveBeenCalledWith({ where: { id: 'bud-1' }, data: { version: { increment: 1 } } });
    expect(mockPrisma.researchBudget.update.mock.invocationCallOrder[0]).toBeLessThan(mockPrisma.budgetAllocation.create.mock.invocationCallOrder[0]);
  });
});

// ─── Tenant scoping ─────────────────────────────────────────────────────────

describe('tenant scoping', () => {
  const { scopeArgs } = require('../../../shared/tenancy/tenantExtension');

  test('budget models are tenant-owned: reads filtered, creates stamped, cross-tenant writes refused', () => {
    for (const model of ['IncentiveCycle', 'ResearchBudget', 'BudgetAllocation', 'BudgetAllocationEvent']) {
      expect(scopeArgs(model, 'findMany', { where: { cycleId: FY } }, 'uni-1').where.AND).toEqual([{ universityId: 'uni-1' }]);
    }
    expect(scopeArgs('BudgetAllocation', 'create', { data: { nodeId: 'x' } }, 'uni-1').data.universityId).toBe('uni-1');
    expect(() => scopeArgs('BudgetAllocation', 'create', { data: { universityId: 'other' } }, 'uni-1')).toThrow(/Cross-tenant/);
  });

  test('the service never filters by university itself (the extension does) and uses no raw SQL', async () => {
    mockPrisma.$queryRaw = jest.fn();
    mockPrisma.$queryRawUnsafe = jest.fn();
    await budgets.getTree(FY);
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(JSON.stringify(mockPrisma.budgetAllocation.findMany.mock.calls)).not.toMatch(/universityId/);
  });
});

// ─── Over-budget guard and payout integration ───────────────────────────────

describe('over-budget behaviour', () => {
  const lines = [
    { id: 'l1', universityId: 'uni-1', status: 'pending_verification', batchId: null, approvedAmount: 400, cycleId: FY, schoolId: SCH.A, departmentId: DEP.A1 },
  ];
  function overBudget({ enforceLimit = false } = {}) {
    mockPrisma.researchBudget.findMany.mockResolvedValue([budgetRow({ totalAmount: 10000, enforceLimit })]);
    mockPrisma.budgetAllocation.findMany.mockResolvedValue([
      { ...allocRow('school', SCH.A, 5000), school: { facultyName: 'School A' } },
      { ...allocRow('department', DEP.A1, 300), department: { departmentName: 'Dept A1' } },
    ]);
    mockPrisma.incentivePayout.groupBy.mockResolvedValue([agg(SCH.A, DEP.A1, null, 400)]);
  }

  test('assessLines reports only nodes over their allocation', async () => {
    overBudget();
    const { warnings } = await guard.assessLines(mockPrisma, lines);
    expect(warnings).toEqual([expect.objectContaining({ nodeType: 'department', nodeId: DEP.A1, nodeName: 'Dept A1', allocated: 300, consumed: 400, over: 100 })]);
    expect(mockPrisma.incentivePayout.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { cycleId: FY, status: { in: ['recommended', 'on_hold', 'approved', 'paid'] } },
    }));
  });

  test('no budget for the year → no check at all', async () => {
    const { warnings } = await guard.assessLines(mockPrisma, lines);
    expect(warnings).toEqual([]);
    expect(mockPrisma.incentivePayout.groupBy).not.toHaveBeenCalled();
  });

  test('recommend warns (never blocks) and logs the warning, even with enforceLimit on', async () => {
    overBudget({ enforceLimit: true });
    mockPrisma.incentivePayout.findMany.mockResolvedValue(lines);
    const res = await payout.recommend(['l1'], { id: 'rev' });
    expect(res.recommended).toBe(1);
    expect(res.budgetWarnings).toEqual([expect.objectContaining({ nodeName: 'Dept A1', over: 100 })]);
    expect(res.budgetWarnings[0]).not.toHaveProperty('budgetId');
    expect(mockPrisma.budgetAllocationEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'over_budget_warning', nodeId: DEP.A1, actorId: 'rev' }) });
  });

  const batch = (over = {}) => ({
    id: 'b1', universityId: 'uni-1', batchNumber: 'PB-2026-27-0001', status: 'draft', createdById: 'preparer', totalAmount: 400,
    payouts: [{ ...lines[0], status: 'recommended', recommendedById: 'rev' }], ...over,
  });

  test('batch approval: warning when enforceLimit is off', async () => {
    overBudget();
    mockPrisma.payoutBatch.findUnique.mockResolvedValue(batch());
    mockPrisma.incentivePayout.updateMany.mockResolvedValue({ count: 1 });
    const res = await payout.approveBatch('b1', { id: 'approver' });
    expect(res.status).toBe('approved');
    expect(res.budgetWarnings).toHaveLength(1);
  });

  test('batch approval: 409 BUDGET_EXCEEDED when enforceLimit is on, and the block is logged outside the rolled-back transaction', async () => {
    overBudget({ enforceLimit: true });
    mockPrisma.payoutBatch.findUnique.mockResolvedValue(batch());
    mockPrisma.incentivePayout.updateMany.mockResolvedValue({ count: 1 });
    await expect(payout.approveBatch('b1', { id: 'approver' })).rejects.toMatchObject({
      statusCode: 409, code: 'BUDGET_EXCEEDED', details: { budgetWarnings: [expect.objectContaining({ nodeId: DEP.A1 })] },
    });
    expect(mockPrisma.payoutBatch.update).not.toHaveBeenCalled();
    expect(mockPrisma.budgetAllocationEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'over_budget_blocked', actorId: 'approver', details: expect.objectContaining({ batchId: 'b1' }) }) });
  });
});

describe('payee attribution on new payout lines', () => {
  test('employee department (and its school) or primary school; students via their programme', async () => {
    mockPrisma.employeeDetails.findMany.mockResolvedValue([
      { userLoginId: 'uA', empId: 'E1', primarySchoolId: SCH.B, primaryDepartmentId: DEP.A1, primaryDepartment: { facultyId: SCH.A } },
      { userLoginId: 'uB', empId: 'E2', primarySchoolId: SCH.B, primaryDepartmentId: null, primaryDepartment: null },
      { userLoginId: 'uC', empId: 'E3', primarySchoolId: null, primaryDepartmentId: null, primaryDepartment: null },
    ]);
    mockPrisma.userLogin.findMany.mockResolvedValue([{ id: 'uS' }]);
    mockPrisma.studentDetails.findMany.mockResolvedValue([{ userLoginId: 'uS', program: { departmentId: DEP.B1, department: { facultyId: SCH.B } } }]);
    mockPrisma.incentivePayout.findMany.mockResolvedValue([]);
    await payout.createLines(mockPrisma, {
      universityId: 'uni-1', sourceType: 'research_contribution', sourceId: 's1', workType: 'research_paper', title: 'T', approvedAt: new Date('2026-05-01'), actorId: 'drd',
      payees: ['uA', 'uB', 'uC', 'uS'].map((userId) => ({ userId, name: userId, amount: 100, points: 1 })),
    });
    const rows = Object.fromEntries(mockPrisma.incentivePayout.createMany.mock.calls[0][0].data.map((r) => [r.payeeUserId, r]));
    expect(rows.uA).toMatchObject({ schoolId: SCH.A, departmentId: DEP.A1 }); // department's school wins
    expect(rows.uB).toMatchObject({ schoolId: SCH.B, departmentId: null });
    expect(rows.uC).toMatchObject({ schoolId: null, departmentId: null }); // unassigned
    expect(rows.uS).toMatchObject({ schoolId: SCH.B, departmentId: DEP.B1 });
    // No policyDate given: the approval date picks the cycle.
    expect(rows.uA).toMatchObject({ cycleId: FY, policyDate: new Date('2026-05-01T00:00:00Z'), financialYear: '2026-27' });
  });

  test('a line is charged to the cycle of the date that selected its policy, not the approval date', async () => {
    mockPrisma.employeeDetails.findMany.mockResolvedValue([{ userLoginId: 'uA', empId: 'E1', primarySchoolId: SCH.A, primaryDepartmentId: null, primaryDepartment: null }]);
    const base = { universityId: 'uni-1', sourceType: 'research_contribution', sourceId: 's1', workType: 'research_paper', title: 'T', approvedAt: new Date('2026-05-01T10:00:00Z'), actorId: 'drd', payees: [{ userId: 'uA', name: 'A', amount: 100, points: 1 }] };
    await payout.createLines(mockPrisma, { ...base, policyDate: new Date('2026-02-10T00:00:00Z') }); // published in FY 2025-26: no such cycle here
    expect(mockPrisma.incentivePayout.createMany.mock.calls[0][0].data[0]).toMatchObject({ cycleId: null, policyDate: new Date('2026-02-10T00:00:00Z'), financialYear: '2026-27' });

    await payout.createLinesForContribution(mockPrisma, {
      contribution: { id: 'c1', universityId: 'uni-1', publicationType: 'research_paper', title: 'T', publicationDate: new Date('2026-12-01T00:00:00Z') },
      authorShares: [{ userId: 'uA', name: 'A', incentiveShare: 100, pointsShare: 1 }],
      approvedAt: new Date('2027-05-01T00:00:00Z'),
      actorId: 'drd',
    });
    expect(mockPrisma.incentivePayout.createMany.mock.calls[1][0].data[0]).toMatchObject({ cycleId: FY, financialYear: '2027-28' });
  });

  test('payout list filters by school, department or unassigned and rejects junk ids', () => {
    expect(payout.unitFilter('unassigned')).toEqual({ schoolId: null });
    expect(payout.unitFilter(SCH.A, DEP.A1)).toEqual({ schoolId: SCH.A, departmentId: DEP.A1 });
    expect(() => payout.unitFilter('1 OR 1=1')).toThrow(expect.objectContaining({ code: 'INVALID_FILTER' }));
  });
});

// ─── Permissions ────────────────────────────────────────────────────────────

describe('budgetAccess middleware', () => {
  const run = async (mw, user) => {
    const req = { user };
    const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    let nexted = false;
    await mw(req, res, () => { nexted = true; });
    return { req, res, nexted };
  };
  const staff = (perms) => ({ id: 'u1', role: 'staff', centralDeptPermissions: [{ permissions: perms }] });

  test('admins see everything and may edit', async () => {
    const { req, nexted } = await run(budgetViewAccess, { id: 'a', role: 'admin', centralDeptPermissions: [] });
    expect(nexted).toBe(true);
    expect(req.budgetScope).toEqual({ all: true });
    expect(req.budgetCanEdit).toBe(true);
  });

  test('finance_view sees everything read-only; finance_budget_manage may edit; finance_approve alone may not', async () => {
    const viewer = await run(budgetViewAccess, staff({ finance_view: true }));
    expect(viewer.req.budgetScope).toEqual({ all: true });
    expect(viewer.req.budgetCanEdit).toBe(false);
    const blocked = await run(requireBudgetEdit, viewer.req.user);
    expect(blocked.res.statusCode).toBe(403);
    const approver = await run(budgetViewAccess, staff({ finance_approve: true }));
    expect(approver.req.budgetScope).toEqual({ all: true });
    expect(approver.req.budgetCanEdit).toBe(false);
    const planner = await run(budgetViewAccess, staff({ finance_budget_manage: true }));
    expect(planner.req.budgetScope).toEqual({ all: true });
    expect(planner.req.budgetCanEdit).toBe(true);
  });

  test('DRD applicant-analytics holders get their schools read-only (department scope adds its school)', async () => {
    mockDrd._resolveAccess.mockResolvedValue({ allowedSchoolIds: [SCH.A], explicitDepartmentIds: [DEP.B1] });
    mockPrisma.department.findMany.mockResolvedValue([{ facultyId: SCH.B }]);
    const { req, nexted } = await run(budgetViewAccess, staff({ research_applicant_analytics: true }));
    expect(nexted).toBe(true);
    expect(req.budgetScope).toEqual({ all: false, schoolIds: [SCH.A, SCH.B] });
    expect(req.budgetCanEdit).toBe(false);
  });

  test('no finance or analytics permission → 403', async () => {
    const err = Object.assign(new Error('no'), { statusCode: 403 });
    mockDrd._resolveAccess.mockRejectedValue(err);
    const { res, nexted } = await run(budgetViewAccess, staff({ research_file_new: true }));
    expect(nexted).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  test('scoped viewers cannot open other schools or unassigned lines', async () => {
    const scope = { all: false, schoolIds: [SCH.A] };
    mockPrisma.researchBudget.findFirst.mockResolvedValue(budgetRow());
    await expect(budgets.nodeDetail(FY, 'school', SCH.B, scope)).rejects.toMatchObject({ statusCode: 403, code: 'OUT_OF_SCOPE' });
    await expect(budgets.nodeDetail(FY, 'unassigned', 'unassigned', scope)).rejects.toMatchObject({ statusCode: 403 });
    await expect(budgets.history(FY, {}, scope)).rejects.toMatchObject({ statusCode: 403 });
    const tree = await budgets.getTree(FY, { scope, canEdit: true });
    expect(tree.access).toEqual({ canEdit: false, scoped: true });
    expect(tree.budget.notes).toBeNull();
  });
});

// ─── Export ─────────────────────────────────────────────────────────────────

describe('exportXlsx()', () => {
  test('one row per node with utilisation; formula-like names are neutralised', async () => {
    mockPrisma.researchBudget.findFirst.mockResolvedValue(budgetRow({ notes: '=cmd()' }));
    mockPrisma.budgetAllocation.findMany.mockResolvedValue([allocRow('school', SCH.A, 600000), allocRow('school', SCH.B, 100)]);
    mockPrisma.incentivePayout.groupBy.mockResolvedValue([
      { schoolId: SCH.A, departmentId: DEP.A1, status: 'paid', workType: 'book', sourceType: 'research_contribution', _sum: { approvedAmount: 1234.5 }, _count: 2 },
    ]);
    const { filename, buffer } = await budgets.exportXlsx(FY);
    expect(filename).toBe('research-budget-fy-2026-27.xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.getWorksheet(`Budget ${CYCLE.name}`);
    const rows = [];
    ws.eachRow((r) => rows.push(r.values.slice(1)));
    expect(rows[0]).toEqual(expect.arrayContaining(['Allocated (₹)', 'Committed (₹)', 'Utilised / paid (₹)', 'Available (₹)', 'External funding received (₹)']));
    const a1 = rows.find((r) => r[2] === 'Dept A1');
    expect(a1).toEqual(expect.arrayContaining(['Department', 'School A', 1234.5]));
    expect(rows.some((r) => r[1] === '\'=HYPERLINK("x")')).toBe(true);
    expect(wb.getWorksheet('Notes').getRow(1).getCell(1).value).toBe('\'=cmd()');
    expect(wb.getWorksheet('By category')).toBeTruthy();
    expect(wb.getWorksheet('Monthly burn').rowCount).toBe(13);
  });
});
