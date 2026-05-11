/**
 * Research Review Controller (Thin)
 * parse req → call service → send res. No business logic, no direct Prisma calls.
 */
const { reviewService, contributionRepo, prisma } = require('../services/index');

const _err = (res, error, fallback = 'Operation failed') => {
  const code = error.statusCode || 500;
  if (code < 500) return res.status(code).json({ success: false, message: error.message });
  console.error(error);
  return res.status(500).json({ success: false, message: fallback, error: error.message });
};

exports.getPendingReviews = async (req, res) => {
  try {
    const { publicationType } = req.query;
    if (publicationType === 'grant_proposal') return exports.getPendingGrantReviews(req, res);
    if (!publicationType || publicationType === '') return exports.getAllPendingReviews(req, res);
    const result = await reviewService.getPendingReviews(req.user.id, req.query, req.user?.centralDeptPermissions);
    res.status(200).json({ success: true, data: result });
  } catch (error) { _err(res, error, 'Failed to get pending reviews'); }
};

exports.getPendingGrantReviews = async (req, res) => {
  try {
    const result = await reviewService.getPendingGrantReviews(req.user.id, req.query);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.status(200).json({ success: true, data: result });
  } catch (error) { _err(res, error, 'Failed to get pending grant reviews'); }
};

exports.getAllPendingReviews = async (req, res) => {
  try {
    // Fetch all research-contribution types (research_paper, book, book_chapter, conference_paper)
    // together in one query, plus grants from their own table in parallel.
    const researchQuery = { ...req.query };
    delete researchQuery.publicationType; // let the service return all types
    const [researchResult, grantResult] = await Promise.all([
      reviewService.getPendingReviews(req.user.id, researchQuery, req.user?.centralDeptPermissions).catch(() => ({ contributions: [], stats: {} })),
      reviewService.getPendingGrantReviews(req.user.id, req.query).catch(() => ({ contributions: [], stats: {} }))
    ]);
    const allContributions = [...(researchResult.contributions || []), ...(grantResult.contributions || [])];
    const combinedStats = {
      submitted: (researchResult.stats?.submitted || 0) + (grantResult.stats?.submitted || 0),
      underReview: (researchResult.stats?.underReview || 0) + (grantResult.stats?.underReview || 0),
      changesRequired: (researchResult.stats?.changesRequired || 0) + (grantResult.stats?.changesRequired || 0),
      resubmitted: (researchResult.stats?.resubmitted || 0) + (grantResult.stats?.resubmitted || 0),
      approved: (researchResult.stats?.approved || 0) + (grantResult.stats?.approved || 0),
      total: allContributions.length
    };
    res.status(200).json({ success: true, data: { contributions: allContributions, stats: combinedStats, userPermissions: researchResult.userPermissions || {} } });
  } catch (error) { _err(res, error, 'Failed to get all pending reviews'); }
};

exports.startReview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const contribution = await contributionRepo.findById(id);
    if (contribution) {
      const updated = await reviewService.assignReviewer(id, userId);
      return res.status(200).json({ success: true, message: 'Review started', data: updated });
    }
    const updated = await reviewService.assignGrantReviewer(id, userId);
    res.status(200).json({ success: true, message: 'Grant review started', data: updated });
  } catch (error) { _err(res, error, 'Failed to start review'); }
};

exports.requestChanges = async (req, res) => {
  try {
    const { comments, suggestions } = req.body;
    const updated = await reviewService.submitReview(req.params.id, req.user.id, { decision: 'changes_required', comments, suggestions: suggestions || [] });
    res.status(200).json({ success: true, message: 'Changes requested successfully', data: updated });
  } catch (error) { _err(res, error, 'Failed to request changes'); }
};

exports.recommendForApproval = async (req, res) => {
  try {
    const updated = await reviewService.recommendForApproval(req.params.id, req.user.id, req.body.comments);
    res.status(200).json({ success: true, message: 'Contribution recommended for approval successfully', data: updated });
  } catch (error) { _err(res, error, 'Failed to recommend contribution'); }
};

exports.approveContribution = async (req, res) => {
  try {
    const result = await reviewService.approveContribution(req.params.id, req.user.id, { comments: req.body.comments, request: req });
    const { updated, incentiveBreakdown } = result;
    res.status(200).json({ success: true, message: 'Research contribution approved and incentives credited based on author roles', data: { ...updated, incentiveBreakdown } });
  } catch (error) { _err(res, error, 'Failed to approve contribution'); }
};

exports.rejectContribution = async (req, res) => {
  try {
    const { comments, reason } = req.body;
    const updated = await reviewService.rejectContribution(req.params.id, req.user.id, { comments, reason, request: req });
    res.status(200).json({ success: true, message: 'Research contribution rejected', data: updated });
  } catch (error) { _err(res, error, 'Failed to reject contribution'); }
};

exports.markCompleted = async (req, res) => {
  try {
    const updated = await reviewService.markCompleted(req.params.id, req.user.id);
    res.status(200).json({ success: true, message: 'Research contribution marked as completed', data: updated });
  } catch (error) { _err(res, error, 'Failed to mark as completed'); }
};

exports.getReviewStatistics = async (req, res) => {
  try {
    const data = await reviewService.getStatistics(req.query);
    res.status(200).json({ success: true, data });
  } catch (error) { _err(res, error, 'Failed to get statistics'); }
};

exports.respondToSuggestion = async (req, res) => {
  try {
    const { accept, response } = req.body;
    await reviewService.respondToSuggestion(req.params.suggestionId, req.user.id, accept, response);
    res.status(200).json({ success: true, message: `Suggestion ${accept ? 'accepted' : 'rejected'} successfully` });
  } catch (error) { _err(res, error, 'Failed to respond to suggestion'); }
};

exports.getSchoolsForFilter = async (req, res) => {
  try {
    const schools = await reviewService.getSchoolsForFilter();
    res.status(200).json({ success: true, data: schools });
  } catch (error) { _err(res, error, 'Failed to get schools'); }
};

exports.getWorkflowHealthSummary = async (req, res) => {
  try {
    const data = await reviewService.getWorkflowHealthSummary(req.query);
    res.status(200).json({ success: true, data });
  } catch (error) { _err(res, error, 'Failed to get workflow health summary'); }
};

module.exports = exports;
