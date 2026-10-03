/**
 * Finance Module
 * Handles all finance-related functionality
 */

const express = require('express');
const router = express.Router();

// Research incentive payouts (paper, book, chapter, conference, grant, IPR) — mounted first
// so these paths never fall through to the legacy IPR finance router.
// Research budget allocation (school / department), utilisation from the payout ledger.
router.use('/budgets', require('./routes/budget.routes'));

router.use('/', require('./routes/incentivePayout.routes'));

// Existing IPR finance routes
const financeRoutes = require('./routes/finance.routes');

// Mount routes
router.use('/', financeRoutes);

module.exports = router;
