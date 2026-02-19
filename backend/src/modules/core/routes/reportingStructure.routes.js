const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const reportingStructureController = require('../controllers/reportingStructure.controller');
const { protect, restrictTo } = require('../../../shared/middleware/auth');

// All routes require authentication
router.use(protect);

/**
 * Get full reporting hierarchy tree
 * Accessible by admin or users with view_reporting_structure permission
 */
router.get(
  '/tree',
  // TODO: Uncomment when permissions are added
  // hasPermission('view_reporting_structure'),
  reportingStructureController.getHierarchyTree
);

/**
 * Get reporting chain for a specific user
 * Users can view their own chain, admins can view any
 */
router.get(
  '/chain/:userId',
  [param('userId').notEmpty().withMessage('User ID is required')],
  reportingStructureController.getReportingChain
);

/**
 * Get direct manager for a user
 * Users can view their own manager, admins can view any
 */
router.get(
  '/manager/:userId',
  [param('userId').notEmpty().withMessage('User ID is required')],
  reportingStructureController.getDirectManager
);

/**
 * Get subordinates of a user
 * Supports query param ?direct=true for only direct reports
 */
router.get(
  '/subordinates/:userId',
  [
    param('userId').notEmpty().withMessage('User ID is required'),
    query('direct').optional().isBoolean().withMessage('direct must be a boolean'),
  ],
  reportingStructureController.getSubordinates
);

/**
 * Assign reporting relationship
 * Admin or users with manage_reporting_structure permission
 */
router.post(
  '/assign',
  // TODO: Uncomment when permissions are added
  // hasPermission('manage_reporting_structure'),
  restrictTo('admin'), // Temporarily restrict to admin only
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('managerId').notEmpty().withMessage('Manager ID is required'),
  ],
  reportingStructureController.assignReportingManager
);

/**
 * Assign multi-level manager chain (up to 5 levels)
 * Creates complete reporting hierarchy in one operation
 */
router.post(
  '/assign-chain',
  restrictTo('admin'),
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('managerChain').isArray({ min: 1, max: 5 }).withMessage('Manager chain must be array with 1-5 managers'),
  ],
  reportingStructureController.assignManagerChain
);

/**
 * Remove reporting relationship
 * Admin or users with manage_reporting_structure permission
 */
router.delete(
  '/:userId',
  // TODO: Uncomment when permissions are added
  // hasPermission('manage_reporting_structure'),
  restrictTo('admin'), // Temporarily restrict to admin only
  [param('userId').notEmpty().withMessage('User ID is required')],
  reportingStructureController.removeReportingRelationship
);

/**
 * Bulk import reporting structure
 * Admin only - for initial setup or mass updates
 */
router.post(
  '/bulk-import',
  restrictTo('admin'),
  [
    body('relationships')
      .isArray()
      .withMessage('Relationships must be an array')
      .notEmpty()
      .withMessage('Relationships array cannot be empty'),
    body('relationships.*.userId').notEmpty().withMessage('Each relationship must have userId'),
    body('relationships.*.managerId')
      .notEmpty()
      .withMessage('Each relationship must have managerId'),
  ],
  reportingStructureController.bulkImportReportingStructure
);

module.exports = router;
