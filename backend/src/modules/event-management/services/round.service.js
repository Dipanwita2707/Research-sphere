/**
 * Round Service
 * Service for managing event rounds/phases
 */

const prisma = require('../../../shared/config/database');
const { ValidationError, NotFoundError, ForbiddenError } = require('../../../shared/utils/AppError');
const { invalidateEventCaches } = require('./event.service');

const verifyEventOwnership = async (eventId, userId) => {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, createdById: true, startDate: true, endDate: true },
  });
  if (!event) throw new NotFoundError('Event');
  if (event.createdById !== userId) throw new ForbiddenError('Only the event creator can manage rounds');
  return event;
};

const validateRoundTimes = (startTime, endTime, eventStartDate, eventEndDate, existingRounds = [], excludeId = null) => {
  const rStart = new Date(startTime);
  const rEnd = new Date(endTime);
  const eStart = new Date(eventStartDate);
  const eEnd = new Date(eventEndDate);

  if (rStart >= rEnd) {
    throw new ValidationError('Round start time must be before end time');
  }
  if (rStart < eStart) {
    throw new ValidationError('Round cannot start before the event start date');
  }
  if (rEnd > eEnd) {
    throw new ValidationError('Round cannot end after the event end date');
  }

  // Overlap is allowed — events may have parallel rounds (e.g. workshops + competitions)
};

const getRounds = async (eventId) => {
  return prisma.eventRound.findMany({
    where: { eventId },
    orderBy: [{ sortOrder: 'asc' }, { startTime: 'asc' }],
  });
};

const getRoundById = async (roundId) => {
  const round = await prisma.eventRound.findUnique({ where: { id: roundId } });
  if (!round) throw new NotFoundError('Round');
  return round;
};

const createRound = async (eventId, data, userId) => {
  const event = await verifyEventOwnership(eventId, userId);
  const existingRounds = await getRounds(eventId);

  validateRoundTimes(data.startTime, data.endTime, event.startDate, event.endDate, existingRounds);

  const maxOrder = existingRounds.length > 0
    ? Math.max(...existingRounds.map(r => r.sortOrder))
    : -1;

  const round = await prisma.eventRound.create({
    data: {
      eventId,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      roundType: data.roundType || 'general',
      isDefault: false,
      sortOrder: maxOrder + 1,
    },
  });
  await invalidateEventCaches(eventId);
  return round;
};

const updateRound = async (roundId, data, userId) => {
  const round = await getRoundById(roundId);
  const event = await verifyEventOwnership(round.eventId, userId);

  const existingRounds = await getRounds(round.eventId);
  const startTime = data.startTime || round.startTime;
  const endTime = data.endTime || round.endTime;
  validateRoundTimes(startTime, endTime, event.startDate, event.endDate, existingRounds, roundId);

  const updated = await prisma.eventRound.update({
    where: { id: roundId },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.description !== undefined && { description: data.description?.trim() || null }),
      ...(data.startTime && { startTime: new Date(data.startTime) }),
      ...(data.endTime && { endTime: new Date(data.endTime) }),
      ...(data.roundType !== undefined && { roundType: data.roundType }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
    },
  });
  await invalidateEventCaches(round.eventId);
  return updated;
};

const deleteRound = async (roundId, userId) => {
  const round = await getRoundById(roundId);
  await verifyEventOwnership(round.eventId, userId);
  await prisma.eventRound.delete({ where: { id: roundId } });
  await invalidateEventCaches(round.eventId);
};

const reorderRounds = async (eventId, roundOrders, userId) => {
  await verifyEventOwnership(eventId, userId);

  await prisma.$transaction(
    roundOrders.map(({ id, sortOrder }) =>
      prisma.eventRound.update({ where: { id }, data: { sortOrder } })
    )
  );

  return getRounds(eventId);
};

module.exports = {
  getRounds,
  getRoundById,
  createRound,
  updateRound,
  deleteRound,
  reorderRounds,
};
