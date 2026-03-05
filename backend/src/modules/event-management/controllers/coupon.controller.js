/**
 * Coupon Controller
 *
 * Handles HTTP requests for event coupon management and validation.
 */

const asyncHandler = require('../../../shared/utils/asyncHandler');
const ApiResponse = require('../../../shared/utils/ApiResponse');
const couponService = require('../services/coupon.service');

// ─────────────────────────────────────────────
// Organizer routes
// ─────────────────────────────────────────────

/**
 * List all coupons for an event
 * GET /api/events/:id/coupons
 */
const listCoupons = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizerId = req.user.id;
  const coupons = await couponService.listCoupons(id, organizerId);
  return ApiResponse.success(res, coupons, 'Coupons fetched successfully');
});

/**
 * Create a coupon for an event
 * POST /api/events/:id/coupons
 */
const createCoupon = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizerId = req.user.id;
  const coupon = await couponService.createCoupon(id, organizerId, req.body);
  return ApiResponse.success(res, coupon, 'Coupon created successfully', 201);
});

/**
 * Update a coupon
 * PATCH /api/events/:id/coupons/:couponId
 */
const updateCoupon = asyncHandler(async (req, res) => {
  const { id, couponId } = req.params;
  const organizerId = req.user.id;
  const coupon = await couponService.updateCoupon(id, couponId, organizerId, req.body);
  return ApiResponse.success(res, coupon, 'Coupon updated successfully');
});

/**
 * Delete a coupon
 * DELETE /api/events/:id/coupons/:couponId
 */
const deleteCoupon = asyncHandler(async (req, res) => {
  const { id, couponId } = req.params;
  const organizerId = req.user.id;
  const result = await couponService.deleteCoupon(id, couponId, organizerId);
  return ApiResponse.success(res, result, 'Coupon deleted successfully');
});

// ─────────────────────────────────────────────
// User routes
// ─────────────────────────────────────────────

/**
 * Validate / preview a coupon code (does NOT consume usage)
 * POST /api/events/:id/coupons/validate
 * Body: { code, amount }
 */
const validateCoupon = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { code, amount } = req.body;
  const result = await couponService.validateCoupon(id, code, userId, amount);
  return ApiResponse.success(res, result, 'Coupon is valid');
});

module.exports = {
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
};
