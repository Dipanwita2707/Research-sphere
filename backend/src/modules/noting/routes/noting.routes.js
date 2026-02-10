const express = require('express');
const router = express.Router();
const { protect } = require('../../../shared/middleware/auth');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const notingController = require('../controllers/noting.controller');
const validators = require('../validators/noting.validators');
const { requireDraftNote, requireNoteApprover } = require('../middleware/noteAuth');
const { ForbiddenError } = require('../../../shared/utils/AppError');

// All routes require authentication
router.use(protect);

// Block students from accessing noting system
router.use((req, res, next) => {
  if (req.user.role === 'student') {
    throw new ForbiddenError('Students are not allowed to access the noting system');
  }
  next();
});

// Configuration and preview routes
router.get('/config', notingController.getConfig);
router.get('/preview-id', validators.previewIdValidation, notingController.previewNotingId);
router.get('/my-creator-info', notingController.getMyCreatorInfo);
router.get('/counts', notingController.getCounts);

// Forward options routes
router.get(
  '/forward-options/programs',
  validators.forwardOptionsValidation,
  notingController.getForwardPrograms
);
router.get(
  '/forward-options/users',
  validators.forwardOptionsValidation,
  notingController.getForwardUsers
);

// Note CRUD routes
router.post('/', validators.createNoteValidation, notingController.create);
router.get('/', validators.listNotesValidation, notingController.list);
router.get('/:id', validators.noteIdValidation, notingController.getById);

// Note management routes
router.patch(
  '/:id',
  validators.updateDraftValidation,
  notingController.updateDraft
);
router.delete(
  '/:id',
  validators.noteIdValidation,
  notingController.deleteDraft
);
router.post(
  '/:id/submit',
  validators.noteIdValidation,
  notingController.submitDraft
);

// Approval workflow routes
router.post(
  '/:id/approve',
  validators.approveNoteValidation,
  asyncHandler(requireNoteApprover),
  notingController.approve
);
router.post(
  '/:id/reject',
  validators.rejectNoteValidation,
  asyncHandler(requireNoteApprover),
  notingController.reject
);
router.post(
  '/:id/revert',
  validators.revertNoteValidation,
  asyncHandler(requireNoteApprover),
  notingController.revert
);
router.post(
  '/:id/forward',
  validators.forwardNoteValidation,
  asyncHandler(requireNoteApprover),
  notingController.forward
);

module.exports = router;
