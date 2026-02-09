/**
 * Event Management Routes
 * 
 * Defines all API endpoints for event management
 */

const express = require('express');
const router = express.Router();
const eventController = require('../controllers/event.controller');
const {
  validateEventUpdate,
  validateEventId,
  validateEventPublish,
  validateRegistration,
  validateQRScan,
  validateVolunteerAssignment,
  validateListQuery,
} = require('../validators/event.validators');
const { protect } = require('../../../shared/middleware/auth');

// All routes require authentication
router.use(protect);

/**
 * Event Routes
 */

// List events
router.get(
  '/',
  validateListQuery,
  eventController.listEvents
);

// Get my registrations
router.get(
  '/registrations/my',
  eventController.getMyRegistrations
);

// Get event by ID
router.get(
  '/:id',
  validateEventId,
  eventController.getEvent
);

// Update event
router.patch(
  '/:id',
  validateEventId,
  validateEventUpdate,
  eventController.updateEvent
);

// Publish event
router.post(
  '/:id/publish',
  validateEventId,
  validateEventPublish,
  eventController.publishEvent
);

// Register for event
router.post(
  '/:id/register',
  validateEventId,
  eventController.registerForEvent
);

// Get event statistics
router.get(
  '/:id/statistics',
  validateEventId,
  eventController.getEventStatistics
);

// Get event registrations (for event creator)
router.get(
  '/:id/registrations',
  validateEventId,
  eventController.getEventRegistrations
);

// Assign volunteer to event
router.post(
  '/:id/volunteers',
  validateEventId,
  validateVolunteerAssignment,
  eventController.assignVolunteer
);

// Get event volunteers
router.get(
  '/:id/volunteers',
  validateEventId,
  eventController.getEventVolunteers
);

// Scan QR code for entry/exit
router.post(
  '/:id/scan',
  validateEventId,
  validateQRScan,
  eventController.scanQRCode
);

module.exports = router;
