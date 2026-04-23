const express = require('express');
const router = express.Router();
const schoolController = require('../controllers/school.controller');
const { protect, restrictTo } = require('../../../shared/middleware/auth');

// All routes require authentication
router.use(protect);

// GET all schools (available to all authenticated users)
router.get('/', schoolController.getAllSchools);

// GET school by ID (available to all authenticated users)
router.get('/:id', schoolController.getSchoolById);

// POST create new school (admin only)
router.post('/', restrictTo('admin'), schoolController.createSchool);

// PUT update school (admin only)
router.put('/:id', restrictTo('admin'), schoolController.updateSchool);

// DELETE school (admin only)
router.delete('/:id', restrictTo('admin'), schoolController.deleteSchool);

// PATCH toggle school status (admin only)
router.patch('/:id/toggle-status', restrictTo('admin'), schoolController.toggleSchoolStatus);

// POST bulk create schools (admin only)
router.post('/bulk', restrictTo('admin'), schoolController.bulkCreate);

module.exports = router;
