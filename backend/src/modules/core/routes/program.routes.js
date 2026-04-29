const express = require('express');
const router = express.Router();
const programController = require('../controllers/program.controller');
const { protect, restrictTo } = require('../../../shared/middleware/auth');

// Allow admin OR any user with a finance permission to read programme lists
const financeOrAdmin = (req, res, next) => {
  const user = req.user;
  const role = (user?.role?.name || (typeof user?.role === 'string' ? user.role : '') || user?.userType || '').toLowerCase();
  if (role === 'admin' || role === 'superadmin') return next();
  const financePerms = ['configure_fee_structure', 'print_loan_letter', 'finance_analytics'];
  const has = user?.centralDeptPermissions?.some(
    d => d.permissions && financePerms.some(p => d.permissions[p] === true)
  );
  if (has) return next();
  return res.status(403).json({ success: false, message: 'Access denied' });
};

// All routes require authentication
router.use(protect);

// Get program types (admin only)
router.get('/types', restrictTo('admin'), programController.getProgramTypes);

// Get all programs (admin or any finance permission)
router.get('/', financeOrAdmin, programController.getAllPrograms);

// Get programs by department (admin or any finance permission)
router.get('/by-department/:departmentId', financeOrAdmin, programController.getProgramsByDepartment);

// Get program by ID (admin or any finance permission)
router.get('/:id', financeOrAdmin, programController.getProgramById);

// Create program (admin only)
router.post('/', restrictTo('admin'), programController.createProgram);

// Update program (admin only)
router.put('/:id', restrictTo('admin'), programController.updateProgram);

// Delete program (admin only)
router.delete('/:id', restrictTo('admin'), programController.deleteProgram);

// Toggle program status (admin only)
router.patch('/:id/toggle-status', restrictTo('admin'), programController.toggleProgramStatus);

// Bulk create programs (admin only)
router.post('/bulk', restrictTo('admin'), programController.bulkCreate);

// Specialization routes — read open to financeOrAdmin, write admin-only
router.get('/:id/specializations', financeOrAdmin, programController.getSpecializations);
router.post('/:id/specializations', restrictTo('admin'), programController.addSpecialization);
router.put('/:id/specializations/:specId', restrictTo('admin'), programController.updateSpecialization);
router.delete('/:id/specializations/:specId', restrictTo('admin'), programController.deleteSpecialization);

module.exports = router;
