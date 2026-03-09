/**
 * Payment Service — Razorpay Integration
 *
 * Handles order creation, payment verification, and webhook processing
 * for both Individual and Team-based event registrations.
 *
 * Security:
 * - Orders MUST be created on the backend (amount never trusted from frontend)
 * - Signature verification using HMAC-SHA256 before confirming any payment
 * - Idempotency via unique receipt IDs to prevent double charges
 * - Webhook verification with separate webhook secret
 */

const Razorpay = require('razorpay');
const crypto = require('crypto');
const prisma = require('../../../shared/config/database');
const { ValidationError, ForbiddenError, NotFoundError } = require('../../../shared/utils/AppError');
const { REGISTRATION_STATUS, PAYMENT_STATUS } = require('./registration.service');
const { validateCoupon, applyCouponInTransaction, finalizeCouponUsage } = require('./coupon.service');
const { RAZORPAY_CAPTURE_CONFIG } = require('../constants/event.constants');
const { resolveEvent } = require('../utils/eventHelpers');

// ── Razorpay instance (lazy-initialized) ────────────────────────────────────

let razorpayInstance = null;

const getRazorpay = () => {
  if (!razorpayInstance) {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) {
      throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in environment variables');
    }
    razorpayInstance = new Razorpay({ key_id, key_secret });
  }
  return razorpayInstance;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Generate a unique receipt ID for idempotency
 */
