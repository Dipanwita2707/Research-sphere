/**
 * Coupon Routes
 *
 * Handles coupon validation, creation, update, and deletion for events.
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const couponController = require('../controllers/coupon.controller');
const { validateEventId } = require('../validators/event.validators');
const { checkAnyPermission } = require('../../../shared/middleware/auth');

const eventManagePerm = checkAnyPermission(
    ['event_manage_own', 'event_manage_all'],
    { checkDefaultPermissions: true }
);

// Validate / preview a coupon (any authenticated user registering)
router.post('/:id/coupons/validate', validateEventId, couponController.validateCoupon);

// List coupons for an event (organizer only)
router.get('/:id/coupons', validateEventId, eventManagePerm, couponController.listCoupons);

// Create a coupon (organizer only)
router.post('/:id/coupons', validateEventId, eventManagePerm, couponController.createCoupon);

// Update a coupon (organizer only)
router.patch('/:id/coupons/:couponId', validateEventId, eventManagePerm, couponController.updateCoupon);

// Delete a coupon (organizer only)
router.delete('/:id/coupons/:couponId', validateEventId, eventManagePerm, couponController.deleteCoupon);

module.exports = router;
