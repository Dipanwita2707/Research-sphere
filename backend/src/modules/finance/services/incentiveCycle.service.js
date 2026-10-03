/**
 * Incentive cycles: the period that incentive policies and the research budget share.
 *
 *   IncentiveCycle     name + start/end date (default April–March); never overlapping
 *   ResearchBudget     at most one per cycle
 *   IncentivePayout    cycleId = the cycle containing the line's policyDate (the date that selected
 *                      its incentive policy), so a line always draws on the budget of the cycle
 *                      whose policy priced it
 *   Incentive policies an enabled policy saved while cycles exist sits inside one cycle
 *                      (research/utils/policyCycle.js)
 *
 * Creating a cycle or moving its dates re-links payout lines by policyDate. Dates cannot move
 * so that an enabled policy that sat inside the cycle would stick out of it.
 * Every query runs inside the request's tenant context (Prisma tenant extension).
 */
const prisma = require('../../../shared/config/database');
const tenantContext = require('../../../shared/tenancy/tenantContext');
const { utcDay, isoDay, cycleContaining } = require('../../research/utils/policyCycle');
const { BudgetError } = require('./budgetMath');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CYCLE_DAYS = 5 * 366;

/** Policy models a cycle groups, with the admin page that manages each. */
const POLICY_SOURCES = [
  { type: 'research_paper', label: 'Research papers', model: 'researchIncentivePolicy', href: '/admin/research-policies',
    select: { publicationType: true, baseIncentiveAmount: true }, key: (p) => p.publicationType, amount: (p) => p.baseIncentiveAmount },
  { type: 'book', label: 'Books', model: 'bookIncentivePolicy', href: '/admin/book-policies',
    select: { authoredIncentiveAmount: true }, key: () => null, amount: (p) => p.authoredIncentiveAmount },
  { type: 'book_chapter', label: 'Book chapters', model: 'bookChapterIncentivePolicy', href: '/admin/book-chapter-policies',
    select: { authoredIncentiveAmount: true }, key: () => null, amount: (p) => p.authoredIncentiveAmount },
  { type: 'conference_paper', label: 'Conference papers', model: 'conferenceIncentivePolicy', href: '/admin/conference-policies',
    select: { conferenceSubType: true, flatIncentiveAmount: true }, key: (p) => p.conferenceSubType, amount: (p) => p.flatIncentiveAmount },
  { type: 'ipr', label: 'IPR', model: 'incentivePolicy', href: '/admin/incentive-policies',
    select: { iprType: true, baseIncentiveAmount: true }, key: (p) => p.iprType, amount: (p) => p.baseIncentiveAmount },
  { type: 'grant', label: 'Grants', model: 'grantIncentivePolicy', href: '/admin/grant-policies',
    select: { projectCategory: true, projectType: true, baseIncentiveAmount: true },
    key: (p) => [p.projectCategory, p.projectType].filter(Boolean).join(' / ') || null, amount: (p) => p.baseIncentiveAmount },
];

function requireTenant() {
  const id = tenantContext.getTenantId();
  if (!id) throw new BudgetError(400, 'Select a university first', 'TENANT_REQUIRED');
  return id;
}

/** Today's calendar day in India, as a UTC-midnight Date (cycle dates are calendar days). */
function todayIST(now = new Date()) {
  return utcDay(new Date(now.getTime() + 5.5 * 3600 * 1000));
}

/** Default cycle for a date: the Indian financial year containing it. */
function financialYearCycle(date = new Date()) {
  const d = todayIST(date);
  const start = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return {
    name: `FY ${start}-${String((start + 1) % 100).padStart(2, '0')}`,
    startDate: `${start}-04-01`,
    endDate: `${start + 1}-03-31`,
  };
}

