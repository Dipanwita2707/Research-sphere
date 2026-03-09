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
    .withMessage('Please select a category for your note (e.g., Academic, Administrative)')
    .isIn(getValidCategories())
    .withMessage(`Invalid category. Please choose from: ${getValidCategories().join(', ')}`),

  body('subcategory')
    .notEmpty()
    .withMessage('Please select a subcategory for your note')
    .custom((value, { req }) => {
      const validSubs = getValidSubcategories(req.body.category);
      if (validSubs.length && !validSubs.includes(value)) {
        throw new Error(`Invalid subcategory for this category. Available options: ${validSubs.join(', ')}`);
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

  body('category')
    .optional()
    .isString()
    .withMessage('Category must be a string'),

  body('subcategory')
    .optional()
    .isString()
    .withMessage('Subcategory must be a string'),

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
    .withMessage('Invalid note ID. The note you are trying to access may not exist or the link is incorrect.'),

  handleValidationErrors,
];

/**
 * Validation rules for approve action (remarks NOW mandatory)
 */
const approveNoteValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid note ID'),

  body('remarks')
    .notEmpty()
    .withMessage('Remarks are mandatory for approval. Please provide your observations or comments before approving.')
    .isString()
    .withMessage('Remarks must be a string')
    .trim(),

  handleValidationErrors,
];

/**
 * Validation rules for recommend action (remarks mandatory)
 */
const recommendNoteValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid note ID'),

  body('remarks')
    .notEmpty()
    .withMessage('Remarks are mandatory for recommendation. Please provide your reasoning before recommending.')
    .isString()
    .withMessage('Remarks must be a string')
    .trim(),

  handleValidationErrors,
];

/**
 * Validation rules for not-recommend action (remarks mandatory)
 */
const notRecommendNoteValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid note ID'),

  body('remarks')
    .notEmpty()
    .withMessage('Remarks are mandatory when not recommending. Please explain your reasoning.')
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
    .withMessage('Rejection reason is required. Please explain why you are rejecting this note so the creator can understand what needs to be corrected.')
    .isString()
    .withMessage('Remarks must be text')
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
    .withMessage('Please provide instructions to the creator explaining what changes are needed before they resubmit the note.')
    .isString()
    .withMessage('Remarks must be text')
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
    .withMessage('Please add a note explaining why you are forwarding this request to the next person.')
    .isString()
    .withMessage('Remarks must be text')
    .trim(),

  body('nextHolderId')
    .optional()
    .isUUID()
    .withMessage('Invalid user selected. Please choose a valid person to forward to.'),

  body('automated')
    .optional()
    .isBoolean()
    .withMessage('Automated must be true or false'),

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

  query('includeCounts')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('includeCounts must be true or false'),

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

/**
 * Validation rules for sending copies after approval
 */
const sendCopyValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid note ID'),

  body('userIds')
    .notEmpty()
    .withMessage('Please select at least one user to send the copy to.')
    .isArray({ min: 1 })
    .withMessage('userIds must be a non-empty array'),

  body('userIds.*')
    .isUUID()
    .withMessage('Each user ID must be a valid UUID'),

  body('remarks')
    .notEmpty()
    .withMessage('Remarks are mandatory when sending copies. Please explain what work needs to be done.')
    .isString()
    .withMessage('Remarks must be a string')
    .trim(),

  handleValidationErrors,
];

/**
 * Validation rules for replying to a copy
 */
const replyCopyValidation = [
  param('copyId')
    .isUUID()
    .withMessage('Invalid copy ID'),

  body('remarks')
    .notEmpty()
    .withMessage('Remarks are mandatory when replying. Please provide your update.')
    .isString()
    .withMessage('Remarks must be a string')
    .trim(),

  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array'),

  handleValidationErrors,
];

/**
 * Validation rules for forwarding (re-sending) a copy back to user (escalation)
 */
const forwardCopyValidation = [
  param('copyId')
    .isUUID()
    .withMessage('Invalid copy ID'),

  body('remarks')
    .notEmpty()
    .withMessage('Remarks are mandatory when forwarding a copy. Please explain why the work is not complete.')
    .isString()
    .withMessage('Remarks must be a string')
    .trim(),

  handleValidationErrors,
];

/**
 * Validation for completing a copy (Creator marks work done)
 */
const completeCopyValidation = [
  param('copyId')
    .isUUID()
    .withMessage('Invalid copy ID'),
  handleValidationErrors,
];

module.exports = {
  createNoteValidation,
  updateDraftValidation,
  noteIdValidation,
  approveNoteValidation,
  recommendNoteValidation,
  notRecommendNoteValidation,
  rejectNoteValidation,
  revertNoteValidation,
  forwardNoteValidation,
  listNotesValidation,
  previewIdValidation,
  forwardOptionsValidation,
  sendCopyValidation,
  replyCopyValidation,
  forwardCopyValidation,
  completeCopyValidation,
};
