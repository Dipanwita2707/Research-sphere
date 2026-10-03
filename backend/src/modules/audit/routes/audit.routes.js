/**
 * Audit Routes
 * API endpoints for audit log management and reporting
 */

const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const { protect, restrictTo } = require('../../../shared/middleware/auth');
const { requireViewScope } = require('../../research/services/reviewScope');

// Viewing audit logs: admins and DRD staff (tenant scoping is automatic)
const viewers = [protect, restrictTo('admin', 'superadmin', 'drd_staff')];
// Exports, reports and recipient config carry personal data (names, emails, IPs): admins only
const adminOnly = [protect, restrictTo('admin', 'superadmin')];
// Deleting logs is a platform operation
const superadminOnly = [protect, restrictTo('superadmin')];

// History of one DRD item: DRD staff only inside their assigned schools (participants/admins pass)
const AUDIT_TARGET_KIND = {
  research_contribution: 'research', research_contributions: 'research',
  grant_application: 'grant', grant_applications: 'grant',
  ipr_application: 'ipr', ipr_applications: 'ipr',
};
const scopeAuditTarget = (req, res, next) => {
  const kind = AUDIT_TARGET_KIND[req.params.targetTable];
  if (!kind) return next();
  req._scopeItemId = req.params.targetId;
  return requireViewScope(kind)(req, res, next);
};

// Audit Logs
router.get('/logs', ...viewers, auditController.getAuditLogs);
router.get('/logs/export', ...adminOnly, auditController.exportAuditLogs);
router.get('/logs/filters', ...viewers, auditController.getFilterOptions);
router.get('/logs/:targetTable/:targetId', ...viewers, scopeAuditTarget, auditController.getEntityAuditHistory);

// Statistics
router.get('/statistics', ...viewers, auditController.getAuditStatistics);

// Reports
router.post('/reports/generate', ...adminOnly, auditController.generateReport);
router.get('/reports/history', ...adminOnly, auditController.getReportHistory);
router.post('/reports/send-email', ...adminOnly, auditController.sendManualReport);

// Report Recipients Configuration
router.get('/recipients', ...adminOnly, auditController.getReportRecipients);
router.post('/recipients', ...adminOnly, auditController.saveReportRecipient);
router.put('/recipients/:id', ...adminOnly, auditController.saveReportRecipient);
router.delete('/recipients/:id', ...adminOnly, auditController.deleteReportRecipient);

// Maintenance (retention floor of 365 days enforced in the controller/service)
router.post('/cleanup', ...superadminOnly, auditController.triggerCleanup);

module.exports = router;
