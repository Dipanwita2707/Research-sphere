const express = require('express');
const router = express.Router();
const analyticsController = require('./finance-analytics.controller');
const { protect, requireAnyPermission } = require('../../../shared/middleware/auth');

router.use(protect);
router.use(requireAnyPermission('central-department', ['finance_analytics']));

router.get('/loan-letters', analyticsController.getLoanLetterRegistry);
router.get('/programs/:programId/loan-letters', analyticsController.getProgramLoanLetters);
router.get('/staff/:staffId/loan-letters', analyticsController.getStaffLoanLetters);
router.get('/', analyticsController.getSummary);

module.exports = router;