const generateReceipt = (prefix, eventId) => {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${eventId.slice(0, 8)}_${ts}_${rand}`;
};

/**
 * Convert rupees to paise (Razorpay expects amount in the smallest currency unit)
 */
const convertRupeesToPaise = (rupees) => Math.round(rupees * 100);

// ══════════════════════════════════════════════════════════════════════════════
//  INDIVIDUAL PAYMENT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Create a Razorpay order for an individual registration.
 *
 * Pre-conditions checked:
 *  1. Event exists and is paid
 *  2. User has a registration in 'pending' status with paymentStatus 'pending'
 *  3. No existing successful payment for this registration
 *
 * @returns {{ order, payment, key }} — Razorpay order details + public key
 */
const createIndividualPaymentOrder = async (eventId, userId, couponCode = undefined) => {
  // ── Resolve event (accept eventId or uuid) ─────────────────────────────
  const event = await resolveEvent(eventId);
  if (event.paymentType !== 'paid') throw new ValidationError('This event does not require payment');
  if (!event.registrationFee || event.registrationFee <= 0) {
    throw new ValidationError('Event registration fee is not configured');
  }

  // ── Parallelize registration + existing payment check ──────────────────
  const [registrationRecord, existingPayment] = await Promise.all([
    prisma.eventRegistration.findFirst({
      where: { eventId: event.id, userId },
    }),
    prisma.payment.findFirst({
      where: {
        eventId: event.id,
        userId,
        status: 'created',
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  let registration = registrationRecord;

  if (!registration) throw new NotFoundError('Registration not found. Please register first.');

  if (registration.status === 'confirmed' && registration.paymentStatus === 'completed') {
    if (registration.amountPaid === 0 || registration.amountPaid === null) {
      return {
        couponFullyFree: true,
        message: 'Registration already confirmed — coupon covered the full amount.',
        registrationId: registration.id,
      };
    }
    throw new ValidationError('Payment has already been completed for this registration');
  }

  const baseAmount = event.registrationFee;
  const normalizedCouponCode = typeof couponCode === 'string'
    ? couponCode.trim().toUpperCase()
    : couponCode;
  const shouldSyncCouponState = couponCode !== undefined;

  let amount = (registration.amountPaid !== null && registration.amountPaid !== undefined)
    ? registration.amountPaid
    : baseAmount;
  let couponMeta = null;

  if (normalizedCouponCode) {
    const couponResult = await validateCoupon(event.id, normalizedCouponCode, userId, baseAmount);
    amount = couponResult.finalAmount;
    couponMeta = {
      couponId: couponResult.couponId,
      code: couponResult.code,
      discountAmount: couponResult.discountAmount,
      originalAmount: couponResult.originalAmount,
      finalAmount: couponResult.finalAmount,
    };
  } else if (shouldSyncCouponState) {
    amount = baseAmount;
  }

  if (
    !shouldSyncCouponState &&
    registration.couponId &&
    amount > 0 &&
    amount < 1 &&
    registration.originalAmount &&
    registration.originalAmount > 1
  ) {
    amount = 1;
    await prisma.eventRegistration.update({
      where: { id: registration.id },
      data: {
        discountAmount: Math.round((registration.originalAmount - 1) * 100) / 100,
        amountPaid: 1,
        updatedAt: new Date(),
      },
    });
    registration = {
      ...registration,
      discountAmount: Math.round((registration.originalAmount - 1) * 100) / 100,
      amountPaid: 1,
    };
  }

  if (shouldSyncCouponState) {
    registration = await prisma.$transaction(async (tx) => {
      const updatedRegistration = await tx.eventRegistration.update({
        where: { id: registration.id },
        data: {
          status: amount === 0 ? REGISTRATION_STATUS.CONFIRMED : REGISTRATION_STATUS.PENDING,
          paymentStatus: amount === 0 ? PAYMENT_STATUS.COMPLETED : PAYMENT_STATUS.PENDING,
          couponId: couponMeta?.couponId ?? null,
          discountAmount: couponMeta?.discountAmount ?? null,
          originalAmount: couponMeta?.originalAmount ?? null,
          amountPaid: amount,
          updatedAt: new Date(),
        },
      });

      if (couponMeta && amount === 0) {
        await applyCouponInTransaction(tx, couponMeta.couponId, registration.id, userId, baseAmount);
      }

      return updatedRegistration;
    });
  }

  if (existingPayment && existingPayment.registrationId === registration.id) {
    if (Math.abs(existingPayment.amount - amount) < 0.01 && amount > 0) {
      return {
        order: {
          id: existingPayment.razorpayOrderId,
          amount: convertRupeesToPaise(existingPayment.amount),
          currency: existingPayment.currency,
        },
        payment: existingPayment,
        key: process.env.RAZORPAY_KEY_ID,
        registrationId: registration.id,
      };
    }

    await prisma.payment.update({
      where: { id: existingPayment.id },
      data: {
        status: 'failed',
        failedAt: new Date(),
      },
    });
  }

  if (amount === 0) {
    return {
      couponFullyFree: true,
      message: couponMeta
        ? 'Registration confirmed — coupon covered the full amount.'
        : 'Registration already confirmed — no payment required.',
      registrationId: registration.id,
    };
  }

  if (amount < 1) {
    throw new ValidationError(`Payment amount ₹${amount.toFixed(2)} is below Razorpay's minimum of ₹1. Please contact the event organiser.`);
  }

  const receipt = generateReceipt('IND', event.eventId, userId);

  const rzpOrder = await getRazorpay().orders.create({
    amount: convertRupeesToPaise(amount),
    currency: 'INR',
    receipt,
    notes: {
      eventId: event.id,
      eventName: event.name,
      registrationId: registration.id,
      userId,
      paymentFor: 'individual',
    },
    payment: {
      capture: 'automatic',
      capture_options: RAZORPAY_CAPTURE_CONFIG,
    },
  });

  // ── Persist payment record ─────────────────────────────────────────────
  const payment = await prisma.payment.create({
    data: {
      registrationId: registration.id,
      eventId: event.id,
      userId,
      razorpayOrderId: rzpOrder.id,
      amount,
      currency: 'INR',
      status: 'created',
      paymentFor: 'individual',
      receipt,
      metadata: {
        eventName: event.name,
        eventId: event.eventId,
        couponCode: couponMeta?.code || null,
        discountAmount: couponMeta?.discountAmount || null,
      },
    },
  });

  return {
    order: {
      id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
    },
    payment,
    key: process.env.RAZORPAY_KEY_ID,
    registrationId: registration.id,
  };
};

/**
 * Verify an individual payment after Razorpay Checkout completes.
 *
 * Verifies HMAC-SHA256 signature, then atomically updates:
 *  - Payment record → captured
 *  - EventRegistration → confirmed + paymentStatus completed
 */
