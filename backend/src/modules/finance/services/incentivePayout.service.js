/**
 * Incentive payout ledger.
 *
 *   DRD approves a work ──► one line per eligible author: pending_verification
 *   finance reviewer      ──► recommend (or hold / adjust with reason / cancel)
 *   finance reviewer      ──► group recommended lines into a draft batch
 *   finance APPROVER      ──► approve the batch — must be a different person from the batch
 *                             creator and from everyone who recommended its lines, unless the
 *                             university allows self-approval (FinanceSettings), in which case
 *                             that person must give a reason and the batch is marked selfApproved
 *   finance               ──► mark the batch paid with the payroll/bank reference
 *
 * No bank details are stored: payment goes through payroll by employee ID. Every action
 * is written to IncentivePayoutEvent. All queries run inside the request's tenant context.
 *
 * Each line carries the payee's school and department at creation (research budget attribution),
 * and the incentive cycle containing the date that selected its policy (policyDate): the line
 * draws on that cycle's research budget, so policy and budget always belong to the same cycle.
 * Recommending lines and approving a batch report any node pushed over its budget allocation
 * (budgetGuard); with the budget's enforceLimit on, batch approval is refused instead.
 */
const ExcelJS = require('exceljs');
const prisma = require('../../../shared/config/database');
const { neutralizeFormula } = require('../../core/utils/spreadsheet');
const budgetGuard = require('./budgetGuard');
const { utcDay, cycleContaining } = require('../../research/utils/policyCycle');

const OPEN_LINE_STATUSES = ['pending_verification', 'recommended', 'on_hold'];

