/**
 * DSW Category Routes
 * Routes for club category management
 */

const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { validateCategoryCreation } = require('../validators');
const { isDSWAdmin, optionalAuth } = require('../middleware/rbac');

// Get all categories (public - no auth required)
router.get('/', optionalAuth, categoryController.getCategories);

// Get category by ID (public - no auth required)
router.get('/:categoryId', optionalAuth, categoryController.getCategoryById);

// Create new category (admin only)
router.post('/', isDSWAdmin, validateCategoryCreation, categoryController.createCategory);

// Update category (admin only)
router.patch('/:categoryId', isDSWAdmin, categoryController.updateCategory);

// Deactivate category (admin only)
router.delete('/:categoryId', isDSWAdmin, categoryController.deactivateCategory);

// Seed default categories (admin only)
router.post('/seed/default', isDSWAdmin, categoryController.seedCategories);

module.exports = router;
