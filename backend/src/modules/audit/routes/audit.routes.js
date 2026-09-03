/**
 * Audit Routes
 * API endpoints for audit log management and reporting
 */

const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const { protect, restrictTo } = require('../../../shared/middleware/auth');

// All audit routes require authentication and admin/drd_staff role
const adminOnly = [protect, restrictTo('admin', 'superadmin', 'drd_staff')];

// Audit Logs
router.get('/logs', ...adminOnly, auditController.getAuditLogs);
router.get('/logs/export', ...adminOnly, auditController.exportAuditLogs);
router.get('/logs/filters', ...adminOnly, auditController.getFilterOptions);
router.get('/logs/:targetTable/:targetId', ...adminOnly, auditController.getEntityAuditHistory);

// Statistics
router.get('/statistics', ...adminOnly, auditController.getAuditStatistics);

// Reports
router.post('/reports/generate', ...adminOnly, auditController.generateReport);
router.get('/reports/history', ...adminOnly, auditController.getReportHistory);
router.post('/reports/send-email', ...adminOnly, auditController.sendManualReport);

// Report Recipients Configuration
router.get('/recipients', ...adminOnly, auditController.getReportRecipients);
router.post('/recipients', ...adminOnly, auditController.saveReportRecipient);
router.put('/recipients/:id', ...adminOnly, auditController.saveReportRecipient);
router.delete('/recipients/:id', ...adminOnly, auditController.deleteReportRecipient);

// Maintenance
router.post('/cleanup', ...adminOnly, auditController.triggerCleanup);

module.exports = router;
