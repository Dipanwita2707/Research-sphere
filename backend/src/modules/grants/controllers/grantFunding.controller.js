/**
 * Grant sanction details and funds actually received (NAAC 3.1.1 / NIRF research funding per FY).
 *
 *   PATCH  /grants/:id/sanction                      { sanctionedAmount, sanctionDate, sanctionOrderNumber }
 *   GET    /grants/:id/fund-receipts
 *   POST   /grants/:id/fund-receipts                 { amount, receivedDate, reference, notes }
 *   DELETE /grants/:id/fund-receipts/:receiptId      { reason? }
 *
 * Writes: DRD grant approvers (grant_approve / research_approve) or a university admin, and only on
 * approved / completed grants. Reads: anyone who may view the grant. Tenant scoping is automatic
 * (the Prisma tenant extension filters reads and stamps universityId on creates).
 */

const prisma = require('../../../shared/config/database');
const { auditService, AuditActionType, AuditModule } = require('../../audit/services/audit.service');
const { financialYearOf } = require('../../finance/services/incentivePayout.service');
const { canViewGrant, hasAnyPermission, GRANT_ACCESS_INCLUDE } = require('../../research/utils/objectAccess');

const FUNDABLE_STATUSES = ['approved', 'completed'];
const MANAGER_PERMISSIONS = ['grant_approve', 'research_approve'];
const MAX_AMOUNT = 1e13; // Decimal(15,2)

class FundingValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.statusCode = 400;
    this.field = field;
  }
}

const isAdmin = (user) => ['admin', 'superadmin'].includes(user?.role);
const canManageFunding = (user) => isAdmin(user) || hasAnyPermission(user, MANAGER_PERMISSIONS);

/** Route guard: DRD grant approver or admin. */
const requireFundingManager = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
  if (!canManageFunding(req.user)) {
    return res.status(403).json({ success: false, message: 'Access denied - grant_approve permission or admin role required' });
  }
  return next();
};

// ── input parsing ───────────────────────────────────────────────────────────

/** Today's calendar date in IST as YYYY-MM-DD. */
const todayIst = (now = new Date()) => new Date(now.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

/** Positive money amount with at most 2 decimals → string for Prisma Decimal. */
function parseAmount(value, field) {
  const raw = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim().replace(/,/g, '') : '';
  if (!raw || !/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new FundingValidationError(`${field} must be a positive amount with at most 2 decimals`, field);
  }
  const n = Number(raw);
  if (!(n > 0)) throw new FundingValidationError(`${field} must be greater than 0`, field);
  if (n >= MAX_AMOUNT) throw new FundingValidationError(`${field} is too large`, field);
  return n.toFixed(2);
}

/** YYYY-MM-DD, a real calendar date, not in the future (IST). Returns a UTC-midnight Date. */
function parsePastDate(value, field, now = new Date()) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw new FundingValidationError(`${field} must be a date in YYYY-MM-DD format`, field);
  }
  const s = value.trim();
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
    throw new FundingValidationError(`${field} is not a valid date`, field);
  }
  if (s > todayIst(now)) throw new FundingValidationError(`${field} cannot be in the future`, field);
  if (s < '1950-01-01') throw new FundingValidationError(`${field} is too far in the past`, field);
  return d;
}

function parseOptionalText(value, field, max) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new FundingValidationError(`${field} must be text`, field);
  const s = value.trim();
  if (s.length > max) throw new FundingValidationError(`${field} must be ${max} characters or fewer`, field);
  return s || null;
}

/** @returns {{ sanctionedAmount: string, sanctionDate: Date, sanctionOrderNumber: string|null }} */
function validateSanctionInput(body = {}, now = new Date()) {
  return {
    sanctionedAmount: parseAmount(body.sanctionedAmount, 'sanctionedAmount'),
    sanctionDate: parsePastDate(body.sanctionDate, 'sanctionDate', now),
    sanctionOrderNumber: parseOptionalText(body.sanctionOrderNumber, 'sanctionOrderNumber', 128),
  };
}

/** @returns {{ amount: string, receivedDate: Date, financialYear: string, reference: string|null, notes: string|null }} */
function validateReceiptInput(body = {}, now = new Date()) {
  const amount = parseAmount(body.amount, 'amount');
  const receivedDate = parsePastDate(body.receivedDate, 'receivedDate', now);
  return {
    amount,
    receivedDate,
    financialYear: financialYearOf(receivedDate),
    reference: parseOptionalText(body.reference, 'reference', 128),
    notes: parseOptionalText(body.notes, 'notes', 2000),
  };
}

// ── serialisation ───────────────────────────────────────────────────────────

