/**
 * Event Feedback Service
 *
 * Handles event feedback and stall feedback submission, retrieval,
 * and analytics (per-criterion averages via raw SQL).
 *
 * Split from event.service.js for Single Responsibility Principle.
 */

const prisma = require("../../../shared/config/database");
const {
  ValidationError,
  ForbiddenError,
  NotFoundError,
} = require("../../../shared/utils/AppError");
const { getEventLean } = require("../utils/eventHelpers");

// ── Feedback now uses a single 1-10 rating (backwards compatible) ──────────

/**
 * Submit event feedback (single rating 1-10 + optional short description)
 * Public - no auth required
 *
 * Accepts 1 rating (new simplified form) or 10 ratings (legacy) for backwards
 * compatibility. The points array is stored as-is.
 *
 * @param {string} eventId - Event ID (UUID or eventId string)
 * @param {Object} data - { points: number[], shortDescription?: string }
 * @returns {Object} Created feedback record
 */
const submitEventFeedback = async (eventId, { points, shortDescription }) => {
  const event = await getEventLean(prisma, eventId);

  const pts = Array.isArray(points) ? points : [];
  if (pts.length < 1 || pts.length > 10) {
    throw new ValidationError(
      "Please provide between 1 and 10 ratings (1-10).",
    );
  }
  const valid = pts.every((p) => typeof p === "number" && p >= 1 && p <= 10);
  if (!valid) {
    throw new ValidationError("Each rating must be a number between 1 and 10.");
  }

  const feedback = await prisma.eventFeedback.create({
    data: {
      eventId,
      points: pts,
      shortDescription: shortDescription
        ? String(shortDescription).trim().slice(0, 2000)
        : null,
    },
  });
  return feedback;
};

/**
 * Get minimal event info for feedback form (public - no auth, for QR scanner users)
 *
 * @param {string} eventId - Event ID
 * @returns {{ id: string, name: string }}
 */
const getEventFeedbackFormInfo = async (eventId) => {
  const event = await getEventLean(prisma, eventId);
  if (event.status !== "published") {
    throw new NotFoundError("Event not found");
  }
  return { id: event.id, name: event.name };
};

/**
 * Get event feedback list (event creator only)
 *
 * @param {string} eventId - Event ID
 * @param {string} userId - Requesting user ID (must be event creator)
 * @param {Object} options - { page, limit }
 * @returns {{ feedback: Array, pagination: Object, summary: Object }}
 */
