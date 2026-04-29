const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/department.controller');
const { protect, restrictTo } = require('../../../shared/middleware/auth');

// All routes require authentication
router.use(protect);

// Get all departments (available to all authenticated users)
router.get('/', departmentController.getAllDepartments);

// Get departments by school (available to all authenticated users)
router.get('/by-school/:schoolId', departmentController.getDepartmentsBySchool);

// Get department by ID (available to all authenticated users)
router.get('/:id', departmentController.getDepartmentById);

// Create department (admin only)
router.post('/', restrictTo('admin'), departmentController.createDepartment);

// Update department (admin only)
router.put('/:id', restrictTo('admin'), departmentController.updateDepartment);

// Delete department (admin only)
router.delete('/:id', restrictTo('admin'), departmentController.deleteDepartment);

// Toggle department status (admin only)
router.patch('/:id/toggle-status', restrictTo('admin'), departmentController.toggleDepartmentStatus);

// Bulk create departments (admin only)
router.post('/bulk', restrictTo('admin'), departmentController.bulkCreate);

module.exports = router;
