/**
 * Event Management Routes — Main Router
 *
 * Defines core event API endpoints and mounts domain-specific sub-routers
 * for teams, payments, stalls, prizes, coupons, bulk emails, and settings.
 *
 * Route order matters: static paths (e.g. /stall-opportunities) MUST appear
 * before parameterized paths (e.g. /:id) to avoid Express matching conflicts.
 */

const express = require('express');
const router = express.Router();
const prisma = require('../../../shared/config/database');
const eventController = require('../controllers/event.controller');
const {
  validateEventUpdate,
  validateEventId,
  validateEventPublish,
  validateQRScan,
  validateVolunteerAssignment,
  validateListQuery,
  validateFeedback,
} = require('../validators/event.validators');
const {
  protect,
  checkPermission,
  checkAnyPermission,
} = require('../../../shared/middleware/auth');
const { getDefaultPermissions } = require('../../../shared/config/permissions.config');
const feedbackController = require('../controllers/feedback.controller');
const paymentController = require('../controllers/payment.controller');
const registrationController = require('../controllers/registration.controller');
const customFieldController = require('../controllers/customField.controller');
const rateLimit = require('express-rate-limit');
const { PUBLIC_RATE_LIMIT } = require('../constants/event.constants');

// ── Sub-routers ─────────────────────────────────────────────────────
const teamRoutes = require('./team.routes');
const paymentRoutes = require('./payment.routes');
const stallRoutes = require('./stall.routes');
const prizeRoutes = require('./prize.routes');
const couponRoutes = require('./coupon.routes');
const bulkEmailRoutes = require('./bulkEmail.routes');
const settingsRoutes = require('./settings.routes');

// Rate limiter for public (unauthenticated) endpoints to prevent abuse
const publicEndpointLimiter = rateLimit({
  windowMs: PUBLIC_RATE_LIMIT.WINDOW_MS,
  max: PUBLIC_RATE_LIMIT.MAX_REQUESTS,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const eventManagePerm = checkAnyPermission(
  ['event_manage_own', 'event_manage_all'],
  { checkDefaultPermissions: true }
);

// ════════════════════════════════════════════════════════════════════
//  PUBLIC ROUTES (no auth)
// ════════════════════════════════════════════════════════════════════

// Razorpay Webhook — verified via signature, must use raw body parser
router.post(
  '/payments/webhook',
  express.raw({ type: 'application/json' }),
  paymentController.handleWebhook
);

// Public feedback endpoints (QR scanner users)
router.post('/:id/feedback', publicEndpointLimiter, validateEventId, validateFeedback, feedbackController.submitFeedback);
router.get('/:id/feedback-info', publicEndpointLimiter, validateEventId, feedbackController.getFeedbackFormInfo);

// Public stall feedback (scanned by customers at the stall)
router.get('/:id/stalls/:stallId/feedback-info', publicEndpointLimiter, feedbackController.getStallFeedbackFormInfo);
router.post('/:id/stalls/:stallId/feedback', publicEndpointLimiter, feedbackController.submitStallFeedback);

// ════════════════════════════════════════════════════════════════════
//  AUTHENTICATED ROUTES
// ════════════════════════════════════════════════════════════════════

router.use(protect);

/**
 * Allow scan if user has event_manage_attendance OR is a volunteer with canScanQr
 */
const allowEventScan = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Check 1: event_manage_attendance permission
    const defaultPerms = getDefaultPermissions(user.role);
    if (defaultPerms.event_manage_attendance === true) {
      return next();
    }
    const permissionVariants = ['event_manage_attendance', 'event_event_manage_attendance'];
    const hasExplicit = (user.centralDeptPermissions || []).some(d =>
      d.permissions && permissionVariants.some(v => d.permissions[v] === true)
    ) || (user.schoolDeptPermissions || []).some(d =>
      d.permissions && permissionVariants.some(v => d.permissions[v] === true)
    );
    if (hasExplicit) {
      return next();
    }

    // Check 2: volunteer with canScanQr for this event
    const eventId = req.params?.id;
    const userId = user.id;
    if (eventId && userId) {
      const volunteer = await prisma.eventVolunteer.findFirst({
        where: { eventId, userId, canScanQr: true },
      });
      if (volunteer) return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied - event_manage_attendance or volunteer with QR scan permission required',
    });
  } catch (e) {
    console.error('allowEventScan error:', e);
    return res.status(500).json({ success: false, message: 'Permission check failed' });
  }
};

