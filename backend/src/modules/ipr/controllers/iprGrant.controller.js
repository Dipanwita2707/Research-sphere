/**
 * Record that a patent has been granted by the patent office (NIRF: patents granted).
 *
 * PATCH /ipr/:id/granted  { grantedAt: 'YYYY-MM-DD', patentNumber }   → mark as granted
 *                         { grantedAt: null, patentNumber: null }      → clear a wrong entry
 *
 * Patents only, and only once published (published / finance stages / completed).
 * Guard: DRD IPR approvers (ipr_approve) or a university admin. Tenant scoping is automatic.
 */

const prisma = require('../../../shared/config/database');
const { auditService, AuditActionType, AuditModule } = require('../../audit/services/audit.service');
const { hasAnyPermission } = require('../../research/utils/objectAccess');

const GRANTABLE_STATUSES = ['published', 'under_finance_review', 'finance_approved', 'finance_rejected', 'completed'];

class IprGrantValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.statusCode = 400;
    this.field = field;
  }
}

const isAdmin = (user) => ['admin', 'superadmin'].includes(user?.role);

/** Route guard: DRD IPR approver or admin. */
const requireIprGrantManager = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
  if (!isAdmin(req.user) && !hasAnyPermission(req.user, ['ipr_approve'])) {
    return res.status(403).json({ success: false, message: 'Access denied - ipr_approve permission or admin role required' });
  }
  return next();
};

const todayIst = (now = new Date()) => new Date(now.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

/**
 * @returns {{ grantedAt: Date|null, patentNumber: string|null }}
 * @throws {IprGrantValidationError}
 */
function validateGrantedInput(body = {}, now = new Date()) {
  const { grantedAt, patentNumber } = body;
  const clearing = (grantedAt === null || grantedAt === '') && (patentNumber === null || patentNumber === '' || patentNumber === undefined);
  if (clearing) return { grantedAt: null, patentNumber: null };

  if (typeof grantedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(grantedAt.trim())) {
    throw new IprGrantValidationError('grantedAt must be a date in YYYY-MM-DD format', 'grantedAt');
  }
  const s = grantedAt.trim();
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
    throw new IprGrantValidationError('grantedAt is not a valid date', 'grantedAt');
  }
  if (s > todayIst(now)) throw new IprGrantValidationError('grantedAt cannot be in the future', 'grantedAt');

  const num = typeof patentNumber === 'string' ? patentNumber.trim() : '';
  if (!num) throw new IprGrantValidationError('patentNumber is required', 'patentNumber');
  if (num.length > 64) throw new IprGrantValidationError('patentNumber must be 64 characters or fewer', 'patentNumber');
  if (!/^[A-Za-z0-9][A-Za-z0-9 ./\-]*$/.test(num)) {
    throw new IprGrantValidationError('patentNumber may contain only letters, digits, spaces, "/", "-" and "."', 'patentNumber');
  }
  return { grantedAt: d, patentNumber: num };
}

const dateOnly = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

exports.markGranted = async (req, res) => {
  try {
    const input = validateGrantedInput(req.body);

    const application = await prisma.iprApplication.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, title: true, status: true, iprType: true, applicantUserId: true,
        publicationDate: true, grantedAt: true, patentNumber: true,
      },
    });
    if (!application) return res.status(404).json({ success: false, message: 'IPR application not found' });
    if (application.iprType !== 'patent') {
      return res.status(400).json({ success: false, message: 'Only patents can be marked as granted' });
    }
    if (!GRANTABLE_STATUSES.includes(application.status)) {
      return res.status(400).json({
        success: false,
        message: `A patent can be marked as granted only after it is published (current status: ${String(application.status).replace(/_/g, ' ')})`,
        code: 'IPR_NOT_PUBLISHED',
      });
    }
    if (input.grantedAt && application.publicationDate && dateOnly(input.grantedAt) < dateOnly(application.publicationDate)) {
      return res.status(400).json({
        success: false,
        message: `Grant date cannot be before the publication date (${dateOnly(application.publicationDate)})`,
        field: 'grantedAt',
      });
    }

    const before = { grantedAt: dateOnly(application.grantedAt), patentNumber: application.patentNumber ?? null };
    const after = { grantedAt: dateOnly(input.grantedAt), patentNumber: input.patentNumber };
    const note = input.grantedAt
      ? `Patent granted on ${after.grantedAt}, patent number ${after.patentNumber}`
      : `Patent grant details cleared (was ${before.grantedAt || '-'}, ${before.patentNumber || '-'})`;

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.iprApplication.update({
        where: { id: application.id },
        data: input,
        select: { id: true, status: true, grantedAt: true, patentNumber: true },
      });
      await tx.iprStatusHistory.create({
        data: {
          iprApplicationId: application.id,
          fromStatus: application.status,
          toStatus: application.status, // not a workflow status change
          changedById: req.user.id,
          comments: note,
          metadata: { type: 'patent_granted', before, after },
        },
      });
      return row;
    });

    auditService.log({
      actorId: req.user.id,
      action: `${input.grantedAt ? 'Marked patent as granted' : 'Cleared patent grant'}: ${application.title || application.id}`,
      actionType: AuditActionType.UPDATE,
      module: AuditModule.IPR,
      category: 'patent_grant',
      targetTable: 'ipr_application',
      targetId: application.id,
      oldValues: before,
      newValues: after,
      requestPath: req.originalUrl,
      requestMethod: req.method,
    }).catch(() => {});

    if (input.grantedAt && application.applicantUserId) {
      prisma.notification.create({
        data: {
          userId: application.applicantUserId,
          type: 'ipr_patent_granted',
          title: 'Patent granted',
          message: `Your patent "${application.title}" has been granted (patent no. ${after.patentNumber}).`,
          referenceType: 'ipr_application',
          referenceId: application.id,
        },
      }).catch(() => {});
    }

    return res.json({
      success: true,
      message: input.grantedAt ? 'Patent marked as granted' : 'Patent grant details cleared',
      data: { id: updated.id, status: updated.status, grantedAt: dateOnly(updated.grantedAt), patentNumber: updated.patentNumber },
    });
  } catch (error) {
    if (error instanceof IprGrantValidationError) {
      return res.status(400).json({ success: false, message: error.message, field: error.field });
    }
    if (error.statusCode && error.statusCode < 500) return res.status(error.statusCode).json({ success: false, message: error.message });
    console.error('Mark patent granted error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update patent grant details' });
  }
};

exports.requireIprGrantManager = requireIprGrantManager;
exports.validateGrantedInput = validateGrantedInput;
exports.GRANTABLE_STATUSES = GRANTABLE_STATUSES;
