const express = require('express');
const router = express.Router();
const loanLetterController = require('./loan-letter.controller');
const templateController = require('./loan-letter-template.controller');
const { protect, requireAnyPermission } = require('../../../shared/middleware/auth');

const financeConfigOrAdmin = (req, res, next) => {
  const user = req.user;
  const role = (user?.role?.name || (typeof user?.role === 'string' ? user.role : '') || user?.userType || '').toLowerCase();
  if (role === 'admin' || role === 'superadmin') return next();
  return requireAnyPermission('central-department', ['configure_fee_structure'])(req, res, next);
};

// All routes require authentication
router.use(protect);

// ── Template endpoints (fee-structure permission or admin) ───────────────────
// GET  /finance/loan-letters/template
// PUT  /finance/loan-letters/template
// POST /finance/loan-letters/template/header-image
router.get(
  '/template',
  financeConfigOrAdmin,
  templateController.getTemplate,
);
router.get(
  '/template/audit',
  financeConfigOrAdmin,
  templateController.getTemplateAuditLog,
);
router.put(
  '/template',
  financeConfigOrAdmin,
  templateController.updateTemplate,
);
router.post(
  '/template/header-image',
  financeConfigOrAdmin,
  templateController.uploadMiddleware,
  templateController.uploadHeaderImage,
);
router.post(
  '/template/watermark-image',
  financeConfigOrAdmin,
  templateController.watermarkUploadMiddleware,
  templateController.uploadWatermarkImage,
);
router.post(
  '/template/import-docx',
  financeConfigOrAdmin,
  templateController.docxUploadMiddleware,
  templateController.importDocx,
);

// ── Loan letter CRUD (require print permission) ───────────────────────────────
router.use(requireAnyPermission('central-department', ['print_loan_letter']));

router.get('/', loanLetterController.list);
router.post('/', loanLetterController.create);
router.post('/:id/reprint', loanLetterController.recordReprint);
router.get('/:id', loanLetterController.getById);

module.exports = router;
