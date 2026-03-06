/**
 * Payment Routes
 *
 * Handles individual and team payment order creation, verification,
 * and payment status checks.
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const paymentController = require('../controllers/payment.controller');

// ── Individual Payment ──────────────────────────────────────────────

router.post('/:id/payments/individual/create-order', paymentController.createIndividualOrder);
router.post('/:id/payments/individual/verify', paymentController.verifyIndividualPayment);
router.get('/:id/payments/status', paymentController.getPaymentStatus);

// ── Team Payment ────────────────────────────────────────────────────

router.post('/:id/teams/:teamId/payments/create-order', paymentController.createTeamOrder);
router.post('/:id/teams/:teamId/payments/verify', paymentController.verifyTeamPayment);

module.exports = router;
