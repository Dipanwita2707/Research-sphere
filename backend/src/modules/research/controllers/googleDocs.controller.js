/**
 * Google-Docs style change tracking for IPR application text fields.
 *
 * Authorization (tenant isolation itself is automatic):
 *   - reading a document / its pending changes: anyone who may view the application (canViewIpr)
 *   - suggesting a change: IPR reviewers/approvers who may view the application
 *   - accepting / rejecting a change: the applicant only
 * Records the user may not see are answered with 404.
 */
const prisma = require('../../../shared/config/database');
const { canViewIpr, hasAnyPermission, IPR_ACCESS_INCLUDE } = require('../utils/objectAccess');

// Only free-text fields may be edited through this workflow (never status, owner, amounts, ...)
const EDITABLE_FIELDS = ['title', 'description', 'remarks'];

const REVIEWER_SELECT = {
  select: {
    id: true,
    email: true,
    employeeDetails: { select: { firstName: true, lastName: true, displayName: true } },
  },
};

const reviewerName = (reviewer) => {
  const emp = reviewer?.employeeDetails;
  if (!emp) return '';
  return emp.displayName || [emp.firstName, emp.lastName].filter(Boolean).join(' ');
};

const withReviewerName = (change) => ({ ...change, reviewerName: reviewerName(change.reviewer) });

const notFound = (res, message = 'IPR application not found') =>
  res.status(404).json({ success: false, message });

/** Load an application with the relations canViewIpr needs; null when missing or not visible. */
const loadVisibleApplication = async (user, id) => {
  if (!id) return null;
  const application = await prisma.iprApplication.findUnique({
    where: { id },
    include: IPR_ACCESS_INCLUDE,
  });
  return canViewIpr(user, application) ? application : null;
};

// Get document with all changes
const getDocument = async (req, res) => {
  try {
    const { iprApplicationId, fieldName } = req.params;
    if (!EDITABLE_FIELDS.includes(fieldName)) {
      return res.status(400).json({ success: false, message: 'Unsupported field' });
    }

    const application = await loadVisibleApplication(req.user, iprApplicationId);
    if (!application) return notFound(res);

    const changes = await prisma.documentChange.findMany({
      where: { iprApplicationId, fieldName },
      include: { reviewer: REVIEWER_SELECT },
      orderBy: { createdAt: 'asc' },
    });

    const originalContent = application[fieldName] || '';
    let currentContent = originalContent;
    const acceptedChanges = changes.filter(c => c.status === 'accepted');
    for (const change of acceptedChanges) {
      if (change.type === 'replace') currentContent = change.newText;
    }

    res.json({
      success: true,
      data: {
        id: `${iprApplicationId}-${fieldName}`,
        iprApplicationId,
        fieldName,
        originalContent,
        currentContent,
        version: acceptedChanges.length + 1,
        changes: changes.map(withReviewerName),
        lastModifiedBy: req.user.id,
        lastModifiedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ success: false, message: 'Failed to get document' });
  }
};

// Submit a new change (IPR reviewers)
const submitChange = async (req, res) => {
  try {
    const { iprApplicationId, fieldName, originalText, newText, comment, type, position } = req.body;
    const reviewerId = req.user.id;

    if (!iprApplicationId || !fieldName || !newText) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    if (!EDITABLE_FIELDS.includes(fieldName)) {
      return res.status(400).json({ success: false, message: 'Unsupported field' });
    }

    const application = await loadVisibleApplication(req.user, iprApplicationId);
    if (!application) return notFound(res);
    if (!hasAnyPermission(req.user, ['ipr_review', 'ipr_approve'])) {
      return res.status(403).json({ success: false, message: 'Access denied - insufficient permissions' });
    }

    const change = await prisma.documentChange.create({
      data: {
        iprApplicationId,
        fieldName,
        type: type || 'replace',
        originalText: originalText || '',
        newText,
        position: position || 0,
        reviewerId,
        comment,
        status: 'pending',
      },
      include: { reviewer: REVIEWER_SELECT },
    });

    if (application.status !== 'changes_required') {
      await prisma.iprApplication.update({
        where: { id: iprApplicationId },
        data: { status: 'changes_required' },
      });
      await prisma.iprStatusHistory.create({
        data: {
          iprApplicationId,
          fromStatus: application.status,
          toStatus: 'changes_required',
          changedById: reviewerId,
          comments: `Collaborative changes suggested for ${fieldName}`,
        },
      });
    }

    res.json({ success: true, data: withReviewerName(change), message: 'Change submitted successfully' });
  } catch (error) {
    console.error('Submit change error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit change' });
  }
};

