/**
 * Research budget allocation: one budget per incentive cycle (the period the incentive policies
 * share, see incentiveCycle.service.js), distributed to schools and then departments, with
 * utilisation read from the payout lines charged to that cycle.
 *
 *   ResearchBudget          total, university-level category split, notes, enforceLimit, warn %
 *   BudgetAllocation        school / department rows (amount + optional category split)
 *   BudgetAllocationEvent   who / when / old → new / reason, plus over-budget warnings and blocks
 *
 * Rules (all 400 with a clear message):
 *   amounts ≥ 0; schools ≤ university total; departments ≤ their school; a parent cannot drop
 *   below what its children hold; a node's category split ≤ the node; changing an existing
 *   amount or split needs a reason.
 *
 * Every query runs inside the request's tenant context (Prisma tenant extension); no raw SQL.
 * `scope` is { all: true } for finance users and admins, or { all: false, schoolIds } for DRD
 * analytics holders, who get a read-only view of their own schools.
 */
const ExcelJS = require('exceljs');
const prisma = require('../../../shared/config/database');
const tenantContext = require('../../../shared/tenancy/tenantContext');
const { neutralizeFormula } = require('../../core/utils/spreadsheet');
const { financialYearOf } = require('./incentivePayout.service');
const cycles = require('./incentiveCycle.service');
const M = require('./budgetMath');

const { BudgetError, round2, paise } = M;
const ALL = { all: true };
const NODE_TYPES = ['school', 'department'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTOR = { select: { id: true, uid: true, employeeDetails: { select: { displayName: true, firstName: true, lastName: true } } } };

const num = (v) => (v == null ? null : Number(v));

function requireTenant() {
  const id = tenantContext.getTenantId();
  if (!id) throw new BudgetError(400, 'Select a university first', 'TENANT_REQUIRED');
  return id;
}

function requireReasonIfChanged(existing, changed, reason) {
  const text = String(reason || '').trim();
  if (existing && changed && text.length < 3) {
    throw new BudgetError(400, 'Give a reason for changing an existing allocation (at least 3 characters)', 'REASON_REQUIRED');
  }
  return text ? text.slice(0, 2000) : null;
}

const sameCategories = (a, b) => {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of keys) if (paise(a?.[k]) !== paise(b?.[k])) return false;
  return true;
};

function serializeBudget(b) {
  if (!b) return null;
  return {
    id: b.id,
    cycleId: b.cycleId,
    totalAmount: num(b.totalAmount),
    categoryAllocations: b.categoryAllocations || {},
    notes: b.notes || null,
    enforceLimit: !!b.enforceLimit,
    warnThresholdPct: b.warnThresholdPct ?? M.DEFAULT_WARN_PCT,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

function serializeEvent(e) {
  return {
    id: e.id,
    cycleId: e.cycleId,
    nodeType: e.nodeType,
    nodeId: e.nodeId,
    nodeName: e.nodeName,
    action: e.action,
    oldAmount: num(e.oldAmount),
    newAmount: num(e.newAmount),
    oldCategories: e.oldCategories || null,
    newCategories: e.newCategories || null,
    details: e.details || null,
    reason: e.reason,
    createdAt: e.createdAt,
    actor: e.actor || null,
  };
}

// ─── Loading ────────────────────────────────────────────────────────────────

async function loadBudget(client, cycle) {
  return client.researchBudget.findFirst({ where: { cycleId: cycle.id } });
}

async function loadOrg(client = prisma) {
  const [university, schools, departments] = await Promise.all([
    client.university.findFirst({ select: { id: true, name: true, code: true } }),
    client.facultySchoolList.findMany({ select: { id: true, facultyName: true, facultyCode: true, shortName: true, isActive: true } }),
    client.department.findMany({ select: { id: true, departmentName: true, departmentCode: true, shortName: true, facultyId: true, isActive: true } }),
  ]);
  if (!university) throw new BudgetError(404, 'University not found', 'NOT_FOUND');
  return { university, schools, departments };
}

async function loadAggregates(cycle) {
  const rows = await prisma.incentivePayout.groupBy({
    by: ['schoolId', 'departmentId', 'status', 'workType', 'sourceType'],
    where: { cycleId: cycle.id, NOT: { status: 'cancelled' } },
    _sum: { approvedAmount: true },
    _count: true,
  });
  return rows.map((r) => ({
    schoolId: r.schoolId,
    departmentId: r.departmentId,
    status: r.status,
    workType: r.workType,
    sourceType: r.sourceType,
    amount: Number(r._sum?.approvedAmount || 0),
    count: typeof r._count === 'number' ? r._count : r._count?._all || 0,
  }));
}

/** Grant money received during the cycle (by received date). */
async function loadReceipts(cycle) {
  const rows = await prisma.grantFundReceipt.findMany({
    where: { receivedDate: { gte: cycle.startDate, lte: cycle.endDate } },
    select: {
      id: true, amount: true, receivedDate: true, reference: true,
      grantApplication: { select: { id: true, title: true, applicationNumber: true, fundingAgencyName: true, schoolId: true, departmentId: true } },
    },
    orderBy: { receivedDate: 'desc' },
  });
  return rows.map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    receivedDate: r.receivedDate,
    reference: r.reference,
    grantId: r.grantApplication?.id || null,
    grantTitle: r.grantApplication?.title || null,
    applicationNumber: r.grantApplication?.applicationNumber || null,
    agency: r.grantApplication?.fundingAgencyName || null,
    schoolId: r.grantApplication?.schoolId || null,
    departmentId: r.grantApplication?.departmentId || null,
  }));
}

