/**
 * Event Coupon Service
 *
 * Handles creation, management, and validation of event-level coupons.
 * Coupons are scoped to a single event and are redeemed during registration.
 */

const prisma = require('../../../shared/config/database');
const { ValidationError, NotFoundError, ForbiddenError } = require('../../../shared/utils/AppError');
const { resolveEvent } = require('../utils/eventHelpers');

// ─────────────────────────────────────────────
// Helper: compute discount amount
// ─────────────────────────────────────────────
/**
 * Calculate the discount amount for a given coupon and base amount.
 * @param {object} coupon  - Prisma EventCoupon record
 * @param {number} amount  - Registration amount (₹)
 * @returns {{ discountAmount: number, finalAmount: number }}
 */
const computeDiscount = (coupon, amount) => {
  let discountAmount = 0;

  if (coupon.discountType === 'percentage') {
    discountAmount = (amount * coupon.discountValue) / 100;
    if (coupon.maxDiscountCap && discountAmount > coupon.maxDiscountCap) {
      discountAmount = coupon.maxDiscountCap;
    }
  } else {
    // fixed
    discountAmount = coupon.discountValue;
  }

  // Discount cannot exceed the payable amount
  if (discountAmount > amount) discountAmount = amount;

  return {
    discountAmount: Math.round(discountAmount * 100) / 100,
    finalAmount: Math.round((amount - discountAmount) * 100) / 100,
  };
};

// ─────────────────────────────────────────────
// Organizer: Create coupon
// ─────────────────────────────────────────────
const createCoupon = async (eventId, createdById, data) => {
  const event = await resolveEvent(eventId, {
    select: { id: true, createdById: true, paymentType: true },
  });
  if (event.createdById !== createdById) throw new ForbiddenError('Only the event organizer can manage coupons');
  if (event.paymentType !== 'paid') throw new ValidationError('Coupons are only applicable to paid events');

  const {
    code,
    discountType,
    discountValue,
    maxDiscountCap,
    minAmount,
    maxUses,
    maxUsesPerUser,
    expiresAt,
    isActive,
    description,
  } = data;

  if (!code || !code.trim()) throw new ValidationError('Coupon code is required');
  if (!['percentage', 'fixed'].includes(discountType)) throw new ValidationError('Invalid discount type');
  if (!discountValue || discountValue <= 0) throw new ValidationError('Discount value must be positive');
  if (discountType === 'percentage' && discountValue > 100) throw new ValidationError('Percentage discount cannot exceed 100%');

  // Ensure code is unique for this event (case-insensitive)
  const normalizedCode = code.trim().toUpperCase();
  const existing = await prisma.eventCoupon.findFirst({
    where: { eventId: event.id, code: normalizedCode },
  });
  if (existing) throw new ValidationError(`Coupon code "${normalizedCode}" already exists for this event`);

  const coupon = await prisma.eventCoupon.create({
    data: {
      eventId: event.id,
      code: normalizedCode,
      discountType,
      discountValue,
      maxDiscountCap: maxDiscountCap ?? null,
      minAmount: minAmount ?? null,
      maxUses: maxUses ?? null,
      maxUsesPerUser: maxUsesPerUser ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      isActive: isActive !== undefined ? isActive : true,
      description: description ?? null,
      createdById,
    },
  });

  return coupon;
};

// ─────────────────────────────────────────────
// Organizer: Update coupon
// ─────────────────────────────────────────────
const updateCoupon = async (eventId, couponId, organizerId, data) => {
  const event = await resolveEvent(eventId, {
    select: { id: true, createdById: true },
  });
  if (event.createdById !== organizerId) throw new ForbiddenError('Only the event organizer can manage coupons');

  const coupon = await prisma.eventCoupon.findFirst({
    where: { id: couponId, eventId: event.id },
  });
  if (!coupon) throw new NotFoundError('Coupon not found');

  const updateData = {};

  if (data.code !== undefined) {
    const normalized = data.code.trim().toUpperCase();
    if (normalized !== coupon.code) {
      const conflict = await prisma.eventCoupon.findFirst({
        where: { eventId: event.id, code: normalized, NOT: { id: couponId } },
      });
      if (conflict) throw new ValidationError(`Coupon code "${normalized}" already exists for this event`);
    }
    updateData.code = normalized;
  }
  if (data.discountType !== undefined) {
    if (!['percentage', 'fixed'].includes(data.discountType)) throw new ValidationError('Invalid discount type');
    updateData.discountType = data.discountType;
  }
  if (data.discountValue !== undefined) {
    if (data.discountValue <= 0) throw new ValidationError('Discount value must be positive');
    updateData.discountValue = data.discountValue;
  }
  if (data.maxDiscountCap !== undefined) updateData.maxDiscountCap = data.maxDiscountCap;
  if (data.minAmount !== undefined) updateData.minAmount = data.minAmount;
  if (data.maxUses !== undefined) updateData.maxUses = data.maxUses;
  if (data.maxUsesPerUser !== undefined) updateData.maxUsesPerUser = data.maxUsesPerUser;
  if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.description !== undefined) updateData.description = data.description;

  return prisma.eventCoupon.update({ where: { id: couponId }, data: updateData });
};