class PayoutError extends Error {
  constructor(statusCode, message, code = 'PAYOUT_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

const money = (v) => (v == null ? null : Number(v));
const round2 = (n) => Math.round(Number(n) * 100) / 100;

/** Indian financial year (April–March) in IST, e.g. 2026-10-02 → "2026-27". */
function financialYearOf(date = new Date()) {
  const ist = new Date(new Date(date).getTime() + 5.5 * 3600 * 1000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

function serializeLine(l) {
  if (!l) return l;
  return {
    ...l,
    calculatedAmount: money(l.calculatedAmount),
    approvedAmount: money(l.approvedAmount),
    tdsAmount: money(l.tdsAmount),
    netAmount: l.approvedAmount == null ? null : round2(Number(l.approvedAmount) - Number(l.tdsAmount || 0)),
  };
}

function serializeBatch(b) {
  if (!b) return b;
  return { ...b, totalAmount: money(b.totalAmount), payouts: b.payouts ? b.payouts.map(serializeLine) : undefined };
}

async function logEvent(client, { universityId, payoutId = null, batchId = null, action, fromStatus = null, toStatus = null, amount = null, comments = null, actorId }) {
  await client.incentivePayoutEvent.create({
    data: { universityId, payoutId, batchId, action, fromStatus, toStatus, amount, comments, actorId },
  });
}

function requireReason(reason, what) {
  const text = String(reason || '').trim();
  if (text.length < 3) throw new PayoutError(400, `A reason is required to ${what}`, 'REASON_REQUIRED');
  return text.slice(0, 2000);
}

// ─── Creating lines (called from DRD / grant / IPR approval) ─────────────────

/**
 * Create payable lines for the internal authors of an approved contribution.
 * Idempotent: re-running for the same contribution creates nothing new, and an author is
 * never given two live lines for the same work (workKey) even across duplicate claims.
 *
 * @param {object} tx Prisma transaction client
 * The policy was chosen by the publication date (today when there is none), so that date
 * also picks the line's incentive cycle.
 * @param {{ contribution: object, authorShares: object[], approvedAt?: Date, actorId: string }} p
 */
async function createLinesForContribution(tx, { contribution, authorShares, approvedAt = new Date(), actorId }) {
  const eligible = (authorShares || []).filter(
    // Points are recorded on the author; finance only handles money, so ₹0 authors get no line.
    (a) => a.userId && a.isInternal !== false && Number(a.incentiveShare) > 0,
  );
  return createLines(tx, {
    universityId: contribution.universityId,
    sourceType: 'research_contribution',
    sourceId: contribution.id,
    researchContributionId: contribution.id,
    workType: contribution.publicationType,
    title: contribution.title,
    referenceNumber: contribution.applicationNumber,
    workKey: contribution.workKey || null,
    approvedAt,
    policyDate: contribution.publicationDate || approvedAt,
    actorId,
    payees: eligible.map((a) => ({
      userId: a.userId,
      name: a.name,
      role: a.authorType || null,
      amount: Number(a.incentiveShare) || 0,
      points: Number(a.pointsShare) || 0,
    })),
  });
}

/**
 * School/department of each payee, for budget attribution: always the unit the PERSON belongs to,
 * never the work's own school/department (a contribution, IPR or grant may name another school)
 * and never the finance or DRD user acting. Each payee of a multi-author work is attributed
 * separately, so co-authors from different schools charge their own schools.
 *   Employees: primary department (its school wins, so a department always sits under its own
 *              school), else primary school.
 *   Students:  the department running their programme (directly, or via their section's programme).
 *   Neither:   unassigned (null) — counted against the university total only.
 */
async function attributionFor(tx, employees, studentUserIds) {
  const out = new Map();
  for (const e of employees) {
    const schoolId = e.primaryDepartment?.facultyId || e.primarySchoolId || null;
    if (schoolId) out.set(e.userLoginId, { schoolId, departmentId: e.primaryDepartmentId || null });
  }
  const missingStudents = studentUserIds.filter((id) => !out.has(id));
  if (missingStudents.length) {
    const rows = await tx.studentDetails.findMany({
      where: { userLoginId: { in: missingStudents } },
      select: {
        userLoginId: true,
        program: { select: { departmentId: true, department: { select: { facultyId: true } } } },
        section: { select: { program: { select: { departmentId: true, department: { select: { facultyId: true } } } } } },
      },
    });
    for (const r of rows) {
      const program = r.program?.departmentId ? r.program : r.section?.program;
      const dept = program?.departmentId;
      if (dept && program.department?.facultyId) out.set(r.userLoginId, { schoolId: program.department.facultyId, departmentId: dept });
    }
  }
  return out;
}

/**
 * Generic line creation (grants and IPR use this directly).
 * @param {object} tx
 * @param {{ universityId, sourceType, sourceId, researchContributionId?, workType, title, referenceNumber?,
 *           workKey?, approvedAt, policyDate?, actorId, payees: {userId,name,role?,amount,points}[] }} p
 *   policyDate: the date that selected the incentive policy (defaults to approvedAt); the line is
 *   charged to the incentive cycle containing it.
 */
async function createLines(tx, p) {
  if (!p.payees.length) return { created: 0, skippedDuplicates: 0 };
  const payeeIds = [...new Set(p.payees.map((x) => x.userId))];

  const [employees, students, alreadyPaidForWork] = await Promise.all([
    tx.employeeDetails.findMany({
      where: { userLoginId: { in: payeeIds } },
      select: {
        userLoginId: true, empId: true, primarySchoolId: true, primaryDepartmentId: true,
        primaryDepartment: { select: { facultyId: true } },
      },
    }),
    // Students are paid money only, never research points (every source type).
    tx.userLogin.findMany({ where: { id: { in: payeeIds }, role: 'student' }, select: { id: true } }),
    p.workKey
      ? tx.incentivePayout.findMany({
          where: { workKey: p.workKey, payeeUserId: { in: payeeIds }, NOT: { sourceId: p.sourceId } },
          select: { payeeUserId: true },
        })
      : [],
  ]);
  const empIdOf = new Map(employees.map((e) => [e.userLoginId, e.empId]));
  const blocked = new Set(alreadyPaidForWork.map((r) => r.payeeUserId));
  const studentIds = new Set(students.map((u) => u.id));
  const financialYear = financialYearOf(p.approvedAt);
  const policyDay = utcDay(p.policyDate || p.approvedAt);
  const cycle = await cycleContaining(tx.incentiveCycle, policyDay);
  const unitOf = await attributionFor(tx, employees, [...studentIds]);

  const rows = [];
  for (const payee of p.payees) {
    if (blocked.has(payee.userId)) continue; // already has a live line for this work via another claim
    if (!(Number(payee.amount) > 0)) continue; // nothing to pay
    rows.push({
      universityId: p.universityId,
      sourceType: p.sourceType,
      sourceId: p.sourceId,
      researchContributionId: p.researchContributionId || null,
      workType: String(p.workType || 'other').slice(0, 32),
      title: String(p.title || 'Untitled').slice(0, 512),
      referenceNumber: p.referenceNumber || null,
      workKey: p.workKey || null,
      payeeUserId: payee.userId,
      payeeName: String(payee.name || 'Unknown').slice(0, 256),
      payeeEmployeeId: empIdOf.get(payee.userId) || null,
      payeeRole: payee.role ? String(payee.role).slice(0, 64) : null,
      schoolId: unitOf.get(payee.userId)?.schoolId || null,
      departmentId: unitOf.get(payee.userId)?.departmentId || null,
      calculatedAmount: round2(payee.amount),
      approvedAmount: round2(payee.amount),
      points: studentIds.has(payee.userId) ? 0 : Math.max(0, Math.round(payee.points || 0)),
      financialYear,
      cycleId: cycle?.id || null,
      policyDate: policyDay,
      sourceApprovedAt: p.approvedAt,
    });
  }

  const result = rows.length ? await tx.incentivePayout.createMany({ data: rows, skipDuplicates: true }) : { count: 0 };
  if (blocked.size) {
    await logEvent(tx, {
      universityId: p.universityId,
      action: 'duplicate_skipped',
      comments: `Not created for ${blocked.size} author(s) who already have a payout for this work (${p.workKey}). Source ${p.sourceType} ${p.sourceId}.`,
      actorId: p.actorId,
    });
  }
  return { created: result.count, skippedDuplicates: blocked.size };
}

// ─── Line actions (finance reviewer) ────────────────────────────────────────

async function loadLine(client, id) {
  const line = await client.incentivePayout.findUnique({ where: { id } });
  if (!line) throw new PayoutError(404, 'Payout line not found', 'NOT_FOUND');
  return line;
}

/** Recommend lines for payment. Only lines awaiting verification or on hold. */
async function recommend(ids, actor, comments = null) {
  if (!Array.isArray(ids) || !ids.length) throw new PayoutError(400, 'Select at least one payout line');
  return prisma.$transaction(async (tx) => {
    const lines = await tx.incentivePayout.findMany({ where: { id: { in: ids } } });
    if (lines.length !== new Set(ids).size) throw new PayoutError(404, 'One or more payout lines were not found', 'NOT_FOUND');
    const invalid = lines.filter((l) => !['pending_verification', 'on_hold'].includes(l.status) || l.batchId);
    if (invalid.length) {
      throw new PayoutError(409, `${invalid.length} line(s) cannot be recommended in their current status`, 'INVALID_STATUS');
    }
    const now = new Date();
    for (const l of lines) {
      await tx.incentivePayout.update({
        where: { id: l.id },
        data: { status: 'recommended', recommendedById: actor.id, recommendedAt: now, holdReason: null },
      });
      await logEvent(tx, { universityId: l.universityId, payoutId: l.id, action: 'recommended', fromStatus: l.status, toStatus: 'recommended', amount: l.approvedAmount, comments, actorId: actor.id });
    }
    // Over-budget is a warning here, never a block (enforceLimit applies at batch approval).
    const { warnings } = await budgetGuard.assessLines(tx, lines);
    await budgetGuard.logWarnings(tx, warnings, { action: 'over_budget_warning', actorId: actor.id, context: { trigger: 'recommend', payoutIds: ids.slice(0, 200) } });
    return { recommended: lines.length, budgetWarnings: warnings.map(budgetGuard.publicWarning) };
  });
}

async function hold(id, actor, reason) {
  const text = requireReason(reason, 'put a payout on hold');
  return prisma.$transaction(async (tx) => {
    const l = await loadLine(tx, id);
    if (!['pending_verification', 'recommended'].includes(l.status) || l.batchId) {
      throw new PayoutError(409, 'Only unbatched lines awaiting verification or recommended can be put on hold', 'INVALID_STATUS');
    }
    const updated = await tx.incentivePayout.update({ where: { id }, data: { status: 'on_hold', holdReason: text, recommendedById: null, recommendedAt: null } });
    await logEvent(tx, { universityId: l.universityId, payoutId: id, action: 'held', fromStatus: l.status, toStatus: 'on_hold', comments: text, actorId: actor.id });
    return serializeLine(updated);
  });
}

/** Change the amount to pay (e.g. policy correction). Resets any recommendation. */
async function adjust(id, actor, amount, reason) {
  const text = requireReason(reason, 'change a payout amount');
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) throw new PayoutError(400, 'Amount must be zero or more', 'INVALID_AMOUNT');
  return prisma.$transaction(async (tx) => {
    const l = await loadLine(tx, id);
    if (!OPEN_LINE_STATUSES.includes(l.status) || l.batchId) {
      throw new PayoutError(409, 'Only unbatched open lines can be adjusted', 'INVALID_STATUS');
    }
    const updated = await tx.incentivePayout.update({
      where: { id },
      data: { approvedAmount: round2(value), adjustmentReason: text, status: 'pending_verification', recommendedById: null, recommendedAt: null },
    });
    await logEvent(tx, {
      universityId: l.universityId, payoutId: id, action: 'adjusted', fromStatus: l.status, toStatus: 'pending_verification',
      amount: round2(value), comments: `${money(l.approvedAmount)} → ${round2(value)}: ${text}`, actorId: actor.id,
    });
    return serializeLine(updated);
  });
}

async function cancel(id, actor, reason) {
  const text = requireReason(reason, 'cancel a payout');
  return prisma.$transaction(async (tx) => {
    const l = await loadLine(tx, id);
    if (!OPEN_LINE_STATUSES.includes(l.status) || l.batchId) {
      throw new PayoutError(409, 'Only unbatched open lines can be cancelled', 'INVALID_STATUS');
    }
    // Clearing workKey frees the work so a corrected claim can be paid later.
    const updated = await tx.incentivePayout.update({ where: { id }, data: { status: 'cancelled', holdReason: text, workKey: null } });
    await logEvent(tx, { universityId: l.universityId, payoutId: id, action: 'cancelled', fromStatus: l.status, toStatus: 'cancelled', comments: text, actorId: actor.id });
    return serializeLine(updated);
  });
}

// ─── Batches ────────────────────────────────────────────────────────────────

async function nextBatchNumber(tx, financialYear) {
  const prefix = `PB-${financialYear}-`;
  const last = await tx.payoutBatch.findFirst({
    where: { batchNumber: { startsWith: prefix } },
    orderBy: { batchNumber: 'desc' },
    select: { batchNumber: true },
  });
  const n = last ? parseInt(last.batchNumber.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(n).padStart(4, '0')}`;
}

async function createBatch(ids, actor, { title = null } = {}) {
  if (!Array.isArray(ids) || !ids.length) throw new PayoutError(400, 'Select at least one recommended payout line');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const lines = await tx.incentivePayout.findMany({ where: { id: { in: ids } } });
        if (lines.length !== new Set(ids).size) throw new PayoutError(404, 'One or more payout lines were not found', 'NOT_FOUND');
        const invalid = lines.filter((l) => l.status !== 'recommended' || l.batchId);
        if (invalid.length) throw new PayoutError(409, `${invalid.length} line(s) are not recommended or are already in a batch`, 'INVALID_STATUS');

        const financialYear = financialYearOf(new Date());
        const total = round2(lines.reduce((s, l) => s + Number(l.approvedAmount), 0));
        const batch = await tx.payoutBatch.create({
          data: {
            universityId: lines[0].universityId,
            batchNumber: await nextBatchNumber(tx, financialYear),
            title: title ? String(title).slice(0, 256) : null,
            financialYear,
            totalAmount: total,
            lineCount: lines.length,
            createdById: actor.id,
          },
        });
        const moved = await tx.incentivePayout.updateMany({
          where: { id: { in: ids }, status: 'recommended', batchId: null },
          data: { batchId: batch.id },
        });
        if (moved.count !== lines.length) throw new PayoutError(409, 'Payout lines changed meanwhile. Refresh and try again.', 'CONFLICT');
        await logEvent(tx, { universityId: batch.universityId, batchId: batch.id, action: 'batch_created', toStatus: 'draft', amount: total, comments: `${lines.length} line(s)`, actorId: actor.id });
        return serializeBatch(batch);
      });
    } catch (e) {
      if (e.code === 'P2002' && attempt < 2) continue; // batch number race; regenerate
      throw e;
    }
  }
  throw new PayoutError(409, 'Could not allocate a batch number. Try again.', 'CONFLICT');
}

async function loadBatch(client, id) {
  const b = await client.payoutBatch.findUnique({ where: { id }, include: { payouts: true } });
  if (!b) throw new PayoutError(404, 'Payout batch not found', 'NOT_FOUND');
  return b;
}

/** Why `actor` has a conflict approving batch `b` (prepared it / recommended lines), or null. */
function approvalConflict(b, actorId) {
  if (b.createdById === actorId) return 'prepared the batch';
  const mine = (b.payouts || []).filter((l) => l.recommendedById === actorId).length;
  return mine ? `recommended ${mine} of its line${mine === 1 ? '' : 's'}` : null;
}

/**
 * Separation of duties: the approver did not create the batch nor recommend any of its lines.
 * When the university allows self-approval (FinanceSettings.allowSelfApproval) that person may
 * approve with a reason of at least 10 characters; the batch is marked selfApproved and the
 * reason is logged as a batch_self_approved event.
 * Budget: nodes left over their allocation are returned as `budgetWarnings`; when that budget's
 * enforceLimit is on the approval is refused with 409 BUDGET_EXCEEDED (and the block is logged).
 */
async function approveBatch(id, actor, comments = null, { selfApprovalReason = null } = {}) {
  let blocked = null;
  try {
    return await approveBatchTx(id, actor, comments, (w) => { blocked = w; }, selfApprovalReason);
  } catch (e) {
    if (blocked && e.code === 'BUDGET_EXCEEDED') {
      // The transaction rolled back; record the refusal outside it.
      await budgetGuard
        .logWarnings(prisma, blocked, { action: 'over_budget_blocked', actorId: actor.id, context: { trigger: 'batch_approval', batchId: id } })
        .catch(() => {});
    }
    throw e;
  }
}

async function approveBatchTx(id, actor, comments, onBlocked, selfApprovalReason = null) {
  return prisma.$transaction(async (tx) => {
    const b = await loadBatch(tx, id);
    if (b.status !== 'draft') throw new PayoutError(409, `Batch is ${b.status}, not awaiting approval`, 'INVALID_STATUS');
    if (!b.payouts.length) throw new PayoutError(409, 'Batch has no payout lines', 'EMPTY_BATCH');
    const conflict = approvalConflict(b, actor.id);
    let selfReason = null;
    if (conflict) {
      const settings = await tx.financeSettings.findFirst({ select: { allowSelfApproval: true } });
      if (!settings?.allowSelfApproval) {
        throw new PayoutError(403, 'You prepared or recommended this batch, so someone else must approve it', 'SEPARATION_OF_DUTIES');
      }
      selfReason = String(selfApprovalReason || '').trim();
      if (selfReason.length < 10) {
        throw new PayoutError(400, `You ${conflict}. Self-approval is allowed here, but give a reason (at least 10 characters).`, 'SELF_APPROVAL_REASON_REQUIRED');
      }
      selfReason = selfReason.slice(0, 2000);
    }
    const now = new Date();
    const moved = await tx.incentivePayout.updateMany({ where: { batchId: id, status: 'recommended' }, data: { status: 'approved' } });
    if (moved.count !== b.payouts.length) throw new PayoutError(409, 'Batch lines changed meanwhile. Refresh and try again.', 'CONFLICT');
    const { warnings } = await budgetGuard.assessLines(tx, b.payouts);
    const enforced = warnings.filter((w) => w.enforceLimit);
    if (enforced.length) {
      onBlocked(enforced);
      const who = enforced.length === 1 ? enforced[0].nodeName : `${enforced.length} budget nodes`;
      const err = new PayoutError(
        409,
        `Approving ${b.batchNumber} would leave ${who} over the research budget, and this budget enforces its limits. ${enforced[0].message}`,
        'BUDGET_EXCEEDED',
      );
      err.details = { budgetWarnings: enforced.map(budgetGuard.publicWarning) };
      throw err;
    }
    await budgetGuard.logWarnings(tx, warnings, { action: 'over_budget_warning', actorId: actor.id, context: { trigger: 'batch_approval', batchId: id } });
    const updated = await tx.payoutBatch.update({
      where: { id },
      data: { status: 'approved', approvedById: actor.id, approvedAt: now, approvalComments: comments ? String(comments).slice(0, 2000) : null, selfApproved: !!conflict },
    });
    await logEvent(tx, {
      universityId: b.universityId, batchId: id, action: conflict ? 'batch_self_approved' : 'batch_approved', fromStatus: 'draft', toStatus: 'approved', amount: b.totalAmount,
      comments: conflict ? `Self-approved (approver ${conflict}): ${selfReason}${comments ? ` — ${String(comments).slice(0, 500)}` : ''}` : comments,
      actorId: actor.id,
    });
    return { ...serializeBatch(updated), budgetWarnings: warnings.map(budgetGuard.publicWarning) };
  });
}

/**
 * Record payment. `paymentReference` (UTR / voucher / payroll run) and `paymentDate` are required.
 * Optional per-line TDS: { [payoutId]: amount }.
 */
async function markBatchPaid(id, actor, { paymentReference, paymentDate, tds = {} } = {}) {
  const ref = String(paymentReference || '').trim();
  if (ref.length < 3) throw new PayoutError(400, 'Payment reference (UTR / voucher / payroll run) is required', 'REFERENCE_REQUIRED');
  const date = paymentDate ? new Date(paymentDate) : null;
  if (!date || Number.isNaN(date.getTime())) throw new PayoutError(400, 'Payment date is required', 'DATE_REQUIRED');
  if (date.getTime() > Date.now() + 24 * 3600 * 1000) throw new PayoutError(400, 'Payment date cannot be in the future', 'DATE_INVALID');

  return prisma.$transaction(async (tx) => {
    const b = await loadBatch(tx, id);
    if (b.status !== 'approved') throw new PayoutError(409, 'Only approved batches can be marked paid', 'INVALID_STATUS');
    const now = new Date();
    for (const l of b.payouts) {
      const t = tds[l.id] != null ? Number(tds[l.id]) : null;
      if (t != null && (!Number.isFinite(t) || t < 0 || t > Number(l.approvedAmount))) {
        throw new PayoutError(400, `TDS for ${l.payeeName} must be between 0 and the payout amount`, 'INVALID_TDS');
      }
      await tx.incentivePayout.update({
        where: { id: l.id },
        data: { status: 'paid', paidAt: now, paymentReference: ref.slice(0, 64), ...(t != null ? { tdsAmount: round2(t) } : {}) },
      });
    }
    const updated = await tx.payoutBatch.update({
      where: { id },
      data: { status: 'paid', paidById: actor.id, paidAt: now, paymentDate: date, paymentReference: ref.slice(0, 64) },
    });
    await logEvent(tx, { universityId: b.universityId, batchId: id, action: 'batch_paid', fromStatus: 'approved', toStatus: 'paid', amount: b.totalAmount, comments: ref, actorId: actor.id });
    return serializeBatch(updated);
  });
}

/** Cancel a draft batch; its lines go back to "recommended" so they can be re-batched. */
async function cancelBatch(id, actor, reason) {
  const text = requireReason(reason, 'cancel a batch');
  return prisma.$transaction(async (tx) => {
    const b = await loadBatch(tx, id);
    if (b.status !== 'draft') throw new PayoutError(409, 'Only draft batches can be cancelled', 'INVALID_STATUS');
    await tx.incentivePayout.updateMany({ where: { batchId: id }, data: { batchId: null } });
    const updated = await tx.payoutBatch.update({ where: { id }, data: { status: 'cancelled', cancelledReason: text } });
    await logEvent(tx, { universityId: b.universityId, batchId: id, action: 'batch_cancelled', fromStatus: 'draft', toStatus: 'cancelled', comments: text, actorId: actor.id });
    return serializeBatch(updated);
  });
}

// ─── Queries ────────────────────────────────────────────────────────────────

const LINE_SORT = { createdAt: 'desc' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** schoolId / departmentId filter for payout lines; schoolId "unassigned" = lines with no school. */
function unitFilter(schoolId, departmentId) {
  const out = {};
  if (schoolId === 'unassigned') out.schoolId = null;
  else if (schoolId) {
    if (!UUID_RE.test(String(schoolId))) throw new PayoutError(400, 'Invalid school filter', 'INVALID_FILTER');
    out.schoolId = String(schoolId);
  }
  if (departmentId) {
    if (!UUID_RE.test(String(departmentId))) throw new PayoutError(400, 'Invalid department filter', 'INVALID_FILTER');
    out.departmentId = String(departmentId);
  }
  return out;
}

const UNIT_INCLUDE = {
  school: { select: { id: true, facultyName: true, facultyCode: true } },
  department: { select: { id: true, departmentName: true, departmentCode: true } },
};

/** cycleId filter: a cycle id, or "none" for lines outside every cycle. */
function cycleFilter(cycleId) {
  if (!cycleId) return {};
  if (cycleId === 'none') return { cycleId: null };
  if (!UUID_RE.test(String(cycleId))) throw new PayoutError(400, 'Unknown incentive cycle', 'INVALID_CYCLE');
  return { cycleId };
}

async function listPayouts({ status, financialYear, cycleId, workType, search, batchId, payeeUserId, schoolId, departmentId, page = 1, limit = 50, withStatusCounts } = {}) {
  const take = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;
  const filters = {
    ...(financialYear ? { financialYear } : {}),
    ...cycleFilter(cycleId),
    ...(workType ? { workType } : {}),
    ...(batchId ? { batchId } : {}),
    ...(payeeUserId ? { payeeUserId } : {}),
    ...unitFilter(schoolId, departmentId),
    ...(search
      ? { OR: [
          { title: { contains: String(search), mode: 'insensitive' } },
          { payeeName: { contains: String(search), mode: 'insensitive' } },
          { payeeEmployeeId: { contains: String(search), mode: 'insensitive' } },
          { referenceNumber: { contains: String(search), mode: 'insensitive' } },
        ] }
      : {}),
  };
  const where = { ...filters, ...(status ? { status: { in: String(status).split(',') } } : {}) };
  const wantCounts = withStatusCounts === true || withStatusCounts === 'true' || withStatusCounts === '1';
  const [rows, total, sums, byStatus] = await Promise.all([
    prisma.incentivePayout.findMany({ where, orderBy: LINE_SORT, skip, take, include: { batch: { select: { id: true, batchNumber: true, status: true } }, ...UNIT_INCLUDE } }),
    prisma.incentivePayout.count({ where }),
    prisma.incentivePayout.aggregate({ where, _sum: { approvedAmount: true } }),
    // Queue tab badges: per-status totals for the same filters, in this one request.
    wantCounts
      ? prisma.incentivePayout.groupBy({ by: ['status'], where: filters, _count: true, _sum: { approvedAmount: true } })
      : null,
  ]);
  const result = { items: rows.map(serializeLine), total, page: skip / take + 1, limit: take, totalAmount: money(sums._sum.approvedAmount) || 0 };
  if (byStatus) {
    result.statusCounts = Object.fromEntries(byStatus.map((g) => [g.status, { count: g._count, amount: money(g._sum.approvedAmount) || 0 }]));
  }
  return result;
}

async function getPayout(id) {
  const line = await prisma.incentivePayout.findUnique({
    where: { id },
    include: {
      batch: { select: { id: true, batchNumber: true, status: true } },
      ...UNIT_INCLUDE,
      events: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { uid: true, employeeDetails: { select: { displayName: true, firstName: true, lastName: true } } } } } },
    },
  });
  if (!line) throw new PayoutError(404, 'Payout line not found', 'NOT_FOUND');
  return serializeLine(line);
}

const PERSON = { select: { id: true, uid: true, employeeDetails: { select: { displayName: true, firstName: true, lastName: true } } } };

async function listBatches({ status, financialYear } = {}) {
  const rows = await prisma.payoutBatch.findMany({
    where: { ...(status ? { status } : {}), ...(financialYear ? { financialYear } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { createdBy: PERSON, approvedBy: PERSON, paidBy: PERSON },
  });
  return rows.map(serializeBatch);
}

async function getBatch(id) {
  const b = await prisma.payoutBatch.findUnique({
    where: { id },
    include: {
      payouts: { orderBy: { payeeName: 'asc' } },
      events: { orderBy: { createdAt: 'asc' }, include: { actor: PERSON } },
      createdBy: PERSON,
      approvedBy: PERSON,
      paidBy: PERSON,
    },
  });
  if (!b) throw new PayoutError(404, 'Payout batch not found', 'NOT_FOUND');
  return serializeBatch(b);
}

/** Finance dashboard figures for one financial year (defaults to the current one). */
async function dashboard({ financialYear = financialYearOf() } = {}) {
  const where = { financialYear, NOT: { status: 'cancelled' } };
  const [byStatus, byType, byMonthRaw, topPayees, batches, onHold] = await Promise.all([
    prisma.incentivePayout.groupBy({ by: ['status'], where: { financialYear }, _count: true, _sum: { approvedAmount: true } }),
    prisma.incentivePayout.groupBy({ by: ['workType'], where, _count: true, _sum: { approvedAmount: true } }),
    prisma.incentivePayout.findMany({ where: { ...where, status: 'paid' }, select: { paidAt: true, approvedAmount: true } }),
    prisma.incentivePayout.groupBy({
      by: ['payeeUserId', 'payeeName', 'payeeEmployeeId'], where, _sum: { approvedAmount: true }, _count: true,
      orderBy: { _sum: { approvedAmount: 'desc' } }, take: 10,
    }),
    prisma.payoutBatch.groupBy({ by: ['status'], where: { financialYear }, _count: true, _sum: { totalAmount: true } }),
    prisma.incentivePayout.count({ where: { financialYear, status: 'on_hold' } }),
  ]);

  const statusTotals = Object.fromEntries(byStatus.map((s) => [s.status, { count: s._count, amount: money(s._sum.approvedAmount) || 0 }]));
  const months = new Map();
  for (const r of byMonthRaw) {
    if (!r.paidAt) continue;
    const key = r.paidAt.toISOString().slice(0, 7);
    months.set(key, round2((months.get(key) || 0) + Number(r.approvedAmount)));
  }
  const sum = (keys) => round2(keys.reduce((s, k) => s + (statusTotals[k]?.amount || 0), 0));

  return {
    financialYear,
    totals: {
      liability: sum(['pending_verification', 'recommended', 'on_hold', 'approved']),
      awaitingVerification: statusTotals.pending_verification || { count: 0, amount: 0 },
      recommended: statusTotals.recommended || { count: 0, amount: 0 },
      onHold: statusTotals.on_hold || { count: onHold, amount: 0 },
      approved: statusTotals.approved || { count: 0, amount: 0 },
      paid: statusTotals.paid || { count: 0, amount: 0 },
    },
    byWorkType: byType.map((t) => ({ workType: t.workType, count: t._count, amount: money(t._sum.approvedAmount) || 0 })),
    paidByMonth: [...months.entries()].sort().map(([month, amount]) => ({ month, amount })),
    topPayees: topPayees.map((p) => ({ userId: p.payeeUserId, name: p.payeeName, employeeId: p.payeeEmployeeId, count: p._count, amount: money(p._sum.approvedAmount) || 0 })),
    batches: Object.fromEntries(batches.map((b) => [b.status, { count: b._count, amount: money(b._sum.totalAmount) || 0 }])),
  };
}

/** An author's own incentive statement. */
async function myPayouts(userId, { financialYear } = {}) {
  const rows = await prisma.incentivePayout.findMany({
    where: { payeeUserId: userId, NOT: { status: 'cancelled' }, ...(financialYear ? { financialYear } : {}) },
    orderBy: { sourceApprovedAt: 'desc' },
    select: {
      id: true, sourceType: true, sourceId: true, researchContributionId: true,
      workType: true, title: true, referenceNumber: true, approvedAmount: true, points: true, status: true,
      financialYear: true, sourceApprovedAt: true, paidAt: true, paymentReference: true, tdsAmount: true, holdReason: true,
    },
  });
  const items = rows.map(serializeLine);
  const total = (st) => round2(items.filter((i) => st.includes(i.status)).reduce((s, i) => s + i.approvedAmount, 0));
  return {
    items,
    summary: {
      paid: total(['paid']),
      inProcess: total(['pending_verification', 'recommended', 'approved']),
      onHold: total(['on_hold']),
      points: items.reduce((s, i) => s + (i.points || 0), 0),
    },
  };
}

/** Payroll/bank sheet for a batch (xlsx). Approved or paid batches only. */
async function exportBatch(id) {
  const b = await getBatch(id);
  if (!['approved', 'paid'].includes(b.status)) throw new PayoutError(409, 'Only approved or paid batches can be exported', 'INVALID_STATUS');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ResearchSphere';
  const ws = wb.addWorksheet(b.batchNumber);
  ws.columns = [
    { header: 'S.No', key: 'n', width: 6 },
    { header: 'Employee ID', key: 'emp', width: 14 },
    { header: 'Name', key: 'name', width: 28 },
    { header: 'Work type', key: 'type', width: 16 },
    { header: 'Reference', key: 'ref', width: 16 },
    { header: 'Title', key: 'title', width: 50 },
    { header: 'Amount (₹)', key: 'amount', width: 14 },
    { header: 'TDS (₹)', key: 'tds', width: 12 },
    { header: 'Net (₹)', key: 'net', width: 14 },
    { header: 'Payment reference', key: 'pref', width: 20 },
  ];
  ws.getRow(1).font = { bold: true };
  b.payouts.forEach((l, i) => {
    ws.addRow({
      n: i + 1,
      emp: neutralizeFormula(l.payeeEmployeeId || ''),
      name: neutralizeFormula(l.payeeName),
      type: l.workType,
      ref: neutralizeFormula(l.referenceNumber || ''),
      title: neutralizeFormula(l.title),
      amount: l.approvedAmount,
      tds: l.tdsAmount || 0,
      net: l.netAmount,
      pref: neutralizeFormula(l.paymentReference || ''),
    });
  });
  const totalRow = ws.addRow({ name: 'Total', amount: b.totalAmount });
  totalRow.font = { bold: true };
  ['amount', 'tds', 'net'].forEach((k) => { ws.getColumn(k).numFmt = '#,##0.00'; });
  return { filename: `${b.batchNumber}.xlsx`, buffer: await wb.xlsx.writeBuffer() };
}

module.exports = {
  PayoutError,
  unitFilter,
  financialYearOf,
  createLinesForContribution,
  createLines,
  recommend,
  hold,
  adjust,
  cancel,
  createBatch,
  approveBatch,
  markBatchPaid,
  cancelBatch,
  listPayouts,
  getPayout,
  listBatches,
  getBatch,
  dashboard,
  myPayouts,
  exportBatch,
};