const verifyIndividualPayment = async (eventId, userId, body) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new ValidationError('Missing payment verification parameters');
  }

  // ── Find the payment record ────────────────────────────────────────────
  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId: razorpay_order_id },
  });

  if (!payment) throw new NotFoundError('Payment record not found');
  if (payment.userId !== userId) throw new ForbiddenError('Unauthorized payment verification');
  if (payment.status === 'captured') {
    // Already verified — idempotent
    return { success: true, message: 'Payment already verified', payment };
  }

  // ── Signature verification ─────────────────────────────────────────────
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    // Mark payment as failed
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'failed', failedAt: new Date() },
    });
    throw new ValidationError('Payment signature verification failed — possible tampering detected');
  }

  // ── Atomically update payment + registration + finalize coupon ───────────
  const updatedPayment = await prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: 'captured',
        paidAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    await tx.eventRegistration.update({
      where: { id: payment.registrationId },
      data: {
        status: 'confirmed',
        paymentStatus: 'completed',
        paymentId: razorpay_payment_id,
        amountPaid: payment.amount,
        updatedAt: new Date(),
      },
    });

    // Finalize coupon usage now that payment is actually confirmed
    if (payment.registrationId) {
      const reg = await tx.eventRegistration.findUnique({
        where: { id: payment.registrationId },
        select: { couponId: true, originalAmount: true },
      });
      if (reg?.couponId) {
        await finalizeCouponUsage(tx, reg.couponId, payment.registrationId, userId, reg.originalAmount);
      }
    }

    return updatedPayment;
  });

  return { success: true, message: 'Payment verified and registration confirmed', payment: updatedPayment };
};

// ══════════════════════════════════════════════════════════════════════════════
//  TEAM PAYMENT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Create a Razorpay order for a team registration.
 *
 * Pre-conditions:
 *  1. Event is paid & team-based
 *  2. Team exists, user is the leader
 *  3. All invited members have accepted (team status = complete or confirmed)
 *  4. No existing successful payment for this team
 *
 * Fee logic: Fixed team fee regardless of member count.
 *   e.g. ₹100 for team of 1–5 members.
 */
