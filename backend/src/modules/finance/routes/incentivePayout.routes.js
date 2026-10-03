/**
 * Research incentive payouts, mounted at /api/v1/finance.
 *   finance_view     dashboard and read access
 *   finance_review   recommend / hold / adjust / cancel lines, prepare batches, record payment
 *   finance_approve  approve batches (someone other than the preparer and recommenders, unless
 *                    the university allows self-approval with a reason)
 *   settings         read: any finance permission; change: tenant admin only
 */
const express = require('express');
const { protect, checkPermission, checkAnyPermission } = require('../../../shared/middleware/auth');
const c = require('../controllers/incentivePayout.controller');

const router = express.Router();
router.use(protect);

const canView = checkAnyPermission(['finance_view', 'finance_review', 'finance_approve']);
const canReview = checkPermission('finance_review');
const canApprove = checkPermission('finance_approve');
const canRecordPayment = checkAnyPermission(['finance_review', 'finance_approve']);

// Self-service statement for authors (no finance permission needed)
router.get('/my-incentives', c.myIncentives);

router.get('/payouts/dashboard', canView, c.dashboard);
router.get('/payouts', canView, c.listPayouts);
router.post('/payouts/recommend', canReview, c.recommend);
router.get('/payouts/:id', canView, c.getPayout);
router.post('/payouts/:id/hold', canReview, c.hold);
router.post('/payouts/:id/adjust', canReview, c.adjust);
router.post('/payouts/:id/cancel', canReview, c.cancel);

router.get('/batches', canView, c.listBatches);
router.post('/batches', canReview, c.createBatch);
router.get('/batches/:id', canView, c.getBatch);
router.get('/batches/:id/export', canView, c.exportBatch);
router.post('/batches/:id/approve', canApprove, c.approveBatch);
router.post('/batches/:id/pay', canRecordPayment, c.markBatchPaid);
router.post('/batches/:id/cancel', canReview, c.cancelBatch);

// Finance rules (self-approval). Relaxing a control is an admin decision, never the approvers' own.
const adminOnly = (req, res, next) => (['admin', 'superadmin'].includes(String(req.user?.role || '').toLowerCase())
  ? next()
  : res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Only a university administrator can change finance approval rules' }));
router.get('/settings', canView, c.getSettings);
router.put('/settings', adminOnly, c.updateSettings);

module.exports = router;
