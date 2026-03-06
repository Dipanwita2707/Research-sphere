/**
 * Email Credit Service
 *
 * Per-event email credit pool.
 *
 * Business rules
 * ──────────────
 * • 1 registration  →  +3 credits (formula: registrationCount × 3)
 * • 1 email sent    →  -1 credit  (deducted atomically on send)
 * • Cancellations   →  NO credit revoke (credits already granted)
 * • Credits are event-scoped, never global
 *
 * Implementation strategy
 * ───────────────────────
 * totalCredits is always derived live from the DB registration count — no
 * need to hook into every registration-creation code path (individual,
 * team, paid/unpaid, etc.).  usedCredits is tracked incrementally and
 * never recomputed, so the balance is always: totalCredits − usedCredits.
 */

const prisma = require('../../../shared/config/database');

const CREDITS_PER_REGISTRATION = 3;

// ────────────────────────────────────────────────────────────────────────────
// Internal
// ────────────────────────────────────────────────────────────────────────────

/**
 * Compute totalCredits from live registration count and return the credit
 * record, creating it if it does not yet exist. Keeps the persisted
 * totalCredits column in sync as a side-effect (fire-and-forget).
 */
async function _computeCredits(eventId, tx = prisma) {
  const [count, rec] = await Promise.all([
    tx.eventRegistration.count({ where: { eventId } }),
    tx.eventEmailCredit.findUnique({ where: { eventId } }),
  ]);

  const total = count * CREDITS_PER_REGISTRATION;
  const used  = rec?.usedCredits ?? 0;

  // Keep persisted totalCredits fresh (background, non-blocking when called outside tx)
  if (tx === prisma && (rec?.totalCredits ?? -1) !== total) {
    prisma.eventEmailCredit.upsert({
      where: { eventId },
      create:  { eventId, totalCredits: total, usedCredits: 0 },
      update:  { totalCredits: total },
    }).catch(() => {});
  }

  return { total, used, available: Math.max(0, total - used) };
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Return the current credit balance for an event.
 * @returns {{ total: number, used: number, available: number }}
 */
async function getCredits(eventId) {
  return _computeCredits(eventId);
}

/**
 * Check (without deducting) whether an event has sufficient credits.
 * @returns {{ ok: boolean, available: number }}
 */
async function checkAvailable(eventId, required) {
  const { available } = await _computeCredits(eventId);
  return { ok: available >= required, available };
}

/**
 * Atomically deduct credits when emails are about to be sent.
 * Throws an Error if available credits < amount (caller should convert to HTTP 402).
 *
 * @param {string} eventId
 * @param {number} amount       – number of recipients being attempted
 * @param {string} [emailLogId] – EventEmailLog.id for traceability
 */
async function deductCredits(eventId, amount, emailLogId) {
  if (amount <= 0) return;

  await prisma.$transaction(async (tx) => {
    const { total, used, available } = await _computeCredits(eventId, tx);

    if (available < amount) {
      throw new Error(
        `Insufficient email credits: ${available} available, ${amount} required.`
      );
    }

    // Upsert to handle the case where no credit row exists yet
    await tx.eventEmailCredit.upsert({
      where:  { eventId },
      create: { eventId, totalCredits: total, usedCredits: amount },
      update: { totalCredits: total, usedCredits: { increment: amount } },
    });

    await tx.emailCreditLog.create({
      data: {
        eventId,
        action:      'deduct',
        amount,
        description: `Deducted ${amount} credit(s) for bulk email send attempt`,
        emailLogId:  emailLogId ?? null,
      },
    });
  });
}

/**
 * Atomically refund credits when some emails in a batch failed to send.
 * Credits are restored for each failed delivery so the organiser is only
 * charged for emails that were actually dispatched.
 *
 * @param {string} eventId
 * @param {number} amount       – number of emails that failed (to refund)
 * @param {string} [emailLogId] – EventEmailLog.id for traceability
 */
async function refundCredits(eventId, amount, emailLogId) {
  if (amount <= 0) return;

  await prisma.$transaction(async (tx) => {
    const rec = await tx.eventEmailCredit.findUnique({ where: { eventId } });
    const currentUsed = rec?.usedCredits ?? 0;
    const safeRefund  = Math.min(amount, currentUsed); // never go below 0

    if (safeRefund <= 0) return;

    await tx.eventEmailCredit.update({
      where:  { eventId },
      data:   { usedCredits: { decrement: safeRefund } },
    });

    await tx.emailCreditLog.create({
      data: {
        eventId,
        action:      'refund',
        amount:      safeRefund,
        description: `Refunded ${safeRefund} credit(s) for failed email deliveries`,
        emailLogId:  emailLogId ?? null,
      },
    });
  });
}

module.exports = {
  CREDITS_PER_REGISTRATION,
  getCredits,
  checkAvailable,
  deductCredits,
  refundCredits,
};