// ─── Tree ───────────────────────────────────────────────────────────────────

async function computeTree(cycleRef, scope = ALL) {
  requireTenant();
  const cycle = typeof cycleRef === 'object' ? cycleRef : await cycles.resolveCycle(cycleRef);
  const [budget, org, allocations, aggregates, receipts] = await Promise.all([
    loadBudget(prisma, cycle),
    loadOrg(),
    prisma.budgetAllocation.findMany({ where: { cycleId: cycle.id } }),
    loadAggregates(cycle),
    loadReceipts(cycle),
  ]);
  const tree = M.buildTree({ ...org, budget, allocations, aggregates, receipts, scope });
  return { cycle, budget, org, tree, receipts };
}

const cycleOut = (cycle) => cycles.serializeCycle(cycle, { withBudget: false });

function summaryOf(tree, budget) {
  const total = tree.allocated;
  return {
    total,
    allocatedToSchools: tree.childrenAllocated,
    unallocated: round2(total - tree.childrenAllocated),
    committed: tree.committed,
    utilised: tree.utilised,
    pending: tree.pending,
    consumed: tree.consumed,
    available: tree.available,
    utilisationPct: tree.utilisationPct,
    status: tree.status,
    externalFunding: tree.externalFunding,
    warnThresholdPct: budget?.warnThresholdPct ?? M.DEFAULT_WARN_PCT,
  };
}

/** GET /finance/budgets/:cycle — the tree with utilisation. */
async function getTree(cycleRef, { scope = ALL, canEdit = false } = {}) {
  const { cycle, budget, tree } = await computeTree(cycleRef, scope);
  return {
    cycle: cycleOut(cycle),
    budget: scope.all ? serializeBudget(budget) : budget ? { ...serializeBudget(budget), totalAmount: tree.allocated, notes: null } : null,
    tree,
    summary: summaryOf(tree, budget),
    access: { canEdit: !!canEdit && scope.all, scoped: !scope.all },
  };
}


// ─── Writes ─────────────────────────────────────────────────────────────────

async function logChange(client, data) {
  await client.budgetAllocationEvent.create({ data });
}

/**
 * PUT /finance/budgets/:cycle — create or update the university budget for a cycle.
 * @param {{ totalAmount, categoryAllocations?, notes?, enforceLimit?, warnThresholdPct?, reason? }} input
 */