function serializeCycle(c, { today = todayIST(), withBudget = true } = {}) {
  if (!c) return null;
  const start = utcDay(c.startDate);
  const end = utcDay(c.endDate);
  return {
    id: c.id,
    name: c.name,
    startDate: isoDay(start),
    endDate: isoDay(end),
    notes: c.notes || null,
    isCurrent: start <= today && today <= end,
    ...(withBudget && c.budget !== undefined
      ? { budget: c.budget ? { id: c.budget.id, totalAmount: Number(c.budget.totalAmount) } : null }
      : {}),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function parseDay(value, label) {
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').trim();
  if (!DATE_RE.test(text)) throw new BudgetError(400, `${label} must be a date (YYYY-MM-DD)`, 'INVALID_DATE');
  const d = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== text) throw new BudgetError(400, `${label} is not a valid date`, 'INVALID_DATE');
  return d;
}

function parseCycleInput(input, existing = null) {
  const name = input.name === undefined ? existing?.name : String(input.name || '').trim();
  if (!name) throw new BudgetError(400, 'Give the cycle a name, e.g. "FY 2026-27"', 'INVALID_NAME');
  if (name.length > 64) throw new BudgetError(400, 'Cycle name can be at most 64 characters', 'INVALID_NAME');
  const startDate = input.startDate === undefined ? utcDay(existing.startDate) : parseDay(input.startDate, 'Start date');
  const endDate = input.endDate === undefined ? utcDay(existing.endDate) : parseDay(input.endDate, 'End date');
  if (endDate < startDate) throw new BudgetError(400, 'The end date must be on or after the start date', 'INVALID_DATES');
  if ((endDate - startDate) / 86400000 > MAX_CYCLE_DAYS) throw new BudgetError(400, 'A cycle can be at most five years long', 'INVALID_DATES');
  const notes = input.notes === undefined ? undefined : input.notes === null ? null : String(input.notes).trim().slice(0, 2000) || null;
  return { name, startDate, endDate, notes };
}

async function assertNoOverlap(client, { startDate, endDate, excludeId = null }) {
  const clash = await client.incentiveCycle.findFirst({
    where: { startDate: { lte: endDate }, endDate: { gte: startDate }, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
  });
  if (clash) {
    throw new BudgetError(409, `These dates overlap the cycle "${clash.name}" (${isoDay(clash.startDate)} – ${isoDay(clash.endDate)}). Cycles cannot overlap.`, 'CYCLE_OVERLAP');
  }
}

async function assertNameFree(client, name, excludeId = null) {
  const same = await client.incentiveCycle.findFirst({ where: { name, ...(excludeId ? { NOT: { id: excludeId } } : {}) }, select: { id: true } });
  if (same) throw new BudgetError(409, `A cycle named "${name}" already exists`, 'CYCLE_NAME_TAKEN');
}

/** Map a database overlap/unique violation that slipped past the checks to a clear 409. */
function rethrowConstraint(err) {
  const text = `${err?.message || ''} ${err?.meta ? JSON.stringify(err.meta) : ''}`;
  if (/23P01|incentive_cycle_no_overlap|exclusion constraint/i.test(text)) {
    throw new BudgetError(409, 'Another cycle already covers these dates. Refresh and adjust the dates.', 'CYCLE_OVERLAP');
  }
  if (err?.code === 'P2002') throw new BudgetError(409, 'A cycle with this name already exists', 'CYCLE_NAME_TAKEN');
  throw err;
}

/**
 * Point payout lines at the cycle containing their policyDate, for lines whose policyDate lies in
 * [from, to] or that currently point at `cycleId`. Returns how many lines changed cycle.
 */
async function relinkPayouts(tx, { from, to, cycleId = null }) {
  const lines = await tx.incentivePayout.findMany({
    where: {
      OR: [
        { policyDate: { gte: from, lte: to } },
        ...(cycleId ? [{ cycleId }] : []),
      ],
    },
    select: { id: true, cycleId: true, policyDate: true },
  });
  if (!lines.length) return 0;
  const cycles = await tx.incentiveCycle.findMany({ select: { id: true, startDate: true, endDate: true } });
  const target = (day) => {
    if (!day) return null;
    const t = utcDay(day).getTime();
    return cycles.find((c) => utcDay(c.startDate).getTime() <= t && t <= utcDay(c.endDate).getTime())?.id || null;
  };
  const moves = new Map(); // target cycle id (or 'null') → line ids
  for (const l of lines) {
    const next = target(l.policyDate);
    if (next === l.cycleId) continue;
    const k = next || 'null';
    if (!moves.has(k)) moves.set(k, []);
    moves.get(k).push(l.id);
  }
  let moved = 0;
  for (const [k, ids] of moves) {
    const r = await tx.incentivePayout.updateMany({ where: { id: { in: ids } }, data: { cycleId: k === 'null' ? null : k } });
    moved += r.count;
  }
  return moved;
}

/** Enabled policies whose window touches [start, end], across every policy type. */
async function loadPolicies(client, start, end) {
  const rows = await Promise.all(POLICY_SOURCES.map((src) => client[src.model].findMany({
    where: { isActive: true, effectiveFrom: { lte: new Date(end.getTime() + 86399999) }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }] },
    select: { id: true, policyName: true, effectiveFrom: true, effectiveTo: true, ...src.select },
    orderBy: { effectiveFrom: 'asc' },
  }).then((list) => list.map((p) => ({ src, p })))));
  return rows.flat();
}