const money = (v) => (v === null || v === undefined ? null : Math.round(Number(v) * 100) / 100);
const dateOnly = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const personName = (u) => {
  if (!u) return null;
  const e = u.employeeDetails;
  return e?.displayName || [e?.firstName, e?.lastName].filter(Boolean).join(' ') || u.uid || null;
};

const serializeReceipt = (r) => ({
  id: r.id,
  amount: money(r.amount),
  receivedDate: dateOnly(r.receivedDate),
  financialYear: r.financialYear,
  reference: r.reference,
  notes: r.notes,
  recordedBy: personName(r.recordedBy),
  createdAt: r.createdAt,
});

/** Totals per financial year, newest year first. */
function totalsByFinancialYear(receipts) {
  const map = new Map();
  for (const r of receipts) {
    const cur = map.get(r.financialYear) || { financialYear: r.financialYear, total: 0, count: 0 };
    cur.total = Math.round((cur.total + Number(r.amount)) * 100) / 100;
    cur.count += 1;
    map.set(r.financialYear, cur);
  }
  return [...map.values()].sort((a, b) => b.financialYear.localeCompare(a.financialYear));
}

const RECEIPT_INCLUDE = {
  recordedBy: { select: { uid: true, employeeDetails: { select: { displayName: true, firstName: true, lastName: true } } } },
};

// ── helpers ─────────────────────────────────────────────────────────────────

const GRANT_SELECT = {
  id: true, title: true, status: true, applicationNumber: true, applicantUserId: true, currentReviewerId: true,
  sanctionedAmount: true, sanctionDate: true, sanctionOrderNumber: true,
};

const loadGrant = (id, withAccess = false) =>
  prisma.grantApplication.findUnique({
    where: { id },
    select: withAccess ? { ...GRANT_SELECT, ...GRANT_ACCESS_INCLUDE } : GRANT_SELECT,
  });

const notFound = (res) => res.status(404).json({ success: false, message: 'Grant application not found' });
const notFundable = (res, grant) => res.status(400).json({
  success: false,
  message: `Sanction and fund receipts can only be recorded for approved or completed grants (this one is ${String(grant.status).replace(/_/g, ' ')})`,
  code: 'GRANT_NOT_APPROVED',
});

const handleError = (res, error, fallback) => {
  if (error instanceof FundingValidationError) {
    return res.status(400).json({ success: false, message: error.message, field: error.field });
  }
  if (error.statusCode && error.statusCode < 500) return res.status(error.statusCode).json({ success: false, message: error.message });
  console.error(`${fallback}:`, error);
  return res.status(500).json({ success: false, message: fallback });
};

const historyNote = (tx, grant, userId, comments, metadata) =>
  tx.grantApplicationStatusHistory.create({
    data: {
      grantApplicationId: grant.id,
      fromStatus: grant.status,
      toStatus: grant.status, // not a status change; the note carries the detail
      changedById: userId,
      comments,
      metadata,
    },
  });

const audit = (req, grant, action, oldValues, newValues, details = {}) =>
  auditService.log({
    actorId: req.user.id,
    action: `${action}: ${grant.title || grant.id}`,
    actionType: oldValues && !newValues ? AuditActionType.DELETE : newValues && !oldValues ? AuditActionType.CREATE : AuditActionType.UPDATE,
    module: AuditModule.RESEARCH,
    category: 'grant_funding',
    targetTable: 'grant_application',
    targetId: grant.id,
    oldValues,
    newValues,
    details,
    requestPath: req.originalUrl,
    requestMethod: req.method,
  }).catch(() => {});