async function upsertBudget(cycleRef, input = {}, actor) {
  const universityId = requireTenant();
  const cycle = await cycles.resolveCycle(cycleRef);
  const total = M.parseAmount(input.totalAmount, 'Total budget');
  const cats = M.parseCategories(input.categoryAllocations);
  M.assertCategoriesFit(cats, total, 'the university');
  const notes = input.notes === undefined ? undefined : input.notes === null ? null : String(input.notes).trim().slice(0, 2000) || null;
  const enforceLimit = input.enforceLimit === undefined ? undefined : input.enforceLimit === true || input.enforceLimit === 'true';
  let warnPct;
  if (input.warnThresholdPct !== undefined && input.warnThresholdPct !== null && input.warnThresholdPct !== '') {
    warnPct = Number(input.warnThresholdPct);
    if (!Number.isInteger(warnPct) || warnPct < 1 || warnPct > 100) {
      throw new BudgetError(400, 'Warning threshold must be a whole number from 1 to 100', 'INVALID_THRESHOLD');
    }
  }

  return prisma.$transaction(async (tx) => {
    const existing = await loadBudget(tx, cycle);
    if (existing) await tx.researchBudget.update({ where: { id: existing.id }, data: { version: { increment: 1 } } }); // lock
    const schoolRows = existing ? await tx.budgetAllocation.findMany({ where: { cycleId: cycle.id, nodeType: 'school' }, select: { amount: true } }) : [];
    const schoolsTotal = schoolRows.reduce((s, r) => s + paise(r.amount), 0) / 100;
    M.assertCoversChildren({ amount: total, childrenTotal: schoolsTotal, label: 'The university budget', childNoun: 'schools' });

    const amountChanged = !existing || paise(existing.totalAmount) !== paise(total);
    const catsChanged = !existing || !sameCategories(existing.categoryAllocations, cats);
    const reason = requireReasonIfChanged(existing, existing && (amountChanged || catsChanged), input.reason);
    const settings = {};
    if (existing) {
      if (notes !== undefined && (existing.notes || null) !== notes) settings.notes = { from: existing.notes || null, to: notes };
      if (enforceLimit !== undefined && existing.enforceLimit !== enforceLimit) settings.enforceLimit = { from: existing.enforceLimit, to: enforceLimit };
      if (warnPct !== undefined && existing.warnThresholdPct !== warnPct) settings.warnThresholdPct = { from: existing.warnThresholdPct, to: warnPct };
    }
    if (existing && !amountChanged && !catsChanged && !Object.keys(settings).length) return serializeBudget(existing);

    const data = {
      totalAmount: total,
      categoryAllocations: cats,
      ...(notes !== undefined ? { notes } : {}),
      ...(enforceLimit !== undefined ? { enforceLimit } : {}),
      ...(warnPct !== undefined ? { warnThresholdPct: warnPct } : {}),
      updatedById: actor.id,
    };
    const saved = existing
      ? await tx.researchBudget.update({ where: { id: existing.id }, data })
      : await tx.researchBudget.create({ data: { ...data, cycleId: cycle.id, createdById: actor.id } });

    await logChange(tx, {
      budgetId: saved.id,
      cycleId: cycle.id,
      nodeType: 'university',
      nodeId: universityId,
      nodeName: 'University total',
      action: existing ? 'budget_updated' : 'budget_created',
      oldAmount: existing ? existing.totalAmount : null,
      newAmount: total,
      oldCategories: existing ? existing.categoryAllocations || {} : undefined,
      newCategories: cats,
      details: existing ? (Object.keys(settings).length ? { settings } : undefined) : { settings: { enforceLimit: saved.enforceLimit, warnThresholdPct: saved.warnThresholdPct } },
      reason,
      actorId: actor.id,
    });
    return serializeBudget(saved);
  });
}

/**
 * PUT /finance/budgets/:cycle/allocations — create or update one school or department allocation.
 * @param {{ nodeType:'school'|'department', nodeId, amount, categoryAllocations?, reason? }} input
 */
