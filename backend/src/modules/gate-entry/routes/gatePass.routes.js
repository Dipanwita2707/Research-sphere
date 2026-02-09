const express = require('express');
const router = express.Router();
const gatePassController = require('../controllers/gatePass.controller');
const employeeController = require('../controllers/employee.controller');
const { protect } = require('../../../shared/middleware/auth');

// All routes require authentication
router.use(protect);

/**
 * @route GET /api/v1/gate-entry/employees
 * @desc Get all active employees for dropdown
 * @access Private (Admin, Staff)
 */
router.get('/employees', employeeController.getActiveEmployees);

/**
 * @route GET /api/v1/gate-entry/departments
 * @desc Get all active departments for dropdown
 * @access Private (Admin, Staff)
 */
router.get('/departments', employeeController.getActiveDepartments);

/**
 * @route POST /api/v1/gate-entry/create-pass
 * @desc Create a new gate pass
 * @access Private (Admin, Staff)
 */
router.post('/create-pass', gatePassController.createPass);

/**
 * @route GET /api/v1/gate-entry/passes
 * @desc Get all gate passes with filters
 * @access Private
 */
router.get('/passes', gatePassController.getAllPasses);

/**
 * @route GET /api/v1/gate-entry/stats
 * @desc Get gate pass statistics
 * @access Private
 */
router.get('/stats', gatePassController.getStats);

/**
 * @route POST /api/v1/gate-entry/verify
 * @desc Verify/Search pass (for guards)
 * @access Private (Guards)
 */
router.post('/verify', gatePassController.verifyPass);

/**
 * @route POST /api/v1/gate-entry/allow-entry/:passId
 * @desc Allow entry (guard action)
 * @access Private (Guards)
 */
router.post('/allow-entry/:passId', gatePassController.allowEntry);

/**
 * @route POST /api/v1/gate-entry/deny-entry/:passId
 * @desc Deny entry (guard action)
 * @access Private (Guards)
 */
router.post('/deny-entry/:passId', gatePassController.denyEntry);

/**
 * @route POST /api/v1/gate-entry/record-exit/:passId
 * @desc Record exit (guard action)
 * @access Private (Guards)
 */
router.post('/record-exit/:passId', gatePassController.recordExit);

/**
 * @route POST /api/v1/gate-entry/cancel/:passId
 * @desc Cancel a pass
 * @access Private
 */
router.post('/cancel/:passId', gatePassController.cancelPass);

/**
 * @route GET /api/v1/gate-entry/check-in-history
 * @desc Get check-in history (for guards)
 * @access Private (Guards)
 */
router.get('/check-in-history', gatePassController.getCheckInHistory);

/**
 * @route GET /api/v1/gate-entry/export-excel
 * @desc Export check-in history to Excel
 * @access Private (Guards, Admin)
 */
router.get('/export-excel', gatePassController.exportToExcel);

module.exports = router;
