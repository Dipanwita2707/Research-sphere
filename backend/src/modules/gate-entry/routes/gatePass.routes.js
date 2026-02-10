const express = require('express');
const router = express.Router();
const gatePassController = require('../controllers/gatePass.controller');
const { protect, checkGateEntryAccess } = require('../../../shared/middleware/auth');

// All routes require authentication
router.use(protect);

/**
 * @route POST /api/v1/gate-entry/create-pass
 * @desc Create a new gate pass
 * @access Private (Students can create, others have full access)
 */
router.post('/create-pass', checkGateEntryAccess(), gatePassController.createPass);

/**
 * @route GET /api/v1/gate-entry/passes
 * @desc Get all gate passes with filters
 * @access Private (Not Students)
 */
router.get('/passes', checkGateEntryAccess(), gatePassController.getAllPasses);

/**
 * @route GET /api/v1/gate-entry/stats
 * @desc Get gate pass statistics
 * @access Private (Not Students)
 */
router.get('/stats', checkGateEntryAccess(), gatePassController.getStats);

/**
 * @route POST /api/v1/gate-entry/verify
 * @desc Verify/Search pass (for guards)
 * @access Private (Admin, Guards only)
 */
router.post('/verify', checkGateEntryAccess(true), gatePassController.verifyPass);

/**
 * @route POST /api/v1/gate-entry/allow-entry/:passId
 * @desc Allow entry (guard action)
 * @access Private (Admin, Guards only)
 */
router.post('/allow-entry/:passId', checkGateEntryAccess(true), gatePassController.allowEntry);

/**
 * @route POST /api/v1/gate-entry/deny-entry/:passId
 * @desc Deny entry (guard action)
 * @access Private (Admin, Guards only)
 */
router.post('/deny-entry/:passId', checkGateEntryAccess(true), gatePassController.denyEntry);

/**
 * @route POST /api/v1/gate-entry/record-exit/:passId
 * @desc Record exit (guard action)
 * @access Private (Admin, Guards only)
 */
router.post('/record-exit/:passId', checkGateEntryAccess(true), gatePassController.recordExit);

/**
 * @route POST /api/v1/gate-entry/cancel/:passId
 * @desc Cancel a pass
 * @access Private (Not Students)
 */
router.post('/cancel/:passId', checkGateEntryAccess(), gatePassController.cancelPass);

/**
 * @route GET /api/v1/gate-entry/check-in-history
 * @desc Get check-in history (for guards)
 * @access Private (Admin, Guards only)
 */
router.get('/check-in-history', checkGateEntryAccess(true), gatePassController.getCheckInHistory);

/**
 * @route GET /api/v1/gate-entry/export-excel
 * @desc Export check-in history to Excel
 * @access Private (Admin, Guards only)
 */
router.get('/export-excel', checkGateEntryAccess(true), gatePassController.exportToExcel);

module.exports = router;
