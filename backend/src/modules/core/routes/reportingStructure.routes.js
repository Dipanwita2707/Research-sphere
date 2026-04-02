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
  '/departments',
  reportingStructureController.getDepartmentOptions
);

/**
 * Get reporting structure department options (school + central)
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
  [
    param('userId').notEmpty().withMessage('User ID is required'),
    query('departmentScope').optional().isIn(['school', 'central']).withMessage('departmentScope must be school or central'),
    query('departmentId').optional().notEmpty().withMessage('departmentId is required when departmentScope is provided'),
  ],
  reportingStructureController.getReportingChain
);

/**
 * Get direct manager for a user
 * Users can view their own manager, admins can view any
 */
router.get(
  '/manager/:userId',
  [
    param('userId').notEmpty().withMessage('User ID is required'),
    query('departmentScope').optional().isIn(['school', 'central']).withMessage('departmentScope must be school or central'),
    query('departmentId').optional().notEmpty().withMessage('departmentId is required when departmentScope is provided'),
  ],
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
    query('departmentScope').optional().isIn(['school', 'central']).withMessage('departmentScope must be school or central'),
    query('departmentId').optional().notEmpty().withMessage('departmentId is required when departmentScope is provided'),
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
    body('departmentScope').isIn(['school', 'central']).withMessage('departmentScope must be school or central'),
    body('departmentId').notEmpty().withMessage('departmentId is required'),
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
    body('departmentScope').isIn(['school', 'central']).withMessage('departmentScope must be school or central'),
    body('departmentId').notEmpty().withMessage('departmentId is required'),
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
  [
    param('userId').notEmpty().withMessage('User ID is required'),
    query('departmentScope').isIn(['school', 'central']).withMessage('departmentScope must be school or central'),
    query('departmentId').notEmpty().withMessage('departmentId is required'),
  ],
  reportingStructureController.removeReportingRelationship
);

/**
 * Move user to a new position in the hierarchy
 * Atomically removes from current position and re-inserts under new manager
 */
router.post(
  '/move',
  restrictTo('admin'),
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('newManagerId').notEmpty().withMessage('New Manager ID is required'),
    body('departmentScope').isIn(['school', 'central']).withMessage('departmentScope must be school or central'),
    body('departmentId').notEmpty().withMessage('departmentId is required'),
  ],
  reportingStructureController.moveUser
);

/**
 * Get hierarchy info for multiple users (batch)
 * Returns level, parent, subordinate count for users already in hierarchy
 */
router.post(
  '/hierarchy-info',
  [
    body('userIds').isArray({ min: 1 }).withMessage('userIds must be a non-empty array'),
    body('departmentScope').optional().isIn(['school', 'central']).withMessage('departmentScope must be school or central'),
    body('departmentId').optional().notEmpty().withMessage('departmentId is required when departmentScope is provided'),
  ],
  reportingStructureController.getBulkHierarchyInfo
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
    body('departmentScope').isIn(['school', 'central']).withMessage('departmentScope must be school or central'),
    body('departmentId').notEmpty().withMessage('departmentId is required'),
  ],
  reportingStructureController.bulkImportReportingStructure
);

module.exports = router;
