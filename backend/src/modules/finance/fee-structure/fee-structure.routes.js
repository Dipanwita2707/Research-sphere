const express = require('express');
const router = express.Router();
const controller = require('./fee-structure.controller');
const { protect, requireAnyPermission } = require('../../../shared/middleware/auth');

router.use(protect);

// Read: all 3 finance permissions can view fee structures
const readGuard = requireAnyPermission('central-department', ['configure_fee_structure', 'print_loan_letter', 'finance_analytics']);

// Write: only configure_fee_structure can add/edit/delete
const writeGuard = requireAnyPermission('central-department', ['configure_fee_structure']);

router.get('/', readGuard, controller.listAll);
router.get('/template/academic', writeGuard, controller.downloadAcademicTemplate);
router.post('/batch/academic', writeGuard, controller.createAcademicBatch);
router.post('/', writeGuard, controller.create);
router.get('/program/:programId', readGuard, controller.getForProgram);
router.post('/bulk', writeGuard, controller.bulkCreate);
router.get('/:id', readGuard, controller.getById);
router.put('/:id', writeGuard, controller.update);
router.delete('/:id', writeGuard, controller.remove);

module.exports = router;