const formatInr = (v) => `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// ── handlers ────────────────────────────────────────────────────────────────

exports.updateSanction = async (req, res) => {
  try {
    const input = validateSanctionInput(req.body);
    const grant = await loadGrant(req.params.id);
    if (!grant) return notFound(res);
    if (!FUNDABLE_STATUSES.includes(grant.status)) return notFundable(res, grant);

    const before = {
      sanctionedAmount: money(grant.sanctionedAmount),
      sanctionDate: dateOnly(grant.sanctionDate),
      sanctionOrderNumber: grant.sanctionOrderNumber ?? null,
    };
    const after = {
      sanctionedAmount: Number(input.sanctionedAmount),
      sanctionDate: dateOnly(input.sanctionDate),
      sanctionOrderNumber: input.sanctionOrderNumber,
    };

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.grantApplication.update({ where: { id: grant.id }, data: input, select: GRANT_SELECT });
      await historyNote(
        tx, grant, req.user.id,
        `Sanction recorded: ${formatInr(input.sanctionedAmount)} on ${after.sanctionDate}`
          + (input.sanctionOrderNumber ? ` (order ${input.sanctionOrderNumber})` : ''),
        { type: 'grant_sanction', before, after },
      );
      return row;
    });
    audit(req, grant, 'Recorded grant sanction', before, after);

    return res.json({
      success: true,
      message: 'Sanction details saved',
      data: {
        sanctionedAmount: money(updated.sanctionedAmount),
        sanctionDate: dateOnly(updated.sanctionDate),
        sanctionOrderNumber: updated.sanctionOrderNumber,
      },
    });
  } catch (error) {
    return handleError(res, error, 'Failed to save sanction details');
  }
};

exports.listFundReceipts = async (req, res) => {
  try {
    const grant = await loadGrant(req.params.id, true);
    if (!grant) return notFound(res);
    if (!isAdmin(req.user) && !canViewGrant(req.user, grant)) return notFound(res);

    const rows = await prisma.grantFundReceipt.findMany({
      where: { grantApplicationId: grant.id },
      include: RECEIPT_INCLUDE,
      orderBy: [{ receivedDate: 'desc' }, { createdAt: 'desc' }],
    });
    const receipts = rows.map(serializeReceipt);
    const totalReceived = Math.round(receipts.reduce((s, r) => s + r.amount, 0) * 100) / 100;

    return res.json({
      success: true,
      data: {
        grant: { id: grant.id, status: grant.status, applicationNumber: grant.applicationNumber },
        sanction: {
          sanctionedAmount: money(grant.sanctionedAmount),
          sanctionDate: dateOnly(grant.sanctionDate),
          sanctionOrderNumber: grant.sanctionOrderNumber ?? null,
        },
        receipts,
        totalsByFinancialYear: totalsByFinancialYear(receipts),
        totalReceived,
        canManage: canManageFunding(req.user) && FUNDABLE_STATUSES.includes(grant.status),
      },
    });
  } catch (error) {
    return handleError(res, error, 'Failed to load fund receipts');
  }
};

exports.addFundReceipt = async (req, res) => {
  try {
    const input = validateReceiptInput(req.body);
    const grant = await loadGrant(req.params.id);
    if (!grant) return notFound(res);
    if (!FUNDABLE_STATUSES.includes(grant.status)) return notFundable(res, grant);

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.grantFundReceipt.create({
        data: { grantApplicationId: grant.id, ...input, recordedById: req.user.id },
        include: RECEIPT_INCLUDE,
      });
      await historyNote(
        tx, grant, req.user.id,
        `Funds received: ${formatInr(input.amount)} on ${dateOnly(input.receivedDate)} (FY ${input.financialYear})`
          + (input.reference ? `, ref ${input.reference}` : ''),
        { type: 'grant_fund_receipt_added', receiptId: row.id, amount: Number(input.amount), financialYear: input.financialYear },
      );
      return row;
    });
    const receipt = serializeReceipt(created);
    audit(req, grant, 'Recorded grant fund receipt', null, receipt);

    return res.status(201).json({ success: true, message: 'Fund receipt recorded', data: receipt });
  } catch (error) {
    return handleError(res, error, 'Failed to record fund receipt');
  }
};

exports.deleteFundReceipt = async (req, res) => {
  try {
    const reason = parseOptionalText((req.body || {}).reason, 'reason', 500);
    const grant = await loadGrant(req.params.id);
    if (!grant) return notFound(res);

    const receipt = await prisma.grantFundReceipt.findFirst({
      where: { id: req.params.receiptId, grantApplicationId: grant.id },
      include: RECEIPT_INCLUDE,
    });
    if (!receipt) return res.status(404).json({ success: false, message: 'Fund receipt not found' });
    const snapshot = serializeReceipt(receipt);

    await prisma.$transaction(async (tx) => {
      await tx.grantFundReceipt.delete({ where: { id: receipt.id } });
      await historyNote(
        tx, grant, req.user.id,
        `Fund receipt removed: ${formatInr(snapshot.amount)} on ${snapshot.receivedDate} (FY ${snapshot.financialYear})`
          + (reason ? `. Reason: ${reason}` : ''),
        { type: 'grant_fund_receipt_deleted', receipt: snapshot, reason },
      );
    });
    audit(req, grant, 'Deleted grant fund receipt', snapshot, null, { reason });

    return res.json({ success: true, message: 'Fund receipt deleted' });
  } catch (error) {
    return handleError(res, error, 'Failed to delete fund receipt');
  }
};

exports.requireFundingManager = requireFundingManager;
exports.canManageFunding = canManageFunding;
exports.validateSanctionInput = validateSanctionInput;
exports.validateReceiptInput = validateReceiptInput;
exports.totalsByFinancialYear = totalsByFinancialYear;
exports.FundingValidationError = FundingValidationError;