const policyFits = (p, start, end) =>
  !!p.effectiveTo && utcDay(p.effectiveFrom) >= start && utcDay(p.effectiveTo) <= end;

// ─── Reads ──────────────────────────────────────────────────────────────────

/** GET /finance/budgets/cycles — every cycle, newest first, with its budget total (finance only). */
async function listCycles(scope = { all: true }) {
  requireTenant();
  const rows = await prisma.incentiveCycle.findMany({
    orderBy: { startDate: 'desc' },
    include: { budget: { select: { id: true, totalAmount: true } } },
  });
  const today = todayIST();
  return {
    cycles: rows.map((c) => {
      const out = serializeCycle(c, { today });
      // Read-only viewers learn which cycles have a budget, not the totals.
      if (!scope.all && out.budget) out.budget = { id: out.budget.id };
      return out;
    }),
    suggestion: suggestNext(rows),
  };
}

/** Prefill for "New cycle": the April–March year after the latest cycle, or the current one. */
function suggestNext(rows) {
  if (!rows.length) return financialYearCycle();
  const latestEnd = utcDay(rows.reduce((a, c) => (utcDay(c.endDate) > utcDay(a.endDate) ? c : a)).endDate);
  const next = financialYearCycle(new Date(latestEnd.getTime() + 86400000));
  // A custom cycle may end mid-year: start the day after it, keep the FY end.
  const start = new Date(latestEnd.getTime() + 86400000);
  const fyStart = new Date(`${next.startDate}T00:00:00.000Z`);
  return start > fyStart ? { ...next, startDate: isoDay(start) } : next;
}

/**
 * Resolve a cycle reference from a URL: a cycle id, or "current" (the cycle containing today,
 * else the latest one that has started, else the earliest upcoming one).
 */
async function resolveCycle(ref, client = prisma) {
  requireTenant();
  if (ref === 'current') {
    const today = todayIST();
    const cycle = (await cycleContaining(client.incentiveCycle, today))
      || (await client.incentiveCycle.findFirst({ where: { startDate: { lte: today } }, orderBy: { startDate: 'desc' } }))
      || (await client.incentiveCycle.findFirst({ orderBy: { startDate: 'asc' } }));
    if (!cycle) throw new BudgetError(404, 'No incentive cycle exists yet. Create one to set a research budget.', 'NO_CYCLE');
    return cycle;
  }
  if (!UUID_RE.test(String(ref || ''))) throw new BudgetError(400, 'Unknown incentive cycle', 'INVALID_CYCLE');
  const cycle = await client.incentiveCycle.findFirst({ where: { id: ref } });
  if (!cycle) throw new BudgetError(404, 'Incentive cycle not found', 'NOT_FOUND');
  return cycle;
}

/** GET /finance/budgets/:cycle/policies — enabled policies in force during the cycle. */
async function cyclePolicies(ref) {
  const cycle = await resolveCycle(ref);
  const start = utcDay(cycle.startDate);
  const end = utcDay(cycle.endDate);
  const rows = await loadPolicies(prisma, start, end);
  const items = rows.map(({ src, p }) => ({
    id: p.id,
    type: src.type,
    typeLabel: src.label,
    href: src.href,
    name: p.policyName,
    key: src.key(p),
    amount: src.amount(p) == null ? null : Number(src.amount(p)),
    effectiveFrom: isoDay(p.effectiveFrom),
    effectiveTo: isoDay(p.effectiveTo),
    fitsCycle: policyFits(p, start, end),
  }));
  const byType = POLICY_SOURCES.map((src) => ({
    type: src.type,
    label: src.label,
    href: src.href,
    count: items.filter((i) => i.type === src.type).length,
  }));
  return { cycle: serializeCycle(cycle, { withBudget: false }), items, byType };
}

// ─── Writes ─────────────────────────────────────────────────────────────────