// ── Core Event Routes ───────────────────────────────────────────────

// List events
router.get('/', validateListQuery, eventController.listEvents);

// Aggregate routes (must be before /:id)
router.get('/registrations/my', eventController.getMyRegistrations);
router.get('/volunteers/my', eventController.getMyVolunteerAssignments);
router.get('/volunteers/my/activity', eventController.getMyVolunteerActivity);

// Stall opportunities (must be before /:id)
const stallController = require('../controllers/stall.controller');
router.get('/stall-opportunities', stallController.getStallOpportunities);

// Event Settings: hierarchy data for UI (must be before /:id)
const eventSettingsController = require('../controllers/eventSettings.controller');
router.get('/hierarchy/data', eventSettingsController.getHierarchyData);

// Get event by ID
router.get('/:id', validateEventId, eventController.getEvent);

// Update event
router.patch('/:id', validateEventId, eventManagePerm, validateEventUpdate, eventController.updateEvent);

// Publish event
router.post('/:id/publish', validateEventId, checkPermission('event_publish', { checkDefaultPermissions: true }), validateEventPublish, eventController.publishEvent);

// Register for event
router.post('/:id/register', validateEventId, eventController.registerForEvent);

// Get event statistics
router.get('/:id/statistics', validateEventId, checkAnyPermission(['event_view_reports', 'event_manage_own', 'event_manage_all'], { checkDefaultPermissions: true }), eventController.getEventStatistics);

// Registration filter options
router.get('/:id/registrations/filter-options', validateEventId, eventManagePerm, eventController.getRegistrationFilterOptions);

// Get event registrations (creator)
router.get('/:id/registrations', validateEventId, eventManagePerm, eventController.getEventRegistrations);

// Detailed registration info (admin)
router.get('/:id/registrations/:regId/details', validateEventId, eventManagePerm, eventController.getRegistrationDetails);

// ── Volunteer Routes ────────────────────────────────────────────────

router.post('/:id/volunteers', validateEventId, checkPermission('event_assign_volunteers', { checkDefaultPermissions: true }), validateVolunteerAssignment, eventController.assignVolunteer);
router.get('/:id/volunteers/:volunteerId/activity', validateEventId, eventManagePerm, eventController.getVolunteerActivity);
router.get('/:id/volunteers', validateEventId, eventManagePerm, eventController.getEventVolunteers);

// Scan QR code for entry/exit
router.post('/:id/scan', validateEventId, allowEventScan, validateQRScan, eventController.scanQRCode);

// ── Feedback Routes ─────────────────────────────────────────────────

router.get('/:id/feedback', validateEventId, eventManagePerm, feedbackController.getFeedback);
router.get('/:id/stalls/:stallId/feedback', validateEventId, eventManagePerm, feedbackController.getStallFeedback);
router.get('/:id/stalls/:stallId/owner-feedback', validateEventId, feedbackController.getStallOwnerFeedback);

// ── Registration & Custom Fields ────────────────────────────────────

router.get('/profile-data', registrationController.getProfileData);
router.get('/registration-dashboard', registrationController.getRegistrationDashboard);

router.get('/:id/registration-form', registrationController.getRegistrationForm);
router.post('/:id/register-with-form', registrationController.submitRegistrationForm);
router.get('/:id/registration-settings', customFieldController.getRegistrationSettings);
router.patch('/:id/registration-settings', validateEventId, eventManagePerm, customFieldController.updateRegistrationSettings);
router.get('/:id/custom-fields', customFieldController.getCustomFields);
router.post('/:id/custom-fields', validateEventId, eventManagePerm, customFieldController.createCustomField);
router.patch('/:id/custom-fields/:fieldId', validateEventId, eventManagePerm, customFieldController.updateCustomField);
router.delete('/:id/custom-fields/:fieldId', validateEventId, eventManagePerm, customFieldController.deleteCustomField);
router.patch('/:id/custom-fields/reorder', validateEventId, eventManagePerm, customFieldController.reorderCustomFields);

// ── Mount Sub-routers ───────────────────────────────────────────────

router.use(teamRoutes);
router.use(paymentRoutes);
router.use(stallRoutes);
router.use(prizeRoutes);
router.use(couponRoutes);
router.use(bulkEmailRoutes);
router.use(settingsRoutes);

module.exports = router;
