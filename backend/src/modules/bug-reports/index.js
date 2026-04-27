/**
 * Bug Report Module
 * Handles bug report submissions, screenshot uploads, and admin dashboard
 */
const router = require('express').Router();
const bugReportRoutes = require('./routes/bugReport.routes');
const adminRoutes = require('./routes/admin.routes');

// Public bug report routes
router.use('/', bugReportRoutes);

// Admin dashboard routes
router.use('/admin', adminRoutes);

module.exports = router;
