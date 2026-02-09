/**
 * Noting & Approval System Module
 * Internal approval workflow for academic/administrative requests.
 */
const notingRoutes = require('./routes/noting.routes');
const express = require('express');
const router = express.Router();

router.use('/', notingRoutes);

module.exports = router;
