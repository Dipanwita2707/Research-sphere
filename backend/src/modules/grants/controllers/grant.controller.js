/**
 * Grant Application Controller (thin)
 * Parses requests, delegates to GrantService, sends responses.
 */

const { grantService } = require('../services');
const { uploadToS3 } = require('../../../shared/utils/s3');
const reviewScope = require('../../research/services/reviewScope');
const { isGrantParticipant } = require('../../research/utils/objectAccess');

/**
 * Map a service error to a response: explicit statusCode (4xx keeps its message),
 * Prisma validation errors (bad enum/type in the payload) to 400, anything else to 500.
 */
function sendError(res, error, fallbackMessage) {
  if (error?.name === 'PrismaClientValidationError') {
    const lines = String(error.message || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const detail = lines[lines.length - 1];
    return res.status(400).json({
      success: false,
      message: detail ? `Invalid grant application data: ${detail}` : 'Invalid grant application data',
    });
  }
  const status = error?.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: status < 500 ? error.message : fallbackMessage,
    // Machine-readable reason for 4xx (e.g. NO_INCENTIVE_POLICY → the UI asks to confirm ₹0).
    ...(status < 500 && error?.code && typeof error.code === 'string' && !error.code.startsWith('P') ? { code: error.code } : {}),
  });
}

exports.createGrantApplication = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    let requestData = req.body;
    if (req.body.data && typeof req.body.data === 'string') {
      try {
        requestData = JSON.parse(req.body.data);
      } catch {
        return res.status(400).json({ success: false, message: 'Invalid data format' });
      }
    }

    if (!requestData.title || !requestData.title.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const { grant, message } = await grantService.createApplication(
      requestData,
      userId,
      req.file || null,
      uploadToS3,
      req
    );

    res.status(201).json({ success: true, message, data: grant });
  } catch (error) {
    console.error('Error creating grant application:', error);
    sendError(res, error, 'Failed to create grant application');
  }
};

exports.getMyGrantApplications = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const result = await grantService.getMyApplications(userId, req.query);
    res.json({
      success: true,
      data: result.data || result,
      ...(result.pagination ? { pagination: result.pagination } : {}),
    });
  } catch (error) {
    console.error('Error fetching grant applications:', error);
    sendError(res, error, 'Failed to fetch grant applications');
  }
};

exports.getGrantApplicationById = async (req, res) => {
  try {
    const { id } = req.params;
    const grant = await grantService.getApplicationById(id, req.user);
    // DRD reviewers may open grants only inside their assigned grant schools
    await reviewScope.assertCanViewInScope(req.user, 'grant', grant.schoolId, {
      participant: isGrantParticipant(req.user, grant),
      notFoundMessage: 'Grant application not found',
    });
    res.json({ success: true, data: grant });
  } catch (error) {
    console.error('Error fetching grant application:', error);
    sendError(res, error, 'Failed to fetch grant application');
  }
};

exports.updateGrantApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const grant = await grantService.updateApplication(id, userId, req.body);
    res.json({ success: true, message: 'Grant application updated successfully', data: grant });
  } catch (error) {
    console.error('Error updating grant application:', error);
    sendError(res, error, 'Failed to update grant application');
  }
};

exports.submitGrantApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const updatedGrant = await grantService.submitApplication(id, userId);
    res.json({ success: true, message: 'Grant application submitted successfully', data: updatedGrant });
  } catch (error) {
    console.error('Error submitting grant application:', error);
    sendError(res, error, 'Failed to submit grant application');
  }
};

exports.deleteGrantApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    await grantService.deleteApplication(id, userId);
    res.json({ success: true, message: 'Grant application deleted successfully' });
  } catch (error) {
    console.error('Error deleting grant application:', error);
    sendError(res, error, 'Failed to delete grant application');
  }
};

exports.getPendingGrantReviews = async (req, res) => {
  try {
    const userId = req.user?.id;

    // Merge DRD permissions from req.user (set by auth middleware)
    let mergedPermissions = {};
    if (req.user?.centralDeptPermissions && Array.isArray(req.user.centralDeptPermissions)) {
      req.user.centralDeptPermissions.forEach((deptPerm) => {
        if (deptPerm.permissions) Object.assign(mergedPermissions, deptPerm.permissions);
      });
    }

    const result = await grantService.getPendingReviews(userId, mergedPermissions, req.query, req.tenantId);
    res.json({
      success: true,
      data: result.data || result,
      ...(result.pagination ? { pagination: result.pagination } : {}),
    });
  } catch (error) {
    console.error('Error fetching pending grant reviews:', error);
    sendError(res, error, 'Failed to fetch pending reviews');
  }
};

exports.startReview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const updatedGrant = await grantService.startReview(id, userId);
    res.json({ success: true, message: 'Review started successfully', data: updatedGrant });
  } catch (error) {
    console.error('Error starting grant review:', error);
    sendError(res, error, 'Failed to start review');
  }
};

exports.requestChanges = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const { comments, suggestions } = req.body;

    const updatedGrant = await grantService.requestChanges(id, userId, comments, suggestions);
    res.json({ success: true, message: 'Changes requested successfully', data: updatedGrant });
  } catch (error) {
    console.error('Error requesting changes:', error);
    sendError(res, error, 'Failed to request changes');
  }
};

exports.recommendForApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const { comments } = req.body;

    const updatedGrant = await grantService.recommendForApproval(id, userId, comments);
    res.json({ success: true, message: 'Grant application recommended for approval', data: updatedGrant });
  } catch (error) {
    console.error('Error recommending grant:', error);
    sendError(res, error, 'Failed to recommend grant');
  }
};

exports.approveGrant = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const { comments, confirmZeroIncentive } = req.body;

    const updatedGrant = await grantService.approveGrant(id, userId, comments, {
      confirmZeroIncentive: confirmZeroIncentive === true,
    });
    res.json({ success: true, message: 'Grant application approved successfully', data: updatedGrant });
  } catch (error) {
    console.error('Error approving grant:', error);
    sendError(res, error, 'Failed to approve grant');
  }
};

exports.rejectGrant = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const { comments, reason } = req.body;

    const updatedGrant = await grantService.rejectGrant(id, userId, comments, reason);
    res.json({ success: true, message: 'Grant application rejected', data: updatedGrant });
  } catch (error) {
    console.error('Error rejecting grant:', error);
    sendError(res, error, 'Failed to reject grant');
  }
};

exports.markCompleted = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const updatedGrant = await grantService.markCompleted(id, userId);
    res.json({ success: true, message: 'Grant application marked as completed', data: updatedGrant });
  } catch (error) {
    console.error('Error marking grant as completed:', error);
    sendError(res, error, 'Failed to mark grant as completed');
  }
};

exports.respondToGrantSuggestion = async (req, res) => {
  try {
    const { suggestionId } = req.params;
    const { accept } = req.body;
    const userId = req.user?.id;

    const updatedSuggestion = await grantService.respondToSuggestion(suggestionId, userId, accept);
    res.json({
      success: true,
      message: accept ? 'Suggestion accepted and applied' : 'Suggestion rejected',
      data: updatedSuggestion,
    });
  } catch (error) {
    console.error('Error responding to suggestion:', error);
    sendError(res, error, 'Failed to respond to suggestion');
  }
};

exports._sendError = sendError;
