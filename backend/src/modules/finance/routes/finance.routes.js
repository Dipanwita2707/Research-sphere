const express = require('express');
const router = express.Router();
const financeController = require('../controllers/finance.controller');
const { protect, requirePermission, requireAnyPermission, checkIprTenantAccess } = require('../../../shared/middleware/auth');

// All routes require authentication
router.use(protect);

// Finance Team routes - require finance permissions
router.get('/pending', requireAnyPermission('research-patent', ['finance_review', 'finance_approve', 'finance_manage']), financeController.getPendingFinanceReviews);
router.get('/statistics', requireAnyPermission('research-patent', ['finance_review', 'finance_approve', 'finance_manage']), financeController.getFinanceStatistics);
router.post('/approve/:id', requireAnyPermission('research-patent', ['finance_approve', 'finance_manage']), checkIprTenantAccess, financeController.approveFinanceApplication);
router.post('/reject/:id', requireAnyPermission('research-patent', ['finance_approve', 'finance_manage']), checkIprTenantAccess, financeController.rejectFinanceApplication);
router.post('/request-audit/:id', requirePermission('research-patent', 'finance_review'), checkIprTenantAccess, financeController.requestAdditionalAudit);
// Retired: IPR incentives are now created as payout lines when DRD publishes the IPR and are
// paid through the payout ledger (/finance/payouts, /finance/batches). Crediting here as well
// would pay the same IPR twice.
router.post('/process-incentive/:id', (req, res) => res.status(410).json({
  success: false,
  code: 'RETIRED_USE_PAYOUT_LEDGER',
  message: 'IPR incentives are paid through Finance → Payout verification and payment batches.',
}));
router.get('/applicant-history/:applicantId', requireAnyPermission('research-patent', ['finance_review', 'finance_approve', 'finance_manage']), financeController.getApplicantIncentiveHistory);

module.exports = router;