/** POST /finance/budgets/cycles */
async function createCycle(input = {}, actor) {
  requireTenant();
  const data = parseCycleInput(input);
  try {
    return await prisma.$transaction(async (tx) => {
      await assertNameFree(tx, data.name);
      await assertNoOverlap(tx, data);
      const cycle = await tx.incentiveCycle.create({
        data: { ...data, notes: data.notes ?? null, createdById: actor.id, updatedById: actor.id },
      });
      const relinked = await relinkPayouts(tx, { from: data.startDate, to: data.endDate });
      return { ...serializeCycle({ ...cycle, budget: null }), relinkedPayoutLines: relinked };
    });
  } catch (err) {
    return rethrowConstraint(err);
  }
}

/** PUT /finance/budgets/cycles/:id — rename, change notes or move the dates. */
async function updateCycle(id, input = {}, actor) {
  requireTenant();
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await resolveCycle(id, tx);
      const data = parseCycleInput(input, existing);
      if (data.name !== existing.name) await assertNameFree(tx, data.name, existing.id);
      const oldStart = utcDay(existing.startDate);
      const oldEnd = utcDay(existing.endDate);
      const datesChanged = data.startDate.getTime() !== oldStart.getTime() || data.endDate.getTime() !== oldEnd.getTime();
      if (datesChanged) {
        await assertNoOverlap(tx, { ...data, excludeId: existing.id });
        // A policy that sat inside the cycle must still sit inside it.
        const stuckOut = (await loadPolicies(tx, oldStart, oldEnd))
          .filter(({ p }) => policyFits(p, oldStart, oldEnd) && !policyFits(p, data.startDate, data.endDate));
        if (stuckOut.length) {
          const names = stuckOut.slice(0, 5).map(({ src, p }) => `${src.label}: "${p.policyName}" (${isoDay(p.effectiveFrom)} – ${isoDay(p.effectiveTo)})`);
          throw new BudgetError(
            409,
            `${stuckOut.length} enabled polic${stuckOut.length === 1 ? 'y' : 'ies'} would fall outside the new dates: ${names.join('; ')}${stuckOut.length > 5 ? '; …' : ''}. Change those policies' dates first.`,
            'CYCLE_POLICIES_OUTSIDE',
          );
        }
      }
      const saved = await tx.incentiveCycle.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          startDate: data.startDate,
          endDate: data.endDate,
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
          updatedById: actor.id,
        },
        include: { budget: { select: { id: true, totalAmount: true } } },
      });
      let relinked = 0;
      if (datesChanged) {
        const from = new Date(Math.min(oldStart, data.startDate));
        const to = new Date(Math.max(oldEnd, data.endDate));
        relinked = await relinkPayouts(tx, { from, to, cycleId: existing.id });
        if (saved.budget) {
          await tx.budgetAllocationEvent.create({
            data: {
              budgetId: saved.budget.id,
              cycleId: existing.id,
              nodeType: 'university',
              nodeId: existing.universityId,
              nodeName: 'University total',
              action: 'cycle_dates_changed',
              details: {
                from: { startDate: isoDay(oldStart), endDate: isoDay(oldEnd) },
                to: { startDate: isoDay(data.startDate), endDate: isoDay(data.endDate) },
                relinkedPayoutLines: relinked,
              },
              actorId: actor.id,
            },
          });
        }
      }
      return { ...serializeCycle(saved), relinkedPayoutLines: relinked };
    });
  } catch (err) {
    return rethrowConstraint(err);
  }
}

/** DELETE /finance/budgets/cycles/:id — only a cycle with no budget and no payout lines. */
async function deleteCycle(id) {
  requireTenant();
  return prisma.$transaction(async (tx) => {
    const cycle = await resolveCycle(id, tx);
    const [budget, lines] = await Promise.all([
      tx.researchBudget.findFirst({ where: { cycleId: cycle.id }, select: { id: true } }),
      tx.incentivePayout.count({ where: { cycleId: cycle.id } }),
    ]);
    if (budget) throw new BudgetError(409, `"${cycle.name}" has a research budget and cannot be deleted`, 'CYCLE_IN_USE');
    if (lines) throw new BudgetError(409, `${lines} payout line(s) are charged to "${cycle.name}"; it cannot be deleted`, 'CYCLE_IN_USE');
    await tx.incentiveCycle.delete({ where: { id: cycle.id } });
    return { id: cycle.id, deleted: true };
  });
}

module.exports = {
  POLICY_SOURCES,
  todayIST,
  financialYearCycle,
  serializeCycle,
  listCycles,
  resolveCycle,
  cyclePolicies,
  createCycle,
  updateCycle,
  deleteCycle,
  relinkPayouts,
};
