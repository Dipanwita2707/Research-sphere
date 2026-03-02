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
const generateReceipt = (prefix, eventId, userId) => {
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${eventId.slice(0, 8)}_${ts}_${rand}`;
};

/**
 * Convert rupees to paise (Razorpay expects amount in the smallest currency unit)
 */
const toPaise = (rupees) => Math.round(rupees * 100);

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
const createIndividualPaymentOrder = async (eventId, userId) => {
  // ── Resolve event (accept eventId or uuid) ─────────────────────────────
  const event = await prisma.event.findFirst({
    where: { OR: [{ id: eventId }, { eventId }] },
  });
  if (!event) throw new NotFoundError('Event not found');
  if (event.paymentType !== 'paid') throw new ValidationError('This event does not require payment');
  if (!event.registrationFee || event.registrationFee <= 0) {
    throw new ValidationError('Event registration fee is not configured');
  }

  // ── Get user's registration ────────────────────────────────────────────
  const registration = await prisma.eventRegistration.findFirst({
    where: { eventId: event.id, userId },
  });
  if (!registration) throw new NotFoundError('Registration not found. Please register first.');

  if (registration.status === 'confirmed' && registration.paymentStatus === 'completed') {
    throw new ValidationError('Payment has already been completed for this registration');
  }

  // ── Idempotency: check for existing created order ──────────────────────
  const existingPayment = await prisma.payment.findFirst({
    where: {
      registrationId: registration.id,
      userId,
      status: 'created',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existingPayment) {
    // Return existing order so user can retry payment without creating a new order
    return {
      order: {
        id: existingPayment.razorpayOrderId,
        amount: toPaise(existingPayment.amount),
        currency: existingPayment.currency,
      },
      payment: existingPayment,
      key: process.env.RAZORPAY_KEY_ID,
      registrationId: registration.id,
    };
  }

  // ── Create Razorpay order ──────────────────────────────────────────────
  const amount = event.registrationFee; // in rupees
  const receipt = generateReceipt('IND', event.eventId, userId);

  const rzpOrder = await getRazorpay().orders.create({
    amount: toPaise(amount),
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
      capture_options: {
        automatic_expiry_period: 12,
        manual_expiry_period: 7200,
        refund_speed: 'optimum',
      },
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

  // ── Atomically update payment + registration ───────────────────────────
  const [updatedPayment] = await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: 'captured',
        paidAt: new Date(),
        attempts: { increment: 1 },
      },
    }),
    prisma.eventRegistration.update({
      where: { id: payment.registrationId },
      data: {
        status: 'confirmed',
        paymentStatus: 'completed',
        paymentId: razorpay_payment_id,
        amountPaid: payment.amount,
        updatedAt: new Date(),
      },
    }),
  ]);

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
const createTeamPaymentOrder = async (eventId, teamId, userId) => {
  // ── Resolve event ──────────────────────────────────────────────────────
  const event = await prisma.event.findFirst({
    where: { OR: [{ id: eventId }, { eventId }] },
  });
  if (!event) throw new NotFoundError('Event not found');
  if (event.paymentType !== 'paid') throw new ValidationError('This event does not require payment');
  if (event.participationType !== 'team') throw new ValidationError('This event is not team-based');

  // Determine fee (teamRegistrationFee takes precedence, fallback to registrationFee)
  const teamFee = event.teamRegistrationFee || event.registrationFee;
  if (!teamFee || teamFee <= 0) throw new ValidationError('Team registration fee is not configured');

  // ── Resolve team ───────────────────────────────────────────────────────
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId);
  const team = await prisma.eventTeam.findFirst({
    where: isUUID ? { id: teamId, eventId: event.id } : { teamId, eventId: event.id },
    include: {
      EventTeamMember: { where: { status: 'confirmed' } },
      EventTeamInvitation: { where: { status: 'pending' } },
    },
  });
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
  const existingPaid = await prisma.payment.findFirst({
    where: { teamId: team.id, eventId: event.id, status: 'captured' },
  });
  if (existingPaid) throw new ValidationError('Payment has already been completed for this team');

  // ── Idempotency: return existing created order ─────────────────────────
  const existingOrder = await prisma.payment.findFirst({
    where: { teamId: team.id, eventId: event.id, status: 'created' },
    orderBy: { createdAt: 'desc' },
  });
  if (existingOrder) {
    return {
      order: {
        id: existingOrder.razorpayOrderId,
        amount: toPaise(existingOrder.amount),
        currency: existingOrder.currency,
      },
      payment: existingOrder,
      key: process.env.RAZORPAY_KEY_ID,
      teamId: team.id,
    };
  }

  // ── Create Razorpay order ──────────────────────────────────────────────
  const receipt = generateReceipt('TEAM', event.eventId, userId);
  const rzpOrder = await getRazorpay().orders.create({
    amount: toPaise(teamFee),
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
      capture_options: {
        automatic_expiry_period: 12,
        manual_expiry_period: 7200,
        refund_speed: 'optimum',
      },
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
    await tx.eventRegistration.updateMany({
      where: {
        teamId: team.id,
        userId: { in: memberUserIds },
        status: { in: ['incomplete_team', 'pending', 'draft'] },
      },
      data: {
        status: 'confirmed',
        paymentStatus: 'completed',
        paymentId: razorpay_payment_id,
        amountPaid: payment.amount / memberUserIds.length, // Per-member share
        updatedAt: new Date(),
      },
    });
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
            await tx.eventRegistration.updateMany({
              where: {
                teamId: team.id,
                userId: { in: memberUserIds },
              },
              data: {
                status: 'confirmed',
                paymentStatus: 'completed',
                paymentId: paymentEntity.id,
                amountPaid: payment.amount / memberUserIds.length,
                updatedAt: new Date(),
              },
            });
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
  const event = await prisma.event.findFirst({
    where: { OR: [{ id: eventId }, { eventId }] },
  });
  if (!event) throw new NotFoundError('Event not found');

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
