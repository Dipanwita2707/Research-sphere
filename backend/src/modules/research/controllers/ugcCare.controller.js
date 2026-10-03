/**
 * DRD confirmation / correction of a journal paper's UGC-CARE listing (NAAC 3.3.1).
 *
 * PATCH /research/:id/ugc-care  { ugcCareListed: 'yes'|'no'|'unknown'|true|false|null, ugcCareGroup?: 'group_1'|'group_2'|null }
 * Guarded in contribution.routes.js by research_review OR research_approve. Tenant scoping is
 * automatic (a contribution of another university is simply "not found").
 */

const prisma = require('../../../shared/config/database');
const { auditService, AuditActionType, AuditModule } = require('../../audit/services/audit.service');
const { normalizeUgcCare, UgcCareValidationError } = require('../utils/ugcCare');

const describe = (listed, group) => {
  if (listed === true) return group ? `listed (${group === 'group_1' ? 'Group I' : 'Group II'})` : 'listed (group not set)';
  if (listed === false) return 'not listed';
  return 'unknown';
};

exports.updateUgcCare = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    if (!('ugcCareListed' in body)) {
      return res.status(400).json({ success: false, message: 'ugcCareListed is required (yes, no or unknown)' });
    }

    let next;
    try {
      next = normalizeUgcCare(body.ugcCareListed, body.ugcCareGroup);
    } catch (err) {
      if (err instanceof UgcCareValidationError) return res.status(400).json({ success: false, message: err.message, code: err.code });
      throw err;
    }

    const contribution = await prisma.researchContribution.findUnique({
      where: { id },
      select: { id: true, title: true, status: true, publicationType: true, ugcCareListed: true, ugcCareGroup: true },
    });
    if (!contribution) return res.status(404).json({ success: false, message: 'Research contribution not found' });
    if (contribution.publicationType !== 'research_paper') {
      return res.status(400).json({ success: false, message: 'UGC-CARE status applies to journal papers only' });
    }
    if (contribution.status === 'draft') {
      return res.status(400).json({ success: false, message: 'A draft has not been submitted for review yet' });
    }

    const before = { ugcCareListed: contribution.ugcCareListed ?? null, ugcCareGroup: contribution.ugcCareGroup ?? null };
    const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 1000) : '';
    const note = `UGC-CARE status ${contribution.ugcCareListed === null || contribution.ugcCareListed === undefined ? 'confirmed' : 'set'} by DRD: `
      + `${describe(before.ugcCareListed, before.ugcCareGroup)} → ${describe(next.ugcCareListed, next.ugcCareGroup)}`
      + (comment ? `. ${comment}` : '');

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.researchContribution.update({
        where: { id },
        data: next,
        select: { id: true, status: true, ugcCareListed: true, ugcCareGroup: true },
      });
      // Not a status change: from/to are the current status, the note carries the detail.
      await tx.researchContributionStatusHistory.create({
        data: {
          researchContributionId: id,
          fromStatus: contribution.status,
          toStatus: contribution.status,
          changedById: req.user.id,
          comments: note,
          metadata: { type: 'ugc_care_update', before, after: next },
        },
      });
      return row;
    });

    auditService.log({
      actorId: req.user.id,
      action: `Updated UGC-CARE status: ${contribution.title || id}`,
      actionType: AuditActionType.UPDATE,
      module: AuditModule.RESEARCH,
      category: 'ugc_care',
      targetTable: 'research_contribution',
      targetId: id,
      oldValues: before,
      newValues: next,
      details: { note },
      requestPath: req.originalUrl,
      requestMethod: req.method,
    }).catch(() => {});

    return res.json({ success: true, message: 'UGC-CARE status updated', data: updated });
  } catch (error) {
    if (error.statusCode && error.statusCode < 500) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('UGC-CARE update error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update UGC-CARE status' });
  }
};