const getEventFeedback = async (eventId, userId, { page = 1, limit = 20 }) => {
  const event = await getEventLean(prisma, eventId);
  if (event.createdById !== userId) {
    throw new ForbiddenError("Only the event creator can view feedback");
  }

  // Fetch paginated items, count, and average in parallel (single pass each)
  const [items, total, avgResult] = await Promise.all([
    prisma.eventFeedback.findMany({
      where: { eventId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.eventFeedback.count({ where: { eventId } }),
    // Compute average rating across all feedback (handles variable-length points arrays)
    prisma.$queryRaw`
      SELECT COALESCE(
        AVG(
          (SELECT AVG(val::float)
           FROM jsonb_array_elements_text(points::jsonb) AS val)
        ), 0
      )::float AS "overallAvg"
      FROM "event_feedback"
      WHERE "eventId" = ${eventId}
    `,
  ]);

  const overallAvg = avgResult[0]?.overallAvg ?? 0;

  return {
    feedback: items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    summary: {
      totalFeedback: total,
      overallAvg: Number(overallAvg.toFixed(2)),
    },
  };
};

/**
 * Get stall info for feedback form (public - no auth)
 *
 * @param {string} eventId - Event ID
 * @param {string} stallId - Stall ID
 * @returns {{ id: string, eventName: string, stallId: string, stallName: string }}
 */
const getStallFeedbackFormInfo = async (eventId, stallId) => {
  const event = await getEventLean(prisma, eventId);
  if (event.status !== 'published') {
    throw new NotFoundError('Event not found');
  }
  const stall = await prisma.stall.findFirst({
    where: { stallId, eventId: event.id, isActive: true },
  });
  if (!stall) throw new NotFoundError('Stall not found');
  return { id: event.id, eventName: event.name, stallId: stall.stallId, stallName: stall.stallName };
};

/**
 * Submit stall feedback (public - no auth)
 *
 * @param {string} eventId - Event ID
 * @param {string} stallId - Stall ID
 * @param {Object} data - { points: number[], shortDescription?: string }
 * @returns {{ id: string }}
 */
const submitStallFeedback = async (eventId, stallId, { points, shortDescription }) => {
  const event = await getEventLean(prisma, eventId);

  const stall = await prisma.stall.findFirst({
    where: { stallId, eventId: event.id, isActive: true },
  });
  if (!stall) throw new NotFoundError('Stall not found');

  const pts = Array.isArray(points) ? points : [];
  if (pts.length < 1 || pts.length > 10) {
    throw new ValidationError('Please provide between 1 and 10 ratings (1-10).');
  }
  const valid = pts.every((p) => typeof p === 'number' && p >= 1 && p <= 10);
  if (!valid) throw new ValidationError('Each rating must be a number between 1 and 10.');

  const feedback = await prisma.stallFeedback.create({
    data: {
      eventId: event.id,
      stallId: stall.stallId,
      points: pts,
      shortDescription: shortDescription ? String(shortDescription).trim().slice(0, 2000) : null,
    },
  });
  return { id: feedback.id };
};

/**
 * Get stall feedback list (event creator only)
 *
 * @param {string} eventId - Event ID
 * @param {string} stallId - Stall ID
 * @param {string} userId - Requesting user ID (must be event creator)
 * @param {Object} options - { page, limit }
 * @returns {{ feedback: Array, pagination: Object, summary: Object }}
 */
const getStallFeedback = async (eventId, stallId, userId, { page = 1, limit = 20 }) => {
  const event = await getEventLean(prisma, eventId);
  if (event.createdById !== userId) throw new ForbiddenError('Only the event creator can view stall feedback');

  const stall = await prisma.stall.findFirst({ where: { stallId, eventId: event.id } });
  if (!stall) throw new NotFoundError('Stall not found');

  // Fetch paginated items, count, and average in parallel
  const [items, total, avgResult] = await Promise.all([
    prisma.stallFeedback.findMany({
      where: { stallId, eventId: event.id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.stallFeedback.count({ where: { stallId, eventId: event.id } }),
    // Compute average rating (handles variable-length points arrays)
    prisma.$queryRaw`
      SELECT COALESCE(
        AVG(
          (SELECT AVG(val::float)
           FROM jsonb_array_elements_text(points::jsonb) AS val)
        ), 0
      )::float AS "overallAvg"
      FROM "stall_feedback"
      WHERE "stallId" = ${stallId} AND "eventId" = ${event.id}
    `,
  ]);

  const overallAvg = avgResult[0]?.overallAvg ?? 0;

  return {
    feedback: items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    summary: { totalFeedback: total, overallAvg: Number(overallAvg.toFixed(2)) },
  };
};

/**
 * Get stall feedback for the stall owner
 *
 * @param {string} eventId - Event ID
 * @param {string} stallId - Stall ID
 * @param {string} userId - Requesting user ID (must be stall owner with approved application)
 * @param {Object} options - { page, limit }
 * @returns {{ feedback: Array, pagination: Object, summary: Object }}
 */
const getStallOwnerFeedback = async (eventId, stallId, userId, { page = 1, limit = 20 } = {}) => {
  const event = await getEventLean(prisma, eventId);
  if (!event) throw new NotFoundError('Event not found');

  // Verify the requesting user owns this stall (approved application)
  const application = await prisma.stallApplication.findFirst({
    where: { eventId: event.id, stallId, applicantId: userId, applicationStatus: 'approved' },
  });
  if (!application) throw new ForbiddenError('You do not own this stall');

  const where = { stallId, eventId: event.id };

  // Fetch paginated items, count, and overall average in parallel
  const [items, total, avgResult] = await Promise.all([
    prisma.stallFeedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.stallFeedback.count({ where }),
    // Overall average (handles variable-length points arrays)
    prisma.$queryRaw`
      SELECT COALESCE(
        AVG(
          (SELECT AVG(val::float)
           FROM jsonb_array_elements_text(points::jsonb) AS val)
        ), 0
      )::float AS "overallAvg"
      FROM "stall_feedback"
      WHERE "stall_id" = ${stallId} AND "event_id" = ${event.id}
    `,
  ]);

  const overallAvg = avgResult[0]?.overallAvg ?? 0;

  return {
    feedback: items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    summary: { totalFeedback: total, overallAvg: Number(overallAvg.toFixed(2)) },
  };
};

module.exports = {
  submitEventFeedback,
  getEventFeedbackFormInfo,
  getEventFeedback,
  getStallFeedbackFormInfo,
  submitStallFeedback,
  getStallFeedback,
  getStallOwnerFeedback,
};
