const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleManagement.controller');
const { protect, restrictTo } = require('../../../shared/middleware/auth');

// All routes require authentication
router.use(protect);

// =====================================
// PUBLIC ROUTES (for authenticated users)
// =====================================
// Get all active roles (for role selection dropdowns)
router.get('/list', roleController.getAllRoles);

// Get a single role by ID
router.get('/:id', roleController.getRoleById);

// Get role permissions (for preview)
router.get('/:id/permissions', roleController.getRolePermissions);

// Get permission definitions for role creation
router.get('/definitions/all', roleController.getPermissionDefinitionsForRole);

// =====================================
// ADMIN ONLY ROUTES
// =====================================
// Create a new role
router.post('/create', restrictTo('admin'), roleController.createRole);

// Update a role
router.put('/:id', restrictTo('admin'), roleController.updateRole);

// Delete a role
router.delete('/:id', restrictTo('admin'), roleController.deleteRole);

// Duplicate a role
router.post('/:id/duplicate', restrictTo('admin'), roleController.duplicateRole);

// Apply role to user (grant permissions based on role template)
router.post('/apply-to-user', restrictTo('admin'), roleController.applyRoleToUser);

module.exports = router;
