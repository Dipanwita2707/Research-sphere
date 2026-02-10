/**
 * DSW Audit Routes
 * Routes for audit log access
 */

const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { canViewAuditLogs } = require('../middleware/rbac');

// Get audit logs by action type
router.get('/action/:action', canViewAuditLogs, auditController.getAuditLogsByAction);

// Get my audit logs
router.get('/my', auditController.getMyAuditLogs);

module.exports = router;
