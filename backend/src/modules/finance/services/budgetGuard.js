/**
 * Over-budget check for payout actions (recommend lines, approve a batch).
 *
 * After the action's own writes (inside its transaction), every node the lines touch —
 * the university, the payees' schools and departments — is compared with its allocation:
 * consumed (recommended + on_hold + approved + paid) above the allocation is reported.
 *
 * Default: a warning in the response, logged to BudgetAllocationEvent. Never a block, except
 * batch approval when the budget's enforceLimit is on (409 BUDGET_EXCEEDED, logged as blocked).
 * Only nodes that have an allocation are checked (plus the university total); a school or
 * department without one is reported on the budget page instead.
 */
const { CONSUMED_STATUSES, round2, paise, formatINR } = require('./budgetMath');

const unique = (xs) => [...new Set(xs.filter(Boolean))];

/**
 * @param {object} client  Prisma client or transaction
 * Lines are grouped by the incentive cycle they are charged to (cycleId); a line outside every
 * cycle has no budget to check.
 * @param {Array<{cycleId:string|null, schoolId?:string|null, departmentId?:string|null}>} lines
 * @returns {Promise<{ warnings: object[], budgets: object[] }>}
 */
async function assessLines(client, lines) {
  const cycleIds = unique(lines.map((l) => l.cycleId));
  if (!cycleIds.length) return { warnings: [], budgets: [] };
  const budgets = await client.researchBudget.findMany({
    where: { cycleId: { in: cycleIds } },
    include: { cycle: { select: { name: true } } },
  });
  if (!budgets || !budgets.length) return { warnings: [], budgets: [] };

  const warnings = [];
  for (const budget of budgets) {
    const cycleId = budget.cycleId;
    const cycleName = budget.cycle?.name || 'this cycle';
    const cycleLines = lines.filter((l) => l.cycleId === cycleId);
    const schoolIds = unique(cycleLines.map((l) => l.schoolId));
    const deptIds = unique(cycleLines.map((l) => l.departmentId));

    const [allocations, consumedRows] = await Promise.all([
      schoolIds.length || deptIds.length
        ? client.budgetAllocation.findMany({
            where: {
              cycleId,
              OR: [
                ...(schoolIds.length ? [{ nodeType: 'school', nodeId: { in: schoolIds } }] : []),
                ...(deptIds.length ? [{ nodeType: 'department', nodeId: { in: deptIds } }] : []),
              ],
            },
            include: { school: { select: { facultyName: true } }, department: { select: { departmentName: true } } },
          })
        : [],
      client.incentivePayout.groupBy({
        by: ['schoolId', 'departmentId'],
        where: { cycleId, status: { in: CONSUMED_STATUSES } },
        _sum: { approvedAmount: true },
      }),
    ]);

    let uni = 0;
    const bySchool = new Map();
    const byDept = new Map();
    for (const r of consumedRows) {
      const p = paise(r._sum?.approvedAmount);
      uni += p;
      if (r.schoolId) bySchool.set(r.schoolId, (bySchool.get(r.schoolId) || 0) + p);
      if (r.departmentId) byDept.set(r.departmentId, (byDept.get(r.departmentId) || 0) + p);
    }

    const push = (nodeType, nodeId, nodeName, allocated, consumedPaise) => {
      if (consumedPaise <= paise(allocated)) return;
      const consumed = consumedPaise / 100;
      warnings.push({
        budgetId: budget.id,
        enforceLimit: !!budget.enforceLimit,
        cycleId,
        cycleName,
        nodeType,
        nodeId,
        nodeName,
        allocated: round2(allocated),
        consumed: round2(consumed),
        over: round2(consumed - Number(allocated)),
        message: `${nodeName} is over its ${cycleName} research budget: ${formatINR(consumed)} committed or paid against ${formatINR(allocated)} allocated.`,
      });
    };

    push('university', budget.universityId, 'University total', Number(budget.totalAmount), uni);
    for (const a of allocations) {
      const consumed = a.nodeType === 'school' ? bySchool.get(a.nodeId) || 0 : byDept.get(a.nodeId) || 0;
      const name = a.nodeType === 'school' ? a.school?.facultyName : a.department?.departmentName;
      push(a.nodeType, a.nodeId, name || a.nodeType, Number(a.amount), consumed);
    }
  }
  return { warnings, budgets };
}

/** Write one event per warning (over_budget_warning or over_budget_blocked). */
async function logWarnings(client, warnings, { action, actorId, context }) {
  for (const w of warnings) {
    await client.budgetAllocationEvent.create({
      data: {
        budgetId: w.budgetId,
        cycleId: w.cycleId,
        nodeType: w.nodeType,
        nodeId: w.nodeId,
        nodeName: String(w.nodeName || '').slice(0, 256) || null,
        action,
        oldAmount: w.allocated,
        newAmount: w.consumed,
        details: { ...context, allocated: w.allocated, consumed: w.consumed, over: w.over },
        reason: w.message.slice(0, 2000),
        actorId,
      },
    });
  }
}

/** Public shape of a warning in API responses. */
const publicWarning = ({ budgetId, enforceLimit, ...w }) => w;

module.exports = { assessLines, logWarnings, publicWarning };
