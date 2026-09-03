const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../../../shared/middleware/auth');
const employeeController = require('../controllers/employee.controller');

// All routes require admin access
router.use(protect, restrictTo('admin'));

// Create new employee
router.post('/', employeeController.createEmployee);

// Get all employees with filters
router.get('/', employeeController.getAllEmployees);

// Get distinct designations (for filters) - must be before /:id
router.get('/designations', employeeController.getDesignations);

// Get employee by ID
router.get('/:id', employeeController.getEmployeeById);

// Update employee
router.put('/:id', employeeController.updateEmployee);

// Reset employee password
router.patch('/:id/reset-password', employeeController.resetEmployeePassword);

// Toggle employee status (active/inactive)
router.patch('/:id/toggle-status', employeeController.toggleEmployeeStatus);

// Update researcher IDs (Scopus Author ID, ORCID, PubMed ID) — admin only
router.patch('/:id/research-ids', employeeController.updateEmployeeResearchIds);

// Delete employee
router.delete('/:id', employeeController.deleteEmployee);

module.exports = router;
