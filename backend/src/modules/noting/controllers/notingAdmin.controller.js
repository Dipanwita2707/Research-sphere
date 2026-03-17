const asyncHandler = require("../../../shared/utils/asyncHandler");
const ApiResponse = require("../../../shared/utils/ApiResponse");
const analyticsService = require("../services/notingAnalytics.service");

const getOverviewAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const result = await analyticsService.getOverviewStats({ startDate, endDate });
  return ApiResponse.success(
    res,
    result,
    "Noting overview analytics fetched successfully",
  );
});

const getUserAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const result = await analyticsService.getUserStats({ startDate, endDate });
  return ApiResponse.success(
    res,
    result,
    "Noting user analytics fetched successfully",
  );
});

const getActivityAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate, page, limit } = req.query;
  const result = await analyticsService.getActivityStats({
    startDate,
    endDate,
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 20,
  });
  return ApiResponse.success(
    res,
    result,
    "Noting activity analytics fetched successfully",
  );
});

module.exports = {
  getOverviewAnalytics,
  getUserAnalytics,
  getActivityAnalytics,
};
