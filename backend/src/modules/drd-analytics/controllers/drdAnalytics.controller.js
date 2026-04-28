const service = require('../services/drdAnalytics.service');

function getFilters(req) {
  const {
    from,
    to,
    schoolId,
    departmentId,
    category = 'all',
    reviewerId,
  } = req.query;

  return {
    from,
    to,
    schoolId,
    departmentId,
    category,
    reviewerId,
  };
}

async function handle(res, fn) {
  try {
    const data = await fn();
    res.json({ success: true, data });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to load DRD analytics',
    });
  }
}

exports.getApplicantAnalytics = async (req, res) =>
  handle(res, () => service.getApplicantAnalytics(req.user, getFilters(req)));

exports.getCategoryBreakdown = async (req, res) =>
  handle(res, () => service.getCategoryBreakdown(req.user, getFilters(req)));

exports.getApplicantSchoolAnalytics = async (req, res) =>
  handle(res, () =>
    service.getApplicantAnalytics(req.user, {
      ...getFilters(req),
      schoolId: req.params.schoolId,
    })
  );

exports.getApplicantDepartmentAnalytics = async (req, res) =>
  handle(res, () =>
    service.getApplicantAnalytics(req.user, {
      ...getFilters(req),
      departmentId: req.params.departmentId,
    })
  );

exports.getApplicantPersonAnalytics = async (req, res) =>
  handle(res, () =>
    service.getApplicantPersonAnalytics(req.user, req.params.personId, getFilters(req))
  );

exports.getApplicantPersonSubmissions = async (req, res) =>
  handle(res, () =>
    service.getApplicantPersonSubmissions(req.user, req.params.personId, getFilters(req))
  );

exports.getDrdMemberAnalytics = async (req, res) =>
  handle(res, () => service.getDrdMemberAnalytics(req.user, getFilters(req)));

exports.getReviewerAnalytics = async (req, res) =>
  handle(res, () =>
    service.getReviewerAnalytics(req.user, req.params.reviewerId, getFilters(req))
  );

exports.getDrdMemberPerformance = async (req, res) =>
  handle(res, () => service.getDrdMemberPerformance(req.user, getFilters(req)));

exports.getReviewerPerformanceDetail = async (req, res) =>
  handle(res, () =>
    service.getReviewerPerformanceDetail(req.user, req.params.reviewerId, getFilters(req))
  );

exports.getProgressTrackerAnalytics = async (req, res) =>
  handle(res, () => {
    const { from, to, schoolId, departmentId, publicationType } = req.query;
    return service.getProgressTrackerAnalytics(req.user, {
      from,
      to,
      schoolId,
      departmentId,
      publicationType,
    });
  });

exports.getProgressTrackerRecords = async (req, res) =>
  handle(res, () => {
    const {
      from,
      to,
      schoolId,
      departmentId,
      publicationType,
      status,
      userId,
    } = req.query;

    return service.getProgressTrackerRecords(req.user, {
      from,
      to,
      schoolId,
      departmentId,
      publicationType,
      status,
      userId,
    });
  });

exports.getContributionsList = async (req, res) =>
  handle(res, () => {
    const { from, to, schoolId, departmentId, publicationType, status } = req.query;
    return service.getContributionsList(req.user, {
      from,
      to,
      schoolId,
      departmentId,
      publicationType,
      status,
    });
  });
