const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { protect, restrictTo } = require('../../../shared/middleware/auth');

// All routes require authentication
router.use(protect);

// Admin-only analytics routes
router.get('/overview', restrictTo('admin'), analyticsController.getUniversityOverview);
router.get('/schools', restrictTo('admin'), analyticsController.getSchoolWiseStats);
router.get('/departments', restrictTo('admin'), analyticsController.getDepartmentWiseStats);
router.get('/ipr', restrictTo('admin'), analyticsController.getIprAnalytics);
router.get('/categories', restrictTo('admin'), analyticsController.getCategoryAnalytics);
router.get('/top-performers', restrictTo('admin'), analyticsController.getTopPerformers);
router.get('/monthly-trend', restrictTo('admin'), analyticsController.getMonthlyTrend);

module.exports = router;
