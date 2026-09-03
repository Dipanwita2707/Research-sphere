const express = require('express');
const router = express.Router();
const superadminController = require('../controllers/superadmin.controller');
const licenseController = require('../controllers/license.controller');
const { protect, restrictTo } = require('../../../shared/middleware/auth');

// Protect all routes inside superadmin module
router.use(protect);
router.use(restrictTo('superadmin'));

// Universities CRUD
router.get('/universities', superadminController.getAllUniversities);
router.get('/universities/:id', superadminController.getUniversityById);
router.get('/universities/:id/affiliation-variants', superadminController.previewUniversityAffiliationVariants);
router.post('/universities', superadminController.createUniversity);
router.put('/universities/:id', superadminController.updateUniversity);
router.post('/universities/:id/suspend', superadminController.suspendUniversity);
router.get('/universities/:id/admins', superadminController.getUniversityAdmins);
router.post('/universities/:id/admins', superadminController.createUniversityAdmin);

// SaaS Tiers CRUD
router.get('/tiers', superadminController.getAllTiers);
router.post('/tiers', superadminController.createTier);
router.put('/tiers/:id', superadminController.updateTier);

// Dashboard & Analytics
router.get('/analytics/overview', superadminController.getGlobalStats);
router.get('/analytics/api-monitor', superadminController.getApiMonitorStats);

// ── License Management (Kill Switch & Hardware Approval) ───────────────────────────
// POST   /api/v1/superadmin/license/issue           — create a new license key
// GET    /api/v1/superadmin/license/list            — view all licenses & pending approvals
// POST   /api/v1/superadmin/license/approve/:id     — APPROVE pending hardware registration
// POST   /api/v1/superadmin/license/authorize/:id   — explicitly whitelist a hardwareId
// POST   /api/v1/superadmin/license/revoke/:id      — KILL SWITCH: revoke access
// POST   /api/v1/superadmin/license/reset-hardware/:id — rebind / clear hardware
// DELETE /api/v1/superadmin/license/:id             — delete license record
router.post('/license/issue', licenseController.issueLicense);
router.get('/license/list', licenseController.listLicenses);
router.post('/license/approve/:id', licenseController.approveHardware);
router.post('/license/approve-hardware/:id', licenseController.approveHardware);
router.post('/license/authorize/:id', licenseController.authorizeHardware);
router.post('/license/authorize-hardware/:id', licenseController.authorizeHardware);
router.post('/license/revoke/:id', licenseController.revokeLicense);
router.post('/license/reset-hardware/:id', licenseController.resetHardware);
router.delete('/license/:id', licenseController.deleteLicense);

module.exports = router;
