/**
 * Payment Controller
 *
 * HTTP handlers for Razorpay payment operations.
 * All amounts are calculated on the backend — never trust frontend values.
 */

const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiResponse = require('../../../shared/utils/ApiResponse');
const paymentService = require('../services/payment.service');

// ══════════════════════════════════════════════════════════════════════════════
//  INDIVIDUAL PAYMENT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Create a Razorpay order for individual event registration payment.
 *
 * @route POST /api/v1/events/:id/payments/individual/create-order
 * @access Protected
 */
const createIndividualOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const result = await paymentService.createIndividualPaymentOrder(id, userId);

  return ApiResponse.success(res, result, 'Payment order created successfully');
});

/**
 * Verify individual payment after Razorpay Checkout.
 *
 * @route POST /api/v1/events/:id/payments/individual/verify
 * @access Protected
 */
const verifyIndividualPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const result = await paymentService.verifyIndividualPayment(id, userId, req.body);

  return ApiResponse.success(res, result, result.message);
});

// ══════════════════════════════════════════════════════════════════════════════
//  TEAM PAYMENT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Create a Razorpay order for team event registration payment.
 *
 * @route POST /api/v1/events/:id/teams/:teamId/payments/create-order
 * @access Protected (Team Leader only)
 */
const createTeamOrder = asyncHandler(async (req, res) => {
  const { id, teamId } = req.params;
  const userId = req.user.id;

  const result = await paymentService.createTeamPaymentOrder(id, teamId, userId);

  return ApiResponse.success(res, result, 'Team payment order created successfully');
});

/**
 * Verify team payment after Razorpay Checkout.
 *
 * @route POST /api/v1/events/:id/teams/:teamId/payments/verify
 * @access Protected (Team Leader only)
 */
const verifyTeamPayment = asyncHandler(async (req, res) => {
  const { id, teamId } = req.params;
  const userId = req.user.id;

  const result = await paymentService.verifyTeamPayment(id, teamId, userId, req.body);

  return ApiResponse.success(res, result, result.message);
});

// ══════════════════════════════════════════════════════════════════════════════
//  WEBHOOK
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Razorpay Webhook handler.
 * NOTE: This route must use express.raw() body parsing (NOT json).
 *
 * @route POST /api/v1/events/payments/webhook
 * @access Public (verified via X-Razorpay-Signature)
 */
const handleWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  if (!signature) {
    return res.status(400).json({ success: false, message: 'Missing signature header' });
  }

  // req.body should be the raw buffer (set up in routes via express.raw())
  const rawBody = typeof req.body === 'string' ? req.body : req.body.toString('utf8');

  const result = await paymentService.handleWebhook(rawBody, signature);

  return res.status(200).json({ success: true, message: result.message });
});

// ══════════════════════════════════════════════════════════════════════════════
//  PAYMENT STATUS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Get payment status for a registration.
 *
 * @route GET /api/v1/events/:id/payments/status
 * @access Protected
 */
const getPaymentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { registrationId, teamId } = req.query;

  const result = await paymentService.getPaymentStatus(id, userId, { registrationId, teamId });

  return ApiResponse.success(res, result, 'Payment status fetched successfully');
});

module.exports = {
  createIndividualOrder,
  verifyIndividualPayment,
  createTeamOrder,
  verifyTeamPayment,
  handleWebhook,
  getPaymentStatus,
};
