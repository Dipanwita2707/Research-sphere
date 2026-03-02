/**
 * Event Management Validators
 */

const { body, param, query } = require('express-validator');
const { LIMITS, EVENT_TYPE, PAYMENT_TYPE, EVENT_STATUS } = require('../constants/event.constants');
const { isValidMobile } = require('../../../shared/utils/validators');

/**
 * Validate event creation/update data
 */
const validateEventUpdate = [
  body('description')
    .optional()
    .trim()
    .custom((val) => {
      if (!val) return true;
      const words = val.split(/\s+/).filter(Boolean).length;
      if (words > 10) throw new Error('Short description must be at most 10 words');
      return true;
    }),
  
  body('longDescription')
    .optional()
    .trim()
    .isLength({ max: LIMITS.MAX_LONG_DESCRIPTION_LENGTH || 50000 })
    .withMessage('Detailed description exceeds maximum length'),
  
  body('logoImageUrl')
    .optional()
    .trim()
    .isLength({ max: 2048 })
    .withMessage('Logo URL must not exceed 2048 characters'),
  
  body('venue')
    .optional()
    .trim()
    .isLength({ max: LIMITS.MAX_VENUE_LENGTH })
    .withMessage(`Venue must not exceed ${LIMITS.MAX_VENUE_LENGTH} characters`),
  
  body('contactPersonName')
    .optional()
    .trim()
    .isLength({ max: LIMITS.MAX_CONTACT_NAME_LENGTH || 256 })
    .withMessage('Contact person name must not exceed 256 characters'),
  
  body('contactEmail')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please enter a valid contact email address')
    .normalizeEmail(),
  
  body('contactMobile')
    .optional()
    .trim()
    .custom((val) => !val || isValidMobile(val))
    .withMessage('Please enter a valid 10-digit mobile number'),
  
  body('websiteUrl')
    .optional()
    .trim()
    .isURL({ protocols: ['http', 'https'], require_protocol: false })
    .withMessage('Please enter a valid website URL'),
  
  body('registrationCap')
    .optional()
    .isInt({ min: LIMITS.REGISTRATION_CAP_MIN ?? 1, max: LIMITS.REGISTRATION_CAP_MAX ?? 100000 })
    .withMessage(`Registration cap must be between ${LIMITS.REGISTRATION_CAP_MIN ?? 1} and ${LIMITS.REGISTRATION_CAP_MAX ?? 100000}`),
  
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

  body('eligibilityDisplayFormat')
    .optional()
    .isIn(['points', 'paragraph', 'both'])
    .withMessage('Eligibility display format must be points, paragraph, or both'),

  body('rulesDisplayFormat')
    .optional()
    .isIn(['points', 'paragraph', 'both'])
    .withMessage('Rules display format must be points, paragraph, or both'),
];

/**
 * Validate event ID parameter
 */
const validateEventId = [
  param('id')
    .notEmpty()
    .withMessage('Event ID is required')
    .custom((val) => /^[A-Za-z0-9-]+$/.test(val))
    .withMessage('Invalid event ID format'),
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

/**
 * Validate feedback submission (10 points 1-10 + shortDescription)
 */
const validateFeedback = [
  body('points')
    .isArray({ min: 10, max: 10 })
    .withMessage('Please provide exactly 10 ratings (1-10)'),
  body('points.*')
    .isInt({ min: 1, max: 10 })
    .withMessage('Each point must be between 1 and 10'),
  body('shortDescription')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Short description must not exceed 2000 characters'),
];

module.exports = {
  validateEventUpdate,
  validateEventId,
  validateEventPublish,
  validateRegistration,
  validateQRScan,
  validateVolunteerAssignment,
  validateListQuery,
  validateFeedback,
};
