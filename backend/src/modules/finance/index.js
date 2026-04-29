/**
 * Finance Module
 * Handles all finance-related functionality
 */

const express = require('express');
const router = express.Router();

// Existing IPR finance routes
const financeRoutes = require('./routes/finance.routes');

// New sub-module routes
const feeStructureRoutes = require('./fee-structure/fee-structure.routes');
const loanLetterRoutes = require('./loan-letter/loan-letter.routes');
const analyticsRoutes = require('./analytics/finance-analytics.routes');

// Mount routes
router.use('/', financeRoutes);
router.use('/fee-structure', feeStructureRoutes);
router.use('/loan-letters', loanLetterRoutes);
router.use('/analytics', analyticsRoutes);

module.exports = router;
