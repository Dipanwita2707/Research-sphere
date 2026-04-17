/**
 * TMS Validators
 * express-validator middleware arrays for request validation
 */
const { body, param, query, validationResult } = require('express-validator');
const { ValidationError } = require('../../../shared/utils/AppError');
const { MESSAGE_TYPE, PRIORITY, LIMITS } = require('../constants/tms.constants');

/**
 * Collect validation errors and throw ValidationError
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg);
    throw new ValidationError(messages.join('; '));
  }
  next();
};

// ======================================
// Ticket Validators
// ======================================
const createTicketValidation = [
  body('messageType')
    .notEmpty().withMessage('Message type is required')
    .isIn(Object.values(MESSAGE_TYPE)).withMessage(`Message type must be one of: ${Object.values(MESSAGE_TYPE).join(', ')}`),
  body('subject')
    .notEmpty().withMessage('Subject is required')
    .isString().trim()
    .isLength({ min: 3, max: 256 }).withMessage('Subject must be between 3 and 256 characters'),
  body('masterCategoryId')
    .notEmpty().withMessage('Master category is required')
    .isUUID().withMessage('Invalid master category ID'),
  body('categoryId')
    .notEmpty().withMessage('Category is required')
    .isUUID().withMessage('Invalid category ID'),
  body('subCategoryId')
    .notEmpty().withMessage('Sub-category is required')
    .isUUID().withMessage('Invalid sub-category ID'),
  body('contactNumber')
    .notEmpty().withMessage('Contact number is required')
    .matches(/^[0-9+\-\s()]{7,20}$/).withMessage('Invalid contact number format'),
  body('description')
    .notEmpty().withMessage('Description is required')
    .isString().trim()
    .isLength({ min: 10, max: LIMITS.MAX_DESCRIPTION_LENGTH })
    .withMessage(`Description must be between 10 and ${LIMITS.MAX_DESCRIPTION_LENGTH} characters`),
  body('documentPath')
    .optional()
    .isString().trim(),
  body('documentName')
    .optional()
    .isString().trim()
    .isLength({ max: 256 }).withMessage('Document name too long'),
  body('priority')
    .optional()
    .isIn(Object.values(PRIORITY)).withMessage(`Priority must be one of: ${Object.values(PRIORITY).join(', ')}`),
  handleValidationErrors,
];

const ticketIdValidation = [
  param('id')
    .isUUID().withMessage('Invalid ticket ID'),
  handleValidationErrors,
];

const addRemarkValidation = [
  param('id')
    .isUUID().withMessage('Invalid ticket ID'),
  body('remarks')
    .notEmpty().withMessage('Remarks are required')
    .isString().trim()
    .isLength({ max: LIMITS.MAX_REMARKS_LENGTH })
    .withMessage(`Remarks must not exceed ${LIMITS.MAX_REMARKS_LENGTH} characters`),
  handleValidationErrors,
];

const escalateValidation = [
  param('id')
    .isUUID().withMessage('Invalid ticket ID'),
  body('remarks')
    .notEmpty().withMessage('Escalation reason is required')
    .isString().trim()
    .isLength({ max: LIMITS.MAX_REMARKS_LENGTH })
    .withMessage(`Remarks must not exceed ${LIMITS.MAX_REMARKS_LENGTH} characters`),
  handleValidationErrors,
];

const resolveValidation = [
  param('id')
    .isUUID().withMessage('Invalid ticket ID'),
  body('remarks')
    .notEmpty().withMessage('Resolution remarks are required')
    .isString().trim()
    .isLength({ max: LIMITS.MAX_REMARKS_LENGTH })
    .withMessage(`Remarks must not exceed ${LIMITS.MAX_REMARKS_LENGTH} characters`),
  handleValidationErrors,
];

const closeValidation = [
  param('id')
    .isUUID().withMessage('Invalid ticket ID'),
  body('remarks')
    .optional()
    .isString().trim()
    .isLength({ max: LIMITS.MAX_REMARKS_LENGTH }),
  handleValidationErrors,
];

const ratingValidation = [
  param('id')
    .isUUID().withMessage('Invalid ticket ID'),
  body('rating')
    .notEmpty().withMessage('Rating is required')
    .isInt({ min: LIMITS.MIN_RATING, max: LIMITS.MAX_RATING })
    .withMessage(`Rating must be between ${LIMITS.MIN_RATING} and ${LIMITS.MAX_RATING}`),
  body('feedback')
    .optional()
    .isString().trim()
    .isLength({ max: 1000 }).withMessage('Feedback must not exceed 1000 characters'),
  handleValidationErrors,
];

const listTicketsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: LIMITS.MAX_PAGE_SIZE })
    .withMessage(`Limit must be between 1 and ${LIMITS.MAX_PAGE_SIZE}`),
  query('status')
    .optional()
    .isString(),
  query('messageType')
    .optional()
    .isIn(Object.values(MESSAGE_TYPE)).withMessage('Invalid message type'),
  query('priority')
    .optional()
    .isIn(Object.values(PRIORITY)).withMessage('Invalid priority'),
  query('search')
    .optional()
    .isString().trim(),
  handleValidationErrors,
];

// ======================================
// Category Admin Validators
// ======================================
const createMasterCategoryValidation = [
  body('name')
    .notEmpty().withMessage('Name is required')
    .isString().trim()
    .isLength({ min: 2, max: 256 }).withMessage('Name must be between 2 and 256 characters'),
  body('description')
    .optional()
    .isString().trim()
    .isLength({ max: 512 }),
  body('isAcademic')
    .optional()
    .isBoolean().withMessage('isAcademic must be a boolean'),
  body('employeeId')
    .optional()
    .isString().trim().notEmpty().withMessage('Employee ID cannot be empty'),
  body('sortOrder')
    .optional()
    .isInt({ min: 0 }).withMessage('Sort order must be a non-negative integer'),
  handleValidationErrors,
];

const createCategoryValidation = [
  body('name')
    .notEmpty().withMessage('Name is required')
    .isString().trim()
    .isLength({ min: 2, max: 256 }),
  body('masterCategoryId')
    .notEmpty().withMessage('Master category ID is required')
    .isUUID().withMessage('Invalid master category ID'),
  body('description')
    .optional()
    .isString().trim()
    .isLength({ max: 512 }),
  body('employeeId')
    .optional()
    .isString().trim().notEmpty().withMessage('Employee ID cannot be empty'),
  body('sortOrder')
    .optional()
    .isInt({ min: 0 }),
  handleValidationErrors,
];

const createSubCategoryValidation = [
  body('name')
    .notEmpty().withMessage('Name is required')
    .isString().trim()
    .isLength({ min: 2, max: 256 }),
  body('categoryId')
    .notEmpty().withMessage('Category ID is required')
    .isUUID().withMessage('Invalid category ID'),
  body('description')
    .optional()
    .isString().trim()
    .isLength({ max: 512 }),
  body('employeeId')
    .optional()
    .isString().trim().notEmpty().withMessage('Employee ID cannot be empty'),
  body('sortOrder')
    .optional()
    .isInt({ min: 0 }),
  handleValidationErrors,
];

const updateCategoryValidation = [
  param('id')
    .isUUID().withMessage('Invalid category ID'),
  body('name')
    .optional()
    .isString().trim()
    .isLength({ min: 2, max: 256 }),
  body('description')
    .optional()
    .isString().trim()
    .isLength({ max: 512 }),
  body('employeeId')
    .optional({ nullable: true })
    .isString().trim(),
  body('isActive')
    .optional()
    .isBoolean(),
  body('sortOrder')
    .optional()
    .isInt({ min: 0 }),
  handleValidationErrors,
];

module.exports = {
  createTicketValidation,
  ticketIdValidation,
  addRemarkValidation,
  escalateValidation,
  resolveValidation,
  closeValidation,
  ratingValidation,
  listTicketsValidation,
  createMasterCategoryValidation,
  createCategoryValidation,
  createSubCategoryValidation,
  updateCategoryValidation,
};
