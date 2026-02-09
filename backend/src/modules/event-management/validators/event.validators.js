/**
 * Event Management Validators
 */

const { body, param, query } = require('express-validator');
const { LIMITS, EVENT_TYPE, PAYMENT_TYPE, EVENT_STATUS } = require('../constants/event.constants');

/**
 * Validate event creation/update data
 */
const validateEventUpdate = [
  body('description')
    .optional()
    .trim()
    .isLength({ max: LIMITS.MAX_DESCRIPTION_LENGTH })
    .withMessage(`Description must not exceed ${LIMITS.MAX_DESCRIPTION_LENGTH} characters`),
  
  body('venue')
    .optional()
    .trim()
    .isLength({ max: LIMITS.MAX_VENUE_LENGTH })
    .withMessage(`Venue must not exceed ${LIMITS.MAX_VENUE_LENGTH} characters`),
  
  body('maxCapacity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max capacity must be a positive integer'),
  
  body('registrationFee')
    .optional()
    .isDecimal({ decimal_digits: '0,2' })
    .withMessage('Registration fee must be a valid decimal number'),
  
  body('registrationStartDate')
    .optional()
    .isISO8601()
    .withMessage('Registration start date must be a valid date'),
  
  body('registrationEndDate')
    .optional()
    .isISO8601()
    .withMessage('Registration end date must be a valid date'),
];

/**
 * Validate event ID parameter
 */
const validateEventId = [
  param('id')
    .isUUID()
    .withMessage('Invalid event ID'),
];

/**
 * Validate event publish
 */
const validateEventPublish = [
  body('registrationStartDate')
    .optional()
    .isISO8601()
    .withMessage('Registration start date must be a valid date'),
  
  body('registrationEndDate')
    .optional()
    .isISO8601()
    .withMessage('Registration end date must be a valid date'),
];

/**
 * Validate registration
 */
const validateRegistration = [
  body('eventId')
    .isUUID()
    .withMessage('Invalid event ID'),
];

/**
 * Validate QR code scan
 */
const validateQRScan = [
  body('qrCode')
    .notEmpty()
    .withMessage('QR code is required')
    .isString()
    .withMessage('QR code must be a string'),
  
  body('entryType')
    .notEmpty()
    .withMessage('Entry type is required')
    .isIn(['entry', 'exit'])
    .withMessage('Entry type must be either entry or exit'),
  
  body('gateLocation')
    .optional()
    .trim()
    .isLength({ max: 128 })
    .withMessage('Gate location must not exceed 128 characters'),
  
  body('remarks')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Remarks must not exceed 500 characters'),
];

/**
 * Validate volunteer assignment
 */
const validateVolunteerAssignment = [
  body('userId')
    .isUUID()
    .withMessage('Invalid user ID'),
  
  body('role')
    .optional()
    .trim()
    .isLength({ max: 128 })
    .withMessage('Role must not exceed 128 characters'),
  
  body('canScanQr')
    .optional()
    .isBoolean()
    .withMessage('canScanQr must be a boolean'),
  
  body('assignedGate')
    .optional()
    .trim()
    .isLength({ max: 128 })
    .withMessage('Assigned gate must not exceed 128 characters'),
];

/**
 * Validate list query parameters
 */
const validateListQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: LIMITS.MAX_PAGE_SIZE })
    .withMessage(`Limit must be between 1 and ${LIMITS.MAX_PAGE_SIZE}`),
  
  query('status')
    .optional()
    .isIn(Object.values(EVENT_STATUS))
    .withMessage('Invalid status'),
  
  query('eventType')
    .optional()
    .isIn(Object.values(EVENT_TYPE))
    .withMessage('Invalid event type'),
  
  query('search')
    .optional()
    .trim()
    .isLength({ max: 256 })
    .withMessage('Search term must not exceed 256 characters'),
];

module.exports = {
  validateEventUpdate,
  validateEventId,
  validateEventPublish,
  validateRegistration,
  validateQRScan,
  validateVolunteerAssignment,
  validateListQuery,
};