async function upsertAllocation(cycleRef, input = {}, actor) {
  requireTenant();
  const cycle = await cycles.resolveCycle(cycleRef);
  const { nodeType, nodeId } = input;
  if (!NODE_TYPES.includes(nodeType)) throw new BudgetError(400, 'nodeType must be "school" or "department"', 'INVALID_NODE');
  if (!UUID_RE.test(String(nodeId || ''))) throw new BudgetError(400, 'nodeId must be a school or department id', 'INVALID_NODE');
  const amount = M.parseAmount(input.amount, 'Allocation');
  const cats = M.parseCategories(input.categoryAllocations);

  return prisma.$transaction(async (tx) => {
    const budget = await loadBudget(tx, cycle);
    if (!budget) throw new BudgetError(400, `Set the university's ${cycle.name} research budget first`, 'NO_BUDGET');
    await tx.researchBudget.update({ where: { id: budget.id }, data: { version: { increment: 1 } } }); // serialise writers

    let label;
    if (nodeType === 'school') {
      const school = await tx.facultySchoolList.findFirst({ where: { id: nodeId }, select: { id: true, facultyName: true } });
      if (!school) throw new BudgetError(404, 'School not found', 'NOT_FOUND');
      label = school.facultyName;
      const [siblings, depts] = await Promise.all([
        tx.budgetAllocation.findMany({ where: { cycleId: cycle.id, nodeType: 'school', NOT: { nodeId } }, select: { amount: true } }),
        tx.department.findMany({ where: { facultyId: nodeId }, select: { id: true } }),
      ]);
      M.assertFitsParent({
        amount,
        siblingsTotal: siblings.reduce((s, r) => s + paise(r.amount), 0) / 100,
        parentAmount: Number(budget.totalAmount),
        label,
        parentLabel: 'the university budget',
        childNoun: 'school allocations',
      });
      const childRows = depts.length
        ? await tx.budgetAllocation.findMany({ where: { cycleId: cycle.id, nodeType: 'department', nodeId: { in: depts.map((d) => d.id) } }, select: { amount: true } })
        : [];
      M.assertCoversChildren({ amount, childrenTotal: childRows.reduce((s, r) => s + paise(r.amount), 0) / 100, label: `${label}'s allocation`, childNoun: 'departments' });
    } else {
      const dept = await tx.department.findFirst({
        where: { id: nodeId },
        select: { id: true, departmentName: true, facultyId: true, faculty: { select: { facultyName: true } } },
      });
      if (!dept) throw new BudgetError(404, 'Department not found', 'NOT_FOUND');
      label = dept.departmentName;
      const schoolName = dept.faculty?.facultyName || 'its school';
      const parent = await tx.budgetAllocation.findFirst({ where: { cycleId: cycle.id, nodeType: 'school', nodeId: dept.facultyId } });
      if (!parent && amount > 0) {
        throw new BudgetError(400, `Allocate a budget to ${schoolName} before distributing it to its departments`, 'PARENT_NOT_ALLOCATED');
      }
      const siblingDepts = await tx.department.findMany({ where: { facultyId: dept.facultyId, NOT: { id: nodeId } }, select: { id: true } });
      const siblings = siblingDepts.length
        ? await tx.budgetAllocation.findMany({ where: { cycleId: cycle.id, nodeType: 'department', nodeId: { in: siblingDepts.map((d) => d.id) } }, select: { amount: true } })
        : [];
      M.assertFitsParent({
        amount,
        siblingsTotal: siblings.reduce((s, r) => s + paise(r.amount), 0) / 100,
        parentAmount: Number(parent?.amount || 0),
        label,
        parentLabel: schoolName,
        childNoun: 'department allocations',
      });
    }
    M.assertCategoriesFit(cats, amount, label);

    const existing = await tx.budgetAllocation.findFirst({ where: { cycleId: cycle.id, nodeType, nodeId } });
    const amountChanged = !existing || paise(existing.amount) !== paise(amount);
    const catsChanged = !existing || !sameCategories(existing.categoryAllocations, cats);
    if (existing && !amountChanged && !catsChanged) return { ...serializeAllocation(existing), unchanged: true };
    const reason = requireReasonIfChanged(existing, true, input.reason);

    const data = { amount, categoryAllocations: cats, updatedById: actor.id };
    const saved = existing
      ? await tx.budgetAllocation.update({ where: { id: existing.id }, data })
      : await tx.budgetAllocation.create({
          data: {
            ...data,
            budgetId: budget.id,
            cycleId: cycle.id,
            nodeType,
            nodeId,
            schoolId: nodeType === 'school' ? nodeId : null,
            departmentId: nodeType === 'department' ? nodeId : null,
          },
        });
    await logChange(tx, {
      budgetId: budget.id,
      cycleId: cycle.id,
      nodeType,
      nodeId,
      nodeName: String(label).slice(0, 256),
      action: existing ? 'allocation_updated' : 'allocation_created',
      oldAmount: existing ? existing.amount : null,
      newAmount: amount,
      oldCategories: existing ? existing.categoryAllocations || {} : undefined,
      newCategories: cats,
      reason,
      actorId: actor.id,
    });
    return serializeAllocation(saved);
  });
}

