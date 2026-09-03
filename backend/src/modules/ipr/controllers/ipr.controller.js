/**
 * IPR Controller (thin)
 * Each method: parse req → call service → send res.
 * No Prisma imports, no business logic.
 */

const { iprService } = require('../services');

// ─── Create Application ────────────────────────────────────────────────────

const createIprApplication = async (req, res) => {
  try {
    const { application, message } = await iprService.createApplication(req.body, req.user.id, req);
    res.status(201).json({ success: true, message, data: application });
  } catch (error) {
    console.error('Create IPR application error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.statusCode ? error.message : 'Failed to create IPR application', error: error.message });
  }
};

// ─── Submit Application ────────────────────────────────────────────────────

const submitIprApplication = async (req, res) => {
  try {
    const { updated, message } = await iprService.submitApplication(req.params.id, req.user.id, req);
    res.json({ success: true, message, data: updated });
  } catch (error) {
    console.error('Submit IPR application error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.statusCode ? error.message : 'Failed to submit IPR application', error: error.message });
  }
};

// ─── Get All Applications ──────────────────────────────────────────────────

const getAllIprApplications = async (req, res) => {
  try {
    const { applications, total, page, limit } = await iprService.getAllApplications(req.query, req.tenantId);
    res.json({
      success: true,
      data: applications,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get IPR applications error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch IPR applications', error: error.message });
  }
};

// ─── Get Application By ID ─────────────────────────────────────────────────

const getIprApplicationById = async (req, res) => {
  try {
    const application = await iprService.getApplicationById(req.params.id);
    res.json({ success: true, data: application });
  } catch (error) {
    console.error('Get IPR application error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.statusCode ? error.message : 'Failed to fetch IPR application', error: error.message });
  }
};

// ─── Update Application ────────────────────────────────────────────────────

const updateIprApplication = async (req, res) => {
  try {
    const { updated, finalStatus, message } = await iprService.updateApplication(req.params.id, req.user.id, req.body, req);
    res.json({ success: true, message, data: { ...updated, status: finalStatus } });
  } catch (error) {
    console.error('Update IPR application error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.statusCode ? error.message : 'Failed to update IPR application', error: error.message });
  }
};

// ─── Delete Application ────────────────────────────────────────────────────

const deleteIprApplication = async (req, res) => {
  try {
    await iprService.deleteApplication(req.params.id, req.user.id);
    res.json({ success: true, message: 'IPR application deleted successfully' });
  } catch (error) {
    console.error('Delete IPR application error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.statusCode ? error.message : 'Failed to delete IPR application', error: error.message });
  }
};

// ─── My Applications ───────────────────────────────────────────────────────

const getMyIprApplications = async (req, res) => {
  try {
    const { applications, grouped, stats, pagination } = await iprService.getMyApplications(req.user.id, req.query);
    res.json({ success: true, data: applications, grouped, stats, ...(pagination ? { pagination } : {}) });
  } catch (error) {
    console.error('Get my IPR applications error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch your IPR applications', error: error.message });
  }
};

// ─── My Published Provisionals ─────────────────────────────────────────────

const getMyPublishedProvisionals = async (req, res) => {
  try {
    const result = await iprService.getMyPublishedProvisionals(req.user.id);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get published provisionals error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch published provisional applications', error: error.message });
  }
};

// ─── My Application By ID ──────────────────────────────────────────────────

const getMyIprApplicationById = async (req, res) => {
  try {
    const application = await iprService.getMyApplicationById(req.params.id, req.user.id);
    res.json({ success: true, data: application });
  } catch (error) {
    console.error('Get my IPR application error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.statusCode ? error.message : 'Failed to fetch IPR application', error: error.message });
  }
};

// ─── Statistics ────────────────────────────────────────────────────────────

const getIprStatistics = async (req, res) => {
  try {
    const data = await iprService.getStatistics(req.query, req.tenantId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get IPR statistics error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch IPR statistics', error: error.message });
  }
};

// ─── Resubmit Application ──────────────────────────────────────────────────

const resubmitIprApplication = async (req, res) => {
  try {
    const { updatedApplication, message } = await iprService.resubmitApplication(req.params.id, req.user.id);
    res.status(200).json({ success: true, message, data: updatedApplication });
  } catch (error) {
    console.error('Error resubmitting IPR application:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.statusCode ? error.message : 'Failed to resubmit IPR application', error: error.message });
  }
};

// ─── Contributed Applications ──────────────────────────────────────────────

const getContributedIprApplications = async (req, res) => {
  try {
    const applications = await iprService.getContributedApplications(req.user.id, req.user.uid);
    res.status(200).json({ success: true, message: 'Contributed IPR applications retrieved successfully', data: applications, count: applications.length });
  } catch (error) {
    console.error('Get contributed IPR applications error:', error);
    res.status(500).json({ success: false, message: 'Failed to get contributed IPR applications', error: error.message });
  }
};

const getContributedIprApplicationById = async (req, res) => {
  try {
    const application = await iprService.getContributedApplicationById(req.params.id, req.user.id, req.user.uid);
    res.status(200).json({ success: true, data: application });
  } catch (error) {
    console.error('Get contributed IPR application error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.statusCode ? error.message : 'Failed to get IPR application', error: error.message });
  }
};

// ─── Mentor Workflow ───────────────────────────────────────────────────────

const getPendingMentorApprovals = async (req, res) => {
  try {
    const applications = await iprService.getPendingMentorApprovals(req.user.uid);
    res.json({ success: true, data: applications, total: applications.length });
  } catch (error) {
    console.error('Get pending mentor approvals error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pending mentor approvals', error: error.message });
  }
};

const getMentorReviewHistory = async (req, res) => {
  try {
    const { data, stats } = await iprService.getMentorReviewHistory(req.user.uid);
    res.json({ success: true, data, stats });
  } catch (error) {
    console.error('Get mentor review history error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch mentor review history', error: error.message });
  }
};

const getMentorApplicationById = async (req, res) => {
  try {
    const application = await iprService.getMentorApplicationById(req.params.id, req.user.uid);
    res.json({ success: true, data: application });
  } catch (error) {
    console.error('Get mentor IPR application error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.statusCode ? error.message : 'Failed to fetch IPR application', error: error.message });
  }
};

const approveMentorApplication = async (req, res) => {
  try {
    const { updated } = await iprService.approveMentorApplication(req.params.id, req.user.id, req.user.uid, req.body.comments, req);
    res.json({ success: true, message: 'IPR application approved and submitted to DRD', data: updated });
  } catch (error) {
    console.error('Mentor approve IPR application error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.statusCode ? error.message : 'Failed to approve IPR application', error: error.message });
  }
};

const rejectMentorApplication = async (req, res) => {
  try {
    const { updated } = await iprService.rejectMentorApplication(req.params.id, req.user.id, req.user.uid, req.body.comments, req);
    res.json({ success: true, message: 'Application sent back to student for revision', data: updated });
  } catch (error) {
    console.error('Mentor reject IPR application error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.statusCode ? error.message : 'Failed to reject IPR application', error: error.message });
  }
};

module.exports = {
  createIprApplication,
  submitIprApplication,
  resubmitIprApplication,
  getAllIprApplications,
  getIprApplicationById,
  getMyIprApplicationById,
  getMentorApplicationById,
  updateIprApplication,
  deleteIprApplication,
  getMyIprApplications,
  getMyPublishedProvisionals,
  getIprStatistics,
  getContributedIprApplications,
  getContributedIprApplicationById,
  getPendingMentorApprovals,
  getMentorReviewHistory,
  approveMentorApplication,
  rejectMentorApplication,
};
