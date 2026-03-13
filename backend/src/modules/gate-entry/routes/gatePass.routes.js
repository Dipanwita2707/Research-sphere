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
const { getStudentGuardians } = require('../services/guardian.service');

// All routes require authentication
router.use(protect);

/**
 * @route GET /api/v1/gate-entry/guardians
 * @desc Get student's guardians/parents
 * @access Private (Students only)
 */
router.get('/guardians', async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role?.toLowerCase();
    
    if (userRole !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can access guardian list'
      });
    }
    
    const guardians = await getStudentGuardians(userId);
    
    res.json({
      success: true,
      data: { guardians }
    });
  } catch (error) {
    console.error('[GET GUARDIANS] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch guardians',
      error: error.message
    });
  }
});

/**
 * @route GET /api/v1/gate-entry/check-duplicate
 * @desc Check if a duplicate pass exists for the same visitor
 * @access Private (Authenticated users)
 */
router.get('/check-duplicate', async (req, res) => {
  try {
    const { mobile, name, visitDate, visitEndDate } = req.query;
    
    // Validate required parameters
    if (!mobile || !name || !visitDate) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number, name, and visit date are required'
      });
    }
    
    // Import service (exports an instance, not a class)
    const gatePassService = require('../services/gatePass.service');
    
    // Check for duplicates
    const result = await gatePassService.checkDuplicatePass(
      mobile,
      name,
      visitDate,
      visitEndDate || null
    );
    
    if (result.isDuplicate) {
      return res.json({
        success: true,
        isDuplicate: true,
        message: `${name} (${mobile}) already has an active pass`,
        conflictingPasses: result.conflictingPasses
      });
    }
    
    res.json({
      success: true,
      isDuplicate: false,
      message: 'No duplicate pass found'
    });
  } catch (error) {
    console.error('[CHECK DUPLICATE] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check for duplicate passes',
      error: error.message
    });
  }
});

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
 * @route GET /api/v1/gate-entry/analytics
 * @desc Get comprehensive analytics for Gate Entry module
 * @access Private (Admin only - Analytics permission required)
 */
router.get('/analytics', canViewAnalytics, gatePassController.getAdvancedAnalytics);

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
 * @route POST /api/v1/gate-entry/extend-pass/:passId/check
 * @desc Check extension options for guest house booking (same room/alternate room)
 * @access Private (Creator or Admin only)
 */
router.post('/extend-pass/:passId/check', canExtendPass, gatePassController.checkExtendPassOptions);

/**
 * @route POST /api/v1/gate-entry/extend-pass/:passId/confirm
 * @desc Confirm pass extension with room decision
 * @access Private (Creator or Admin only)
 */
router.post('/extend-pass/:passId/confirm', canExtendPass, gatePassController.confirmExtendPass);

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
 * @route POST /api/v1/gate-entry/bookings/:bookingId/early-checkin
 * @desc Request early check-in (before 10 AM) for a guest house booking
 * @access Private (Creator)
 */
router.post('/bookings/:bookingId/early-checkin', checkGateEntryAccess(), gatePassController.requestEarlyCheckin);

/**
 * @route POST /api/v1/gate-entry/bookings/:bookingId/approve-checkin
 * @desc Approve early check-in request (admin/guard only)
 * @access Private (Admin, Guards - Verify permission required)
 */
router.post('/bookings/:bookingId/approve-checkin', canVerifyPass, gatePassController.approveEarlyCheckin);

/**
 * @route POST /api/v1/gate-entry/bookings/:bookingId/reject-checkin
 * @desc Reject early check-in request (admin/guard only)
 * @access Private (Admin, Guards - Verify permission required)
 */
router.post('/bookings/:bookingId/reject-checkin', canVerifyPass, gatePassController.rejectEarlyCheckin);

/**
 * @route GET /api/v1/gate-entry/check-in-history
 * @desc Get check-in history (for guards)
 * @access Private (Admin, Guards only - Verify permission required)
 */
router.get('/check-in-history', canVerifyPass, gatePassController.getCheckInHistory);

/**
 * @route GET /api/v1/gate-entry/daily-entries/:passId
 * @desc Get daily entry/exit records for a multi-day pass
 * @access Private (Admin, Guards only - Verify permission required)
 */
router.get('/daily-entries/:passId', canVerifyPass, gatePassController.getDailyEntries);

/**
 * @route GET /api/v1/gate-entry/export-excel
 * @desc Export check-in history to Excel
 * @access Private (Admin, Guards only - Verify permission required)
 */
router.get('/export-excel', canVerifyPass, gatePassController.exportToExcel);

/**
 * @route GET /api/v1/gate-entry/config
 * @desc Get all system configurations (admin only)
 * @access Private (Admin only)
 */
router.get('/config', gatePassController.getAllSystemConfigs);

/**
 * @route GET /api/v1/gate-entry/config/:key
 * @desc Get specific system configuration by key
 * @access Private (All authenticated users can view)
 */
router.get('/config/:key', gatePassController.getSystemConfig);

/**
 * @route PUT /api/v1/gate-entry/config/:key
 * @desc Update system configuration (admin only)
 * @access Private (Admin only)
 */
router.put('/config/:key', gatePassController.updateSystemConfig);

/**
 * @route GET /api/v1/gate-entry/refunds
 * @desc Get all refund transactions (admin only)
 * @access Private (Admin only)
 */
router.get('/refunds', gatePassController.getAllRefunds);

/**
 * @route GET /api/v1/gate-entry/refunds/:bookingId
 * @desc Get refund transaction for specific booking
 * @access Private (Creator or Admin)
 */
router.get('/refunds/:bookingId', gatePassController.getRefundByBooking);

module.exports = router;