const createTeamPaymentOrder = async (eventId, teamId, userId, couponCode = null) => {
  // ── Resolve event ──────────────────────────────────────────────────────
  const event = await resolveEvent(eventId);
  if (event.paymentType !== 'paid') throw new ValidationError('This event does not require payment');
  if (event.participationType !== 'team') throw new ValidationError('This event is not team-based');

  // Determine fee (teamRegistrationFee takes precedence, fallback to registrationFee)
  const baseFee = event.teamRegistrationFee || event.registrationFee;
  if (!baseFee || baseFee <= 0) throw new ValidationError('Team registration fee is not configured');

  // Apply coupon discount if provided
  let teamFee = baseFee;
  let couponMeta = null;
  if (couponCode) {
    const couponResult = await validateCoupon(event.id, couponCode, userId, baseFee);
    teamFee = couponResult.finalAmount;
    couponMeta = {
      couponId: couponResult.couponId,
      code: couponResult.code,
      discountAmount: couponResult.discountAmount,
      originalAmount: baseFee,
    };
  }

  // ── Resolve team + check for existing payment in parallel ─────────────
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId);
  const teamWhere = isUUID ? { id: teamId, eventId: event.id } : { teamId, eventId: event.id };

  const [team, existingPaid] = await Promise.all([
    prisma.eventTeam.findFirst({
      where: teamWhere,
      include: {
        EventTeamMember: { where: { status: 'confirmed' } },
        EventTeamInvitation: { where: { status: 'pending' } },
      },
    }),
    prisma.payment.findFirst({
      where: { eventId: event.id, status: 'captured' },
    }),
  ]);

  if (!team) throw new NotFoundError('Team not found');
  if (team.leaderId !== userId) throw new ForbiddenError('Only the team leader can initiate payment');

  // ── Validate team readiness ────────────────────────────────────────────
  if (team.EventTeamInvitation.length > 0) {
    throw new ValidationError('All pending invitations must be accepted or declined before payment');
  }

  const confirmedMembers = team.EventTeamMember.length;
  const minSize = event.minTeamSize || 1;
  if (confirmedMembers < minSize) {
    throw new ValidationError(`Team needs at least ${minSize} confirmed member(s). Currently: ${confirmedMembers}`);
  }

  if (!team.isComplete && team.status !== 'complete' && team.status !== 'confirmed') {
    throw new ValidationError('Team must be finalized before payment. Please complete team formation first.');
  }

  // ── Check for existing successful payment ──────────────────────────────
  if (existingPaid && existingPaid.teamId === team.id) {
    throw new ValidationError('Payment has already been completed for this team');
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ZERO-AMOUNT: Coupon covers 100% — skip Razorpay, auto-confirm team
  // ══════════════════════════════════════════════════════════════════════════
  if (teamFee === 0 && couponMeta) {
    const memberUserIds = team.EventTeamMember.map((m) => m.userId);

    await prisma.$transaction(async (tx) => {
      // 1. Apply coupon (increment usage count + record CouponUsage)
      //    Use the leader's registration for the coupon usage record
      const leaderReg = await tx.eventRegistration.findFirst({
        where: { eventId: event.id, userId, teamId: team.id },
      });
      if (leaderReg) {
        await applyCouponInTransaction(tx, couponMeta.couponId, leaderReg.id, userId, baseFee);
      }

      // 2. Confirm team
      await tx.eventTeam.update({
        where: { id: team.id },
        data: { status: 'confirmed', updatedAt: new Date() },
      });

      // 3. Confirm all team member registrations
      await tx.eventRegistration.updateMany({
        where: {
          teamId: team.id,
          userId: { in: memberUserIds },
          status: { in: ['incomplete_team', 'pending', 'draft'] },
        },
        data: {
          status: 'confirmed',
          paymentStatus: 'completed',
          amountPaid: 0,
          couponId: couponMeta.couponId,
          discountAmount: couponMeta.discountAmount,
          originalAmount: couponMeta.originalAmount,
          updatedAt: new Date(),
        },
      });

      // 4. Create a payment record for audit trail (no Razorpay order)
      await tx.payment.create({
        data: {
          eventId: event.id,
          userId,
          teamId: team.id,
          razorpayOrderId: `COUPON_FREE_${Date.now()}`,
          amount: 0,
          currency: 'INR',
          status: 'captured',
          paymentFor: 'team',
          paidAt: new Date(),
          receipt: generateReceipt('TEAM', event.eventId, userId),
          metadata: {
            eventName: event.name,
            eventId: event.eventId,
            teamName: team.name,
            memberCount: confirmedMembers,
            coupon: couponMeta,
            freeRegistration: true,
            couponFullyFree: true,
          },
        },
      });
    });

    return {
      couponFullyFree: true,
      message: 'Coupon covered the full amount. Team registration confirmed!',
      teamId: team.id,
      couponApplied: couponMeta,
    };
  }

  // ── Idempotency: return existing created order (skip if new coupon differs) ─
  if (!couponCode) {
    const existingOrder = await prisma.payment.findFirst({
      where: { teamId: team.id, eventId: event.id, status: 'created' },
      orderBy: { createdAt: 'desc' },
    });
    if (existingOrder) {
      return {
        order: {
          id: existingOrder.razorpayOrderId,
          amount: convertRupeesToPaise(existingOrder.amount),
          currency: existingOrder.currency,
        },
        payment: existingOrder,
        key: process.env.RAZORPAY_KEY_ID,
        teamId: team.id,
      };
    }
  }

  // ── Create Razorpay order ──────────────────────────────────────────────
  const receipt = generateReceipt('TEAM', event.eventId, userId);
  const rzpOrder = await getRazorpay().orders.create({
    amount: convertRupeesToPaise(teamFee),
    currency: 'INR',
    receipt,
    notes: {
      eventId: event.id,
      eventName: event.name,
      teamId: team.id,
      teamName: team.name,
      userId,
      paymentFor: 'team',
      memberCount: confirmedMembers,
    },
    payment: {
      capture: 'automatic',
      capture_options: RAZORPAY_CAPTURE_CONFIG,
    },
  });

  // ── Persist payment record ─────────────────────────────────────────────
  const payment = await prisma.payment.create({
    data: {
      eventId: event.id,
      userId,
      teamId: team.id,
      razorpayOrderId: rzpOrder.id,
      amount: teamFee,
      currency: 'INR',
      status: 'created',
      paymentFor: 'team',
      receipt,
      metadata: {
        eventName: event.name,
        eventId: event.eventId,
        teamName: team.name,
        memberCount: confirmedMembers,
        ...(couponMeta ? { coupon: couponMeta } : {}),
      },
    },
  });

  return {
    order: {
      id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
    },
    payment,
    key: process.env.RAZORPAY_KEY_ID,
    teamId: team.id,
    couponApplied: couponMeta,
  };
};

