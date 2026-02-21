const express = require('express');
const router = express.Router();
const gatePassController = require('../controllers/gatePass.controller');
const { protect, checkGateEntryAccess } = require('../../../shared/middleware/auth');
const {
  canCreatePass,
  canVerifyPass,
  canViewAnalytics,
  canCancelPass,
  canExtendPass
} = require('../../../shared/middleware/gateEntryAuth');

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
 * @access Private (Admin only - Analytics permission required)
 */
router.get('/stats', canViewAnalytics, gatePassController.getStats);

/**
 * @route POST /api/v1/gate-entry/verify
 * @desc Verify/Search pass (for guards)
 * @access Private (Admin, Guards only - Verify permission required)
 */
router.post('/verify', canVerifyPass, gatePassController.verifyPass);

/**
 * @route POST /api/v1/gate-entry/allow-entry/:passId
 * @desc Allow entry (guard action)
 * @access Private (Admin, Guards only - Verify permission required)
 */
router.post('/allow-entry/:passId', canVerifyPass, gatePassController.allowEntry);

/**
 * @route POST /api/v1/gate-entry/deny-entry/:passId
 * @desc Deny entry (guard action)
 * @access Private (Admin, Guards only - Verify permission required)
 */
router.post('/deny-entry/:passId', canVerifyPass, gatePassController.denyEntry);

/**
 * @route POST /api/v1/gate-entry/record-exit/:passId
 * @desc Record exit (guard action)
 * @access Private (Admin, Guards only - Verify permission required)
 */
router.post('/record-exit/:passId', canVerifyPass, gatePassController.recordExit);

/**
 * @route POST /api/v1/gate-entry/cancel/:passId
 * @desc Cancel a pass (context-dependent)
 * @access Private (Before check-in: Creator/Admin; After check-in: Creator/Admin/Guard)
 */
router.post('/cancel/:passId', canCancelPass, gatePassController.cancelPass);

/**
 * @route POST /api/v1/gate-entry/extend-pass/:passId
 * @desc Extend pass (modify entry time and date)
 * @access Private (Creator or Admin only - Guard cannot extend)
 */
router.post('/extend-pass/:passId', canExtendPass, gatePassController.extendPass);

/**
 * @route POST /api/v1/gate-entry/checkout/:passId
 * @desc Record checkout using checkout QR code
 * @access Private (Admin, Guards only - Verify permission required)
 */
router.post('/checkout/:passId', canVerifyPass, gatePassController.recordCheckout);

/**
 * @route GET /api/v1/gate-entry/hostels/available
 * @desc Get available hostels for date range
 * @access Private (All authenticated users)
 */
router.get('/hostels/available', checkGateEntryAccess(), gatePassController.getAvailableHostels);

/**
 * @route GET /api/v1/gate-entry/hostels/:hostelId/rooms
 * @desc Get available rooms for a hostel
 * @access Private (All authenticated users)
 */
router.get('/hostels/:hostelId/rooms', checkGateEntryAccess(), gatePassController.getHostelRooms);

/**
 * @route POST /api/v1/gate-entry/bookings/create
 * @desc Create hostel booking
 * @access Private (All authenticated users)
 */
router.post('/bookings/create', checkGateEntryAccess(), gatePassController.createBooking);

/**
 * @route POST /api/v1/gate-entry/bookings/:bookingId/confirm-payment
 * @desc Confirm payment for hostel booking (Test Mode)
 * @access Private (Pass Creator/Admin)
 */
router.post('/bookings/:bookingId/confirm-payment', checkGateEntryAccess(), gatePassController.confirmPayment);

/**
 * @route GET /api/v1/gate-entry/bookings/:passId
 * @desc Get booking details for a pass
 * @access Private (Creator or Admin)
 */
router.get('/bookings/:passId', checkGateEntryAccess(), gatePassController.getBookingByPass);

/**
 * @route GET /api/v1/gate-entry/check-in-history
 * @desc Get check-in history (for guards)
 * @access Private (Admin, Guards only - Verify permission required)
 */
router.get('/check-in-history', canVerifyPass, gatePassController.getCheckInHistory);

/**
 * @route GET /api/v1/gate-entry/export-excel
 * @desc Export check-in history to Excel
 * @access Private (Admin, Guards only - Verify permission required)
 */
router.get('/export-excel', canVerifyPass, gatePassController.exportToExcel);

module.exports = router;
