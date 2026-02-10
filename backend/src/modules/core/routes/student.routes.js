const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../../../shared/middleware/auth');
const studentController = require('../controllers/student.controller');

// All routes require admin access
router.use(protect, restrictTo('admin'));

// Get programs for dropdown
router.get('/programs', studentController.getPrograms);

// Get sections by program
router.get('/programs/:programId/sections', studentController.getSectionsByProgram);

// Get faculty (mentors) by program — for Assign Mentor dropdown
router.get('/programs/:programId/faculty', studentController.getFacultyByProgram);

// Create new student
router.post('/', studentController.createStudent);

// Get all students with filters
router.get('/', studentController.getAllStudents);

// Get student by ID
router.get('/:id', studentController.getStudentById);

// Update student
router.put('/:id', studentController.updateStudent);

// Toggle student status (active/inactive)
router.patch('/:id/toggle-status', studentController.toggleStudentStatus);

// Reset student password
router.patch('/:id/reset-password', studentController.resetStudentPassword);

module.exports = router;
