const express = require('express');
const router = express.Router();
const { protect, checkPermission, checkAnyPermission, requireNotingPermission } = require('../../../shared/middleware/auth');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const notingController = require('../controllers/noting.controller');
const validators = require('../validators/noting.validators');
const { requireDraftNote, requireNoteApprover } = require('../middleware/noteAuth');
const { ForbiddenError } = require('../../../shared/utils/AppError');

// All routes require authentication
router.use(protect);

// Configuration and preview routes - require at least noting_create or noting_view_own
router.get('/config', 
  checkAnyPermission(['noting_create', 'noting_view_own', 'noting_view_all'], { checkDefaultPermissions: true }),
  notingController.getConfig
);
router.get('/preview-id', 
  checkPermission('noting_create', { checkDefaultPermissions: true }),
  validators.previewIdValidation, 
  notingController.previewNotingId
);
router.get('/my-creator-info', 
  checkAnyPermission(['noting_create', 'noting_view_own'], { checkDefaultPermissions: true }),
  notingController.getMyCreatorInfo
);
router.get('/counts', 
  checkAnyPermission(['noting_view_own', 'noting_view_all', 'noting_approve'], { checkDefaultPermissions: true }),
  notingController.getCounts
);

// Forward options routes - require noting_forward or noting_approve
router.get(
  '/forward-options/programs',
  checkAnyPermission(['noting_forward', 'noting_approve'], { checkDefaultPermissions: true }),
  validators.forwardOptionsValidation,
  notingController.getForwardPrograms
);
router.get(
  '/forward-options/users',
  checkAnyPermission(['noting_forward', 'noting_approve'], { checkDefaultPermissions: true }),
  validators.forwardOptionsValidation,
  notingController.getForwardUsers
);

// Search employees for manual forward (by UID or name)
router.get(
  '/search-employees',
  checkAnyPermission(['noting_forward', 'noting_approve'], { checkDefaultPermissions: true }),
  notingController.searchEmployees
);

// Get my reporting manager info (for auto-forward preview)
router.get(
  '/my-manager',
  checkAnyPermission(['noting_forward', 'noting_approve'], { checkDefaultPermissions: true }),
  notingController.getMyManager
);

// Note CRUD routes - require noting_create for write, noting_view_own for read
router.post('/', 
  checkPermission('noting_create', { checkDefaultPermissions: true }),
  validators.createNoteValidation, 
  notingController.create
);
router.get('/', 
  checkAnyPermission(['noting_view_own', 'noting_view_department', 'noting_view_all'], { checkDefaultPermissions: true }),
  validators.listNotesValidation, 
  notingController.list
);
router.get('/:id', 
  checkAnyPermission(['noting_view_own', 'noting_view_department', 'noting_view_all'], { checkDefaultPermissions: true }),
  validators.noteIdValidation, 
  notingController.getById
);

// Note management routes - require noting_create
router.patch(
  '/:id',
  checkPermission('noting_create', { checkDefaultPermissions: true }),
  validators.updateDraftValidation,
  notingController.updateDraft
);
router.delete(
  '/:id',
  checkPermission('noting_create', { checkDefaultPermissions: true }),
  validators.noteIdValidation,
  notingController.deleteDraft
);
router.post(
  '/:id/submit',
  checkPermission('noting_create', { checkDefaultPermissions: true }),
  validators.noteIdValidation,
  notingController.submitDraft
);

// Approval workflow routes - require noting_approve or noting_forward
router.post(
  '/:id/approve',
  checkPermission('noting_approve', { checkDefaultPermissions: true }),
  validators.approveNoteValidation,
  asyncHandler(requireNoteApprover),
  notingController.approve
);
router.post(
  '/:id/reject',
  checkAnyPermission(['noting_approve', 'noting_return'], { checkDefaultPermissions: true }),
  validators.rejectNoteValidation,
  asyncHandler(requireNoteApprover),
  notingController.reject
);
router.post(
  '/:id/revert',
  checkPermission('noting_return', { checkDefaultPermissions: true }),
  validators.revertNoteValidation,
  asyncHandler(requireNoteApprover),
  notingController.revert
);
router.post(
  '/:id/forward',
  checkPermission('noting_forward', { checkDefaultPermissions: true }),
  validators.forwardNoteValidation,
  asyncHandler(requireNoteApprover),
  notingController.forward
);

// Auto-forward to immediate reporting manager
router.post(
  '/:id/auto-forward',
  checkAnyPermission(['noting_forward', 'noting_approve'], { checkDefaultPermissions: true }),
  asyncHandler(requireNoteApprover),
  notingController.autoForward
);

module.exports = router;