function serializeAllocation(a) {
  return {
    id: a.id,
    cycleId: a.cycleId,
    nodeType: a.nodeType,
    nodeId: a.nodeId,
    amount: num(a.amount),
    categoryAllocations: a.categoryAllocations || {},
    updatedAt: a.updatedAt,
  };
}

// ─── History, node detail, analytics ────────────────────────────────────────

function assertNodeInScope(scope, nodeType, nodeId, tree) {
  if (scope.all) return;
  if (nodeType === 'university') return; // the scoped root only aggregates the viewer's schools
  const visible = M.flattenTree(tree).some((n) => n.nodeType === nodeType && n.id === nodeId);
  if (!visible) throw new BudgetError(403, 'This school or department is outside your analytics scope', 'OUT_OF_SCOPE');
}

/** GET /finance/budgets/:cycle/history — change trail, optionally for one node. */
async function history(cycleRef, { nodeType, nodeId, limit = 100 } = {}, scope = ALL) {
  requireTenant();
  const cycle = await cycles.resolveCycle(cycleRef);
  if (nodeType && !['university', ...NODE_TYPES].includes(nodeType)) throw new BudgetError(400, 'Invalid node type', 'INVALID_NODE');
  if (nodeId && !UUID_RE.test(String(nodeId))) throw new BudgetError(400, 'Invalid node id', 'INVALID_NODE');
  if (!scope.all) {
    if (!nodeType || nodeType === 'university') throw new BudgetError(403, 'Budget history is limited to your schools', 'OUT_OF_SCOPE');
    const { tree } = await computeTree(cycle, scope);
    assertNodeInScope(scope, nodeType, nodeId, tree);
  }
  const rows = await prisma.budgetAllocationEvent.findMany({
    where: { cycleId: cycle.id, ...(nodeType ? { nodeType } : {}), ...(nodeId ? { nodeId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500),
    include: { actor: ACTOR },
  });
  return rows.map(serializeEvent);
}

function lineWhereForNode(nodeType, nodeId, scope) {
  if (nodeType === 'university') return scope.all ? {} : { schoolId: { in: scope.schoolIds || [] } };
  if (nodeType === 'unassigned') return { schoolId: null };
  if (nodeType === 'school') return { schoolId: nodeId };
  return { departmentId: nodeId };
}

function monthlySeries(cycle, lines) {
  const months = M.monthsOfRange(cycle.startDate, cycle.endDate);
  const map = new Map(months.map((m) => [m, { month: m, utilised: 0, committed: 0 }]));
  for (const l of lines) {
    const amount = Number(l.approvedAmount) || 0;
    if (l.status === 'paid') {
      const m = map.get(M.monthKeyIST(l.paidAt));
      if (m) m.utilised = round2(m.utilised + amount);
    } else if (M.bucketOf(l.status) === 'committed') {
      const m = map.get(M.monthKeyIST(l.recommendedAt || l.sourceApprovedAt));
      if (m) m.committed = round2(m.committed + amount);
    }
  }
  let cumulative = 0;
  return months.map((k) => {
    const m = map.get(k);
    cumulative = round2(cumulative + m.utilised);
    return { ...m, cumulativeUtilised: cumulative };
  });
}

async function loadMonthlyLines(cycle, where) {
  return prisma.incentivePayout.findMany({
    where: { cycleId: cycle.id, status: { in: M.CONSUMED_STATUSES }, ...where },
    select: { status: true, approvedAmount: true, paidAt: true, recommendedAt: true, sourceApprovedAt: true },
  });
}

/** GET /finance/budgets/:cycle/nodes/:nodeType/:nodeId — figures, monthly burn, lines, receipts, history. */
async function nodeDetail(cycleRef, nodeType, nodeId, scope = ALL) {
  if (!['university', 'school', 'department', 'unassigned'].includes(nodeType)) throw new BudgetError(400, 'Invalid node type', 'INVALID_NODE');
  if (nodeType === 'unassigned' && !scope.all) throw new BudgetError(403, 'Unassigned lines are visible to finance only', 'OUT_OF_SCOPE');
  if ((nodeType === 'school' || nodeType === 'department') && !UUID_RE.test(String(nodeId || ''))) throw new BudgetError(400, 'Invalid node id', 'INVALID_NODE');
  const { cycle, budget, tree, receipts } = await computeTree(cycleRef, scope);
  assertNodeInScope(scope, nodeType, nodeId, tree);
  const node = nodeType === 'university'
    ? { ...tree, children: undefined }
    : M.flattenTree(tree).find((n) => n.nodeType === nodeType && (nodeType === 'unassigned' || n.id === nodeId));
  if (!node) throw new BudgetError(404, 'This school or department is not part of the budget tree', 'NOT_FOUND');

  const where = lineWhereForNode(nodeType, nodeId, scope);
  const [monthlyLines, lines, lineCount, events] = await Promise.all([
    loadMonthlyLines(cycle, where),
    prisma.incentivePayout.findMany({
      where: { cycleId: cycle.id, NOT: { status: 'cancelled' }, ...where },
      orderBy: [{ approvedAmount: 'desc' }, { createdAt: 'desc' }],
      take: 25,
      select: {
        id: true, title: true, payeeName: true, payeeEmployeeId: true, workType: true, sourceType: true, status: true,
        approvedAmount: true, referenceNumber: true, paidAt: true, batchId: true,
        school: { select: { facultyName: true } }, department: { select: { departmentName: true } },
      },
    }),
    prisma.incentivePayout.count({ where: { cycleId: cycle.id, NOT: { status: 'cancelled' }, ...where } }),
    budget && nodeType !== 'unassigned' && (scope.all || nodeType !== 'university')
      ? prisma.budgetAllocationEvent.findMany({
          where: { cycleId: cycle.id, nodeType, nodeId: nodeType === 'university' ? tree.id : nodeId },
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { actor: ACTOR },
        })
      : [],
  ]);
  const nodeReceipts = receipts.filter((r) => {
    if (nodeType === 'university') return scope.all || (scope.schoolIds || []).includes(r.schoolId);
    if (nodeType === 'unassigned') return !r.schoolId;
    if (nodeType === 'school') return r.schoolId === nodeId;
    return r.departmentId === nodeId;
  });
  const monthly = monthlySeries(cycle, monthlyLines);
  return {
    cycle: cycleOut(cycle),
    node,
    monthly,
    burnRate: M.burnRate(cycle, monthly, node.allocated),
    lines: { total: lineCount, items: lines.map((l) => ({ ...l, approvedAmount: Number(l.approvedAmount), category: M.categoryOf(l) })) },
    externalFunding: { ...node.externalFunding, receipts: nodeReceipts.slice(0, 50) },
    history: events.map(serializeEvent),
  };
}

/** GET /finance/budgets/:cycle/analytics — by node, by category, monthly trend, top over/under. */
async function analytics(cycleRef, scope = ALL) {
  const { cycle, budget, tree } = await computeTree(cycleRef, scope);
  const monthly = monthlySeries(cycle, await loadMonthlyLines(cycle, lineWhereForNode('university', null, scope)));
  const nodes = M.flattenTree(tree).filter((n) => n.nodeType === 'school' || n.nodeType === 'department');
  const pick = (n) => ({
    nodeType: n.nodeType, id: n.id, name: n.name, code: n.code, parentId: n.parentId,
    allocated: n.allocated, committed: n.committed, utilised: n.utilised, pending: n.pending, consumed: n.consumed,
    available: n.available, utilisationPct: n.utilisationPct, status: n.status, externalFunding: n.externalFunding.amount,
  });
  const allocatedNodes = nodes.filter((n) => n.allocated > 0);
  return {
    cycle: cycleOut(cycle),
    hasBudget: !!budget,
    summary: summaryOf(tree, budget),
    byNode: nodes.map(pick),
    bySchool: tree.children.filter((n) => n.nodeType === 'school').map(pick),
    unassigned: tree.children.find((n) => n.nodeType === 'unassigned') ? pick(tree.children.find((n) => n.nodeType === 'unassigned')) : null,
    byCategory: tree.categories,
    monthly,
    burnRate: M.burnRate(cycle, monthly, tree.allocated),
    topOver: [...nodes]
      .filter((n) => n.consumed > n.allocated)
      .sort((a, b) => (b.consumed - b.allocated) - (a.consumed - a.allocated))
      .slice(0, 5)
      .map(pick),
    topUnder: [...allocatedNodes]
      .filter((n) => n.consumed <= n.allocated)
      .sort((a, b) => (a.utilisationPct ?? 0) - (b.utilisationPct ?? 0) || b.available - a.available)
      .slice(0, 5)
      .map(pick),
  };
}

// ─── Export ─────────────────────────────────────────────────────────────────

const STATUS_LABEL = { healthy: 'Healthy', warning: 'Near limit', over: 'Over budget', unallocated: 'No allocation', unattributed: 'Unassigned' };

/** GET /finance/budgets/:cycle/export — xlsx of the tree with utilisation. */
async function exportXlsx(cycleRef, scope = ALL) {
  const { cycle, budget, tree } = await computeTree(cycleRef, scope);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ResearchSphere';
  // Sheet names: at most 31 characters, none of \ / ? * [ ] :
  const ws = wb.addWorksheet(`Budget ${cycle.name}`.replace(/[\\/?*[\]:]/g, '-').slice(0, 31));
  ws.columns = [
    { header: 'Level', key: 'level', width: 12 },
    { header: 'School', key: 'school', width: 36 },
    { header: 'Department', key: 'dept', width: 36 },
    { header: 'Allocated (₹)', key: 'allocated', width: 16 },
    { header: 'Committed (₹)', key: 'committed', width: 16 },
    { header: 'Utilised / paid (₹)', key: 'utilised', width: 18 },
    { header: 'Pending verification (₹)', key: 'pending', width: 22 },
    { header: 'Available (₹)', key: 'available', width: 16 },
    { header: 'Utilisation %', key: 'pct', width: 14 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'External funding received (₹)', key: 'ext', width: 26 },
  ];
  ws.getRow(1).font = { bold: true };
  const add = (level, school, dept, n) => ws.addRow({
    level,
    school: neutralizeFormula(school || ''),
    dept: neutralizeFormula(dept || ''),
    allocated: n.allocated,
    committed: n.committed,
    utilised: n.utilised,
    pending: n.pending,
    available: n.nodeType === 'unassigned' ? null : n.available,
    pct: n.utilisationPct,
    status: STATUS_LABEL[n.status] || n.status,
    ext: n.externalFunding.amount,
  });
  const top = add(scope.all ? 'University' : 'Your schools', neutralizeFormula(tree.name), '', tree);
  top.font = { bold: true };
  for (const s of tree.children) {
    const r = add(s.nodeType === 'unassigned' ? 'Unassigned' : 'School', s.name, '', s);
    r.font = { bold: true };
    for (const d of s.children || []) add('Department', s.name, d.name, d);
  }
  ['allocated', 'committed', 'utilised', 'pending', 'available', 'ext'].forEach((k) => { ws.getColumn(k).numFmt = '#,##0.00'; });
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const cs = wb.addWorksheet('By category');
  cs.columns = [
    { header: 'Category', key: 'c', width: 22 },
    { header: 'Allocated (₹)', key: 'a', width: 16 },
    { header: 'Committed (₹)', key: 'cm', width: 16 },
    { header: 'Utilised (₹)', key: 'u', width: 16 },
    { header: 'Pending (₹)', key: 'p', width: 16 },
  ];
  cs.getRow(1).font = { bold: true };
  tree.categories.forEach((c) => cs.addRow({ c: c.label, a: c.allocated, cm: c.committed, u: c.utilised, p: c.pending }));

  const ms = wb.addWorksheet('Monthly burn');
  ms.columns = [
    { header: 'Month', key: 'm', width: 12 },
    { header: 'Utilised (₹)', key: 'u', width: 16 },
    { header: 'Committed (₹)', key: 'c', width: 16 },
    { header: 'Cumulative utilised (₹)', key: 'cu', width: 22 },
  ];
  ms.getRow(1).font = { bold: true };
  monthlySeries(cycle, await loadMonthlyLines(cycle, lineWhereForNode('university', null, scope)))
    .forEach((m) => ms.addRow({ m: m.month, u: m.utilised, c: m.committed, cu: m.cumulativeUtilised }));

  if (budget && scope.all && budget.notes) {
    const ns = wb.addWorksheet('Notes');
    ns.addRow([neutralizeFormula(budget.notes)]);
  }
  const slug = cycle.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cycle';
  return { filename: `research-budget-${slug}.xlsx`, buffer: await wb.xlsx.writeBuffer() };
}

module.exports = {
  BudgetError,
  financialYearOf,
  getTree,
  upsertBudget,
  upsertAllocation,
  history,
  nodeDetail,
  analytics,
  exportXlsx,
  // exported for tests
  _monthlySeries: monthlySeries,
};