/**
 * Verify a team payment after Razorpay Checkout completes.
 *
 * On success, atomically:
 *  - Payment → captured
 *  - All team member registrations → confirmed, paymentStatus → completed
 *  - Team status → confirmed
 */
const verifyTeamPayment = async (eventId, teamId, userId, body) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new ValidationError('Missing payment verification parameters');
  }

  // ── Find payment ───────────────────────────────────────────────────────
  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId: razorpay_order_id },
  });
  if (!payment) throw new NotFoundError('Payment record not found');
  if (payment.userId !== userId) throw new ForbiddenError('Unauthorized payment verification');
  if (payment.paymentFor !== 'team') throw new ValidationError('This is not a team payment');
  if (payment.status === 'captured') {
    return { success: true, message: 'Payment already verified', payment };
  }

  // ── Signature verification ─────────────────────────────────────────────
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'failed', failedAt: new Date() },
    });
    throw new ValidationError('Payment signature verification failed — possible tampering detected');
  }

  // ── Resolve team ───────────────────────────────────────────────────────
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId);
  const team = await prisma.eventTeam.findFirst({
    where: isUUID ? { id: teamId } : { teamId },
    include: { EventTeamMember: { where: { status: 'confirmed' } } },
  });
  if (!team) throw new NotFoundError('Team not found');

  // ── Atomically: update payment + team + all member registrations ───────
  await prisma.$transaction(async (tx) => {
    // 1. Update payment record
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: 'captured',
        paidAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    // 2. Confirm team
    await tx.eventTeam.update({
      where: { id: team.id },
      data: { status: 'confirmed', updatedAt: new Date() },
    });

    // 3. Confirm all team member registrations
    const memberUserIds = team.EventTeamMember.map((m) => m.userId);
    const memberRegistrationUpdate = {
      status: 'confirmed',
      paymentStatus: 'completed',
      paymentId: razorpay_payment_id,
      amountPaid: payment.amount / memberUserIds.length,
      updatedAt: new Date(),
    };

    if (payment.metadata?.coupon) {
      memberRegistrationUpdate.couponId = payment.metadata.coupon.couponId;
      memberRegistrationUpdate.discountAmount = payment.metadata.coupon.discountAmount;
      memberRegistrationUpdate.originalAmount = payment.metadata.coupon.originalAmount;
    }

    await tx.eventRegistration.updateMany({
      where: {
        teamId: team.id,
        userId: { in: memberUserIds },
        status: { in: ['incomplete_team', 'pending', 'draft'] },
      },
      data: memberRegistrationUpdate,
    });

    // 4. Finalize coupon usage now that payment is actually confirmed
    if (payment.metadata?.coupon) {
      const couponMeta = payment.metadata.coupon;
      const leaderReg = await tx.eventRegistration.findFirst({
        where: { eventId: payment.eventId, userId, teamId: team.id },
      });
      if (leaderReg) {
        await finalizeCouponUsage(tx, couponMeta.couponId, leaderReg.id, userId, couponMeta.originalAmount);
      }
    }
  });

  const updatedPayment = await prisma.payment.findUnique({
    where: { id: payment.id },
  });

  return { success: true, message: 'Team payment verified and all registrations confirmed', payment: updatedPayment };
};

// ══════════════════════════════════════════════════════════════════════════════
//  WEBHOOK HANDLER
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Process Razorpay webhook events.
 *
 * Supported events:
 *  - payment.captured  → confirm registration
 *  - payment.failed    → mark payment failed
 *
 * Webhook signature is verified before processing.
 */
