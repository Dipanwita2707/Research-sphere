/**
 * Express-Validator Middleware for Noting System
 * Provides input validation for all noting routes
 */

const { body, query, param } = require('express-validator');
const { validationResult } = require('express-validator');
const { ValidationError } = require('../../../shared/utils/AppError');
const { CATEGORIES } = require('../config/noting.config');

/**
 * Handle validation errors
 * Collects all validation errors and throws a single ValidationError
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors
      .array()
      .map((err) => err.msg)
      .join('; ');
    throw new ValidationError(errorMessages);
  }
  next();
};

/**
 * Get valid category values
 */
const getValidCategories = () => Object.keys(CATEGORIES);

/**
 * Get valid subcategories for a category
 */
const getValidSubcategories = (category) => {
  if (!CATEGORIES[category]) return [];
  return Object.keys(CATEGORIES[category].subcategories);
};

/**
 * Validation rules for creating a note
 */
const createNoteValidation = [
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isIn(getValidCategories())
    .withMessage(`Category must be one of: ${getValidCategories().join(', ')}`),

  body('subcategory')
    .notEmpty()
    .withMessage('Subcategory is required')
    .custom((value, { req }) => {
      const validSubs = getValidSubcategories(req.body.category);
      if (validSubs.length && !validSubs.includes(value)) {
        throw new Error(`Subcategory must be one of: ${validSubs.join(', ')}`);
      }
      return true;
    }),

  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string')
    .trim(),

  body('approvalPeriod')
    .optional()
    .isIn(['one_time', 'recurring'])
    .withMessage('Approval period must be one_time or recurring'),

  body('recurringFrequency')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (!value) return true; // Allow empty/null values
      return ['weekly', 'monthly', 'quarterly', 'half_yearly', 'annually'].includes(value);
    })
    .withMessage('Invalid recurring frequency'),


  body('policyCompliance')
    .optional()
    .isIn(['yes', 'no'])
    .withMessage('Policy compliance must be yes or no'),

  body('amountRequired')
    .optional()
    .isBoolean()
    .withMessage('Amount required must be a boolean'),

  body('amount')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric()
    .withMessage('Amount must be a number'),

  body('points')
    .optional()
    .isArray()
    .withMessage('Points must be an array'),

  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array'),

  body('submit')
    .optional()
    .isBoolean()
    .withMessage('Submit must be a boolean'),

  handleValidationErrors,
];

/**
 * Validation rules for updating a draft
 */
const updateDraftValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid note ID'),

  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string')
    .trim(),

  body('approvalPeriod')
    .optional()
    .isIn(['one_time', 'recurring'])
    .withMessage('Approval period must be one_time or recurring'),

  body('recurringFrequency')
    .optional()
    .custom((value) => {
      if (!value) return true; // Allow empty/null values
      return ['weekly', 'monthly', 'quarterly', 'half_yearly', 'annually'].includes(value);
    })
    .withMessage('Invalid recurring frequency'),


  body('policyCompliance')
    .optional()
    .isIn(['yes', 'no'])
    .withMessage('Policy compliance must be yes or no'),

  body('amountRequired')
    .optional()
    .isBoolean()
    .withMessage('Amount required must be a boolean'),

  body('amount')
    .optional()
    .isNumeric()
    .withMessage('Amount must be a number'),

  body('points')
    .optional()
    .isArray()
    .withMessage('Points must be an array'),

  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array'),

  handleValidationErrors,
];

/**
 * Validation rules for note ID param
 */
const noteIdValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid note ID'),

  handleValidationErrors,
];

/**
 * Validation rules for approve action
 */
const approveNoteValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid note ID'),

  body('remarks')
    .optional()
    .isString()
    .withMessage('Remarks must be a string')
    .trim(),

  handleValidationErrors,
];

/**
 * Validation rules for reject action (remarks required)
 */
const rejectNoteValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid note ID'),

  body('remarks')
    .notEmpty()
    .withMessage('Remarks are required for rejection')
    .isString()
    .withMessage('Remarks must be a string')
    .trim(),

  handleValidationErrors,
];

/**
 * Validation rules for revert action
 */
const revertNoteValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid note ID'),

  body('remarks')
    .notEmpty()
    .withMessage('Remarks are required for reverting back to creator')
    .isString()
    .withMessage('Remarks must be a string')
    .trim(),

  handleValidationErrors,
];

/**
 * Validation rules for forward action
 */
const forwardNoteValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid note ID'),

  body('remarks')
    .notEmpty()
    .withMessage('Remarks are required for forwarding')
    .isString()
    .withMessage('Remarks must be a string')
    .trim(),

  body('nextHolderId')
    .optional()
    .isUUID()
    .withMessage('Next holder ID must be a valid UUID'),

  body('automated')
    .optional()
    .isBoolean()
    .withMessage('Automated must be a boolean'),

  handleValidationErrors,
];

/**
 * Validation rules for list query parameters
 */
const listNotesValidation = [
  query('filter')
    .optional()
    .isIn(['mine', 'pending', 'handled', 'all'])
    .withMessage('Filter must be one of: mine, pending, handled, all'),

  query('status')
    .optional()
    .isIn(['draft', 'pending', 'approved', 'rejected', 'reverted'])
    .withMessage('Status must be one of: draft, pending, approved, rejected, reverted'),

  query('category')
    .optional()
    .isIn(getValidCategories())
    .withMessage(`Category must be one of: ${getValidCategories().join(', ')}`),

  query('search')
    .optional()
    .isString()
    .trim()
    .withMessage('Search must be a string'),

  query('createdById')
    .optional()
    .isString()
    .withMessage('Created by ID must be a string'),

  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO8601 date'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO8601 date'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  handleValidationErrors,
];

/**
 * Validation rules for preview ID
 */
const previewIdValidation = [
  query('category')
    .notEmpty()
    .withMessage('Category is required')
    .isIn(getValidCategories())
    .withMessage(`Category must be one of: ${getValidCategories().join(', ')}`),

  query('subcategory')
    .notEmpty()
    .withMessage('Subcategory is required'),

  handleValidationErrors,
];

/**
 * Validation rules for forward options
 */
const forwardOptionsValidation = [
  query('departmentId')
    .notEmpty()
    .withMessage('Department ID is required')
    .isUUID()
    .withMessage('Department ID must be a valid UUID'),

  handleValidationErrors,
];

module.exports = {
  createNoteValidation,
  updateDraftValidation,
  noteIdValidation,
  approveNoteValidation,
  rejectNoteValidation,
  revertNoteValidation,
  forwardNoteValidation,
  listNotesValidation,
  previewIdValidation,
  forwardOptionsValidation,
};