/** Load a change the current user (as applicant) may resolve; null otherwise. */
const loadOwnChange = async (user, changeId) => {
  const change = await prisma.documentChange.findUnique({
    where: { id: changeId },
    include: { iprApplication: { select: { id: true, applicantUserId: true } } },
  });
  if (!change || change.iprApplication?.applicantUserId !== user.id) return null;
  return change;
};

// Accept a change (by applicant)
const acceptChange = async (req, res) => {
  try {
    const { changeId } = req.params;
    const userId = req.user.id;

    const change = await loadOwnChange(req.user, changeId);
    if (!change) return notFound(res, 'Change not found');
    if (!EDITABLE_FIELDS.includes(change.fieldName)) {
      return res.status(400).json({ success: false, message: 'Unsupported field' });
    }

    const updatedChange = await prisma.documentChange.update({
      where: { id: changeId },
      data: { status: 'accepted', updatedAt: new Date() },
      include: { reviewer: REVIEWER_SELECT },
    });

    await prisma.iprApplication.update({
      where: { id: change.iprApplicationId },
      data: { [change.fieldName]: change.newText },
    });

    const pendingChanges = await prisma.documentChange.count({
      where: { iprApplicationId: change.iprApplicationId, status: 'pending' },
    });

    if (pendingChanges === 0) {
      await prisma.iprApplication.update({
        where: { id: change.iprApplicationId },
        data: { status: 'under_drd_review' },
      });
      await prisma.iprStatusHistory.create({
        data: {
          iprApplicationId: change.iprApplicationId,
          fromStatus: 'changes_required',
          toStatus: 'under_drd_review',
          changedById: userId,
          comments: 'All collaborative changes resolved - back to review',
        },
      });
    }

    res.json({ success: true, data: withReviewerName(updatedChange), message: 'Change accepted successfully' });
  } catch (error) {
    console.error('Accept change error:', error);
    res.status(500).json({ success: false, message: 'Failed to accept change' });
  }
};

// Reject a change (by applicant)
const rejectChange = async (req, res) => {
  try {
    const { changeId } = req.params;

    const change = await loadOwnChange(req.user, changeId);
    if (!change) return notFound(res, 'Change not found');

    const updatedChange = await prisma.documentChange.update({
      where: { id: changeId },
      data: { status: 'rejected', updatedAt: new Date() },
      include: { reviewer: REVIEWER_SELECT },
    });

    res.json({ success: true, data: withReviewerName(updatedChange), message: 'Change rejected successfully' });
  } catch (error) {
    console.error('Reject change error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject change' });
  }
};

// Get pending changes for an application
const getPendingChanges = async (req, res) => {
  try {
    const { iprApplicationId } = req.params;

    const application = await loadVisibleApplication(req.user, iprApplicationId);
    if (!application) return notFound(res);

    const changes = await prisma.documentChange.findMany({
      where: { iprApplicationId, status: 'pending' },
      include: { reviewer: REVIEWER_SELECT },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: changes.map(withReviewerName) });
  } catch (error) {
    console.error('Get pending changes error:', error);
    res.status(500).json({ success: false, message: 'Failed to get pending changes' });
  }
};

// Auto-save draft (placeholder for real-time collaboration)
const saveDraft = async (req, res) => {
  res.json({ success: true, message: 'Draft saved successfully' });
};

// Get document status (placeholder)
const getDocumentStatus = async (req, res) => {
  res.json({
    success: true,
    data: { isBeingEdited: false, lastActivity: new Date().toISOString() },
  });
};

module.exports = {
  getDocument,
  submitChange,
  acceptChange,
  rejectChange,
  getPendingChanges,
  saveDraft,
  getDocumentStatus,
};