const handleWebhook = async (rawBody, signature) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET not configured');
  }

  // ── Verify webhook signature ───────────────────────────────────────────
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (expectedSignature !== signature) {
    throw new ValidationError('Invalid webhook signature');
  }

  const event = JSON.parse(rawBody);
  const eventType = event.event;
  const paymentEntity = event.payload?.payment?.entity;

  if (!paymentEntity) {
    return { success: true, message: 'No payment entity in webhook' };
  }

  const razorpayOrderId = paymentEntity.order_id;
  if (!razorpayOrderId) {
    return { success: true, message: 'No order_id in webhook payload' };
  }

  // ── Find our payment record ────────────────────────────────────────────
  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId },
  });

  if (!payment) {
    // Unknown order — ignore (could be from another integration)
    return { success: true, message: 'Order not found — ignoring' };
  }

  switch (eventType) {
    case 'payment.captured': {
      if (payment.status === 'captured') {
        return { success: true, message: 'Already captured — idempotent' };
      }

      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            razorpayPaymentId: paymentEntity.id,
            status: 'captured',
            paidAt: new Date(),
            webhookVerified: true,
            attempts: { increment: 1 },
          },
        });

        if (payment.paymentFor === 'individual' && payment.registrationId) {
          await tx.eventRegistration.update({
            where: { id: payment.registrationId },
            data: {
              status: 'confirmed',
              paymentStatus: 'completed',
              paymentId: paymentEntity.id,
              amountPaid: payment.amount,
              updatedAt: new Date(),
            },
          });

          // Finalize coupon usage on confirmed payment
          const reg = await tx.eventRegistration.findUnique({
            where: { id: payment.registrationId },
            select: { couponId: true, originalAmount: true, userId: true },
          });
          if (reg?.couponId) {
            await finalizeCouponUsage(tx, reg.couponId, payment.registrationId, reg.userId, reg.originalAmount);
          }
        } else if (payment.paymentFor === 'team' && payment.teamId) {
          // Confirm team + all registrations
          const team = await tx.eventTeam.findUnique({
            where: { id: payment.teamId },
            include: { EventTeamMember: { where: { status: 'confirmed' } } },
          });

          if (team) {
            await tx.eventTeam.update({
              where: { id: team.id },
              data: { status: 'confirmed', updatedAt: new Date() },
            });

            const memberUserIds = team.EventTeamMember.map((m) => m.userId);
            const memberRegistrationUpdate = {
              status: 'confirmed',
              paymentStatus: 'completed',
              paymentId: paymentEntity.id,
              amountPaid: payment.amount / memberUserIds.length,
              updatedAt: new Date(),
            };

            if (payment.metadata?.coupon) {
              memberRegistrationUpdate.couponId = payment.metadata.coupon.couponId;
              memberRegistrationUpdate.discountAmount = payment.metadata.coupon.discountAmount;
              memberRegistrationUpdate.originalAmount = payment.metadata.coupon.originalAmount;
            }

            await tx.eventRegistration.updateMany({
              where: {
                teamId: team.id,
                userId: { in: memberUserIds },
              },
              data: memberRegistrationUpdate,
            });

            // Finalize coupon usage on confirmed team payment
            if (payment.metadata?.coupon) {
              const couponMeta = payment.metadata.coupon;
              const leaderReg = await tx.eventRegistration.findFirst({
                where: { eventId: payment.eventId, userId: payment.userId, teamId: team.id },
              });
              if (leaderReg) {
                await finalizeCouponUsage(tx, couponMeta.couponId, leaderReg.id, payment.userId, couponMeta.originalAmount);
              }
            }
          }
        }
      });

      return { success: true, message: 'Payment captured via webhook' };
    }

    case 'payment.failed': {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'failed',
          failedAt: new Date(),
          webhookVerified: true,
          attempts: { increment: 1 },
          metadata: {
            ...(payment.metadata || {}),
            failureReason: paymentEntity.error_description || 'Unknown',
            errorCode: paymentEntity.error_code || null,
          },
        },
      });

      return { success: true, message: 'Payment failure recorded via webhook' };
    }

    default:
      return { success: true, message: `Unhandled event type: ${eventType}` };
  }
};

// ══════════════════════════════════════════════════════════════════════════════
//  PAYMENT STATUS QUERY
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Get payment status for a registration or team.
 */
const getPaymentStatus = async (eventId, userId, { registrationId, teamId } = {}) => {
  const event = await resolveEvent(eventId);

  // For team payments: query by teamId only (any team member can check — payment was by leader)
  // For individual payments: query by userId
  const whereClause = teamId
    ? { eventId: event.id, teamId, paymentFor: 'team' }
    : { eventId: event.id, userId };
  if (registrationId) whereClause.registrationId = registrationId;

  const payments = await prisma.payment.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const latestPayment = payments[0] || null;
  const isPaid = payments.some((p) => p.status === 'captured');

  return {
    isPaid,
    latestPayment,
    payments,
  };
};

module.exports = {
  createIndividualPaymentOrder,
  verifyIndividualPayment,
  createTeamPaymentOrder,
  verifyTeamPayment,
  handleWebhook,
  getPaymentStatus,
};