// ─────────────────────────────────────────────
// Organizer: Delete coupon
// ─────────────────────────────────────────────
const deleteCoupon = async (eventId, couponId, organizerId) => {
  const event = await resolveEvent(eventId, {
    select: { id: true, createdById: true },
  });
  if (event.createdById !== organizerId) throw new ForbiddenError('Only the event organizer can manage coupons');

  const coupon = await prisma.eventCoupon.findFirst({
    where: { id: couponId, eventId: event.id },
  });
  if (!coupon) throw new NotFoundError('Coupon not found');

  await prisma.eventCoupon.delete({ where: { id: couponId } });
  return { message: 'Coupon deleted' };
};

// ─────────────────────────────────────────────
// Organizer: List coupons for an event
// ─────────────────────────────────────────────
const listCoupons = async (eventId, organizerId) => {
  const event = await resolveEvent(eventId, {
    select: { id: true, createdById: true },
  });
  if (event.createdById !== organizerId) throw new ForbiddenError('Only the event organizer can view coupons');

  const coupons = await prisma.eventCoupon.findMany({
    where: { eventId: event.id },
    include: {
      _count: { select: { CouponUsage: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return coupons.map((c) => ({
    ...c,
    usageCount: c._count.CouponUsage,
    _count: undefined,
  }));
};

// ─────────────────────────────────────────────
// User: Validate (preview) a coupon code
// Returns discount breakdown without consuming any usage slot
// ─────────────────────────────────────────────
const validateCoupon = async (eventId, code, userId, amount) => {
  const event = await resolveEvent(eventId, {
    select: { id: true, paymentType: true, registrationFee: true },
  });
  if (event.paymentType !== 'paid') throw new ValidationError('This event is free — no coupon needed');

  const registrationAmount = amount ?? event.registrationFee ?? 0;

  const normalizedCode = (code || '').trim().toUpperCase();
  if (!normalizedCode) throw new ValidationError('Coupon code is required');

  const coupon = await prisma.eventCoupon.findFirst({
    where: { eventId: event.id, code: normalizedCode },
  });

  if (!coupon) throw new ValidationError('Invalid coupon code');
  if (!coupon.isActive) throw new ValidationError('This coupon is no longer active');
  if (coupon.expiresAt && new Date() > new Date(coupon.expiresAt)) {
    throw new ValidationError('This coupon has expired');
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    throw new ValidationError('This coupon has reached its maximum usage limit');
  }
  if (coupon.minAmount !== null && registrationAmount < coupon.minAmount) {
    throw new ValidationError(`Minimum registration amount of ₹${coupon.minAmount} required to use this coupon`);
  }

  // Check per-user usage
  if (coupon.maxUsesPerUser !== null) {
    const userUsageCount = await prisma.couponUsage.count({
      where: { couponId: coupon.id, userId },
    });
    if (userUsageCount >= coupon.maxUsesPerUser) {
      throw new ValidationError('You have already used this coupon the maximum number of times');
    }
  }

  const { discountAmount, finalAmount } = computeDiscount(coupon, registrationAmount);

  // Razorpay minimum is ₹1 — catch sub-minimum amounts early
  if (finalAmount > 0 && finalAmount < 1) {
    throw new ValidationError(
      `This coupon brings your amount to ₹${finalAmount.toFixed(2)}, which is below the minimum payable amount of ₹1. Please use a smaller discount or contact the organiser.`
    );
  }

  return {
    valid: true,
    couponId: coupon.id,
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    maxDiscountCap: coupon.maxDiscountCap,
    description: coupon.description,
    originalAmount: registrationAmount,
    discountAmount,
    finalAmount,
  };
};

// ─────────────────────────────────────────────
// Internal: Apply coupon atomically during registration
// Called inside a Prisma transaction block
// ─────────────────────────────────────────────
const applyCouponInTransaction = async (tx, couponId, registrationId, userId, amount) => {
  // ── Idempotency: skip if coupon already applied to this registration ──
  const existingUsage = await tx.couponUsage.findUnique({
    where: { registrationId },
  });
  if (existingUsage) {
    // Already applied — return the previously recorded amounts
    return {
      discountAmount: existingUsage.discountAmount,
      finalAmount: existingUsage.finalAmount,
      originalAmount: existingUsage.originalAmount,
    };
  }

  const coupon = await tx.eventCoupon.findUnique({ where: { id: couponId } });
  if (!coupon) throw new ValidationError('Coupon not found');
  if (!coupon.isActive) throw new ValidationError('Coupon is no longer active');
  if (coupon.expiresAt && new Date() > new Date(coupon.expiresAt)) {
    throw new ValidationError('Coupon has expired');
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    throw new ValidationError('Coupon usage limit reached');
  }
  if (coupon.minAmount !== null && amount < coupon.minAmount) {
    throw new ValidationError(`Minimum amount ₹${coupon.minAmount} required`);
  }

  // Per-user check
  if (coupon.maxUsesPerUser !== null) {
    const userUsage = await tx.couponUsage.count({ where: { couponId, userId } });
    if (userUsage >= coupon.maxUsesPerUser) {
      throw new ValidationError('You have already used this coupon the maximum number of times');
    }
  }

  const { discountAmount, finalAmount } = computeDiscount(coupon, amount);

  // Atomically increment usedCount (with optimistic check for maxUses)
  try {
    await tx.eventCoupon.update({
      where: {
        id: couponId,
        ...(coupon.maxUses !== null ? { usedCount: { lt: coupon.maxUses } } : {}),
      },
      data: { usedCount: { increment: 1 } },
    });
  } catch (err) {
    // Prisma P2025: record not found → optimistic limit reached
    if (err?.code === 'P2025') {
      throw new ValidationError('Coupon usage limit reached — please try without a coupon');
    }
    throw err;
  }

  // Record usage
  await tx.couponUsage.create({
    data: {
      couponId,
      registrationId,
      userId,
      discountAmount,
      originalAmount: amount,
      finalAmount,
    },
  });

  return { discountAmount, finalAmount, originalAmount: amount };
};

// ─────────────────────────────────────────────
// Internal: Record coupon usage AFTER payment is confirmed
// Skips coupon-limit re-validation (already validated at registration/order time)
// ─────────────────────────────────────────────
const finalizeCouponUsage = async (tx, couponId, registrationId, userId, amount) => {
  // Idempotency: skip if already recorded
  const existing = await tx.couponUsage.findUnique({ where: { registrationId } });
  if (existing) {
    return {
      discountAmount: existing.discountAmount,
      finalAmount: existing.finalAmount,
      originalAmount: existing.originalAmount,
    };
  }

  const coupon = await tx.eventCoupon.findUnique({ where: { id: couponId } });
  if (!coupon) return null; // coupon deleted between registration and payment — silently skip

  const { discountAmount, finalAmount } = computeDiscount(coupon, amount);

  // Increment global usage count (no maxUses guard — already validated earlier)
  await tx.eventCoupon.update({
    where: { id: couponId },
    data: { usedCount: { increment: 1 } },
  });

  // Record usage
  await tx.couponUsage.create({
    data: {
      couponId,
      registrationId,
      userId,
      discountAmount,
      originalAmount: amount,
      finalAmount,
    },
  });

  return { discountAmount, finalAmount, originalAmount: amount };
};

module.exports = {
  createCoupon,
  updateCoupon,
  deleteCoupon,
  listCoupons,
  validateCoupon,
  applyCouponInTransaction,
  finalizeCouponUsage,
  computeDiscount,
};
