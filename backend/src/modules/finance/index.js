/**
 * Finance Module
 * Handles all finance-related functionality
 */

const express = require('express');
const router = express.Router();

// Existing IPR finance routes
const financeRoutes = require('./routes/finance.routes');

// Mount routes
router.use('/', financeRoutes);

module.exports = router;
