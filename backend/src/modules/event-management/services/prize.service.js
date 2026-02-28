/**
 * Prize Service
 * Service for managing event prizes
 */

const prisma = require('../../../shared/config/database');
const { ValidationError } = require('../../../shared/utils/AppError');

/**
 * Get all prizes for an event
 */
const getPrizes = async (eventId) => {
  return prisma.eventPrize.findMany({
    where: { eventId },
    orderBy: [{ sortOrder: 'asc' }, { position: 'asc' }],
  });
};

/**
 * Get a single prize by ID
 */
const getPrizeById = async (prizeId) => {
  return prisma.eventPrize.findUnique({
    where: { id: prizeId },
    include: {
      Event: {
        select: { id: true, eventId: true, name: true },
      },
    },
  });
};

/**
 * Create a new prize
 */
const createPrize = async (eventId, prizeData, userId) => {
  // Verify event exists
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new Error('Event not found');
  }

  // Check if user is the event creator
  if (event.createdById !== userId) {
    throw new Error('Only the event creator can manage prizes');
  }

  // Prizes are fixed when event comes from noting
  if (event.notingId) {
    throw new ValidationError('Prizes were set during noting approval and cannot be changed.');
  }

  // Get max sort order
  const maxOrder = await prisma.eventPrize.aggregate({
    where: { eventId },
    _max: { sortOrder: true },
  });
  const nextOrder = (maxOrder._max.sortOrder || 0) + 1;

  return prisma.eventPrize.create({
    data: {
      eventId,
      position: prizeData.position || nextOrder,
      rank: prizeData.rank,
      title: prizeData.title,
      description: prizeData.description || null,
      prizeType: prizeData.prizeType || 'certificate',
      prizeAmount: prizeData.prizeAmount || null,
      additionalPerks: prizeData.additionalPerks || null,
      sortOrder: prizeData.sortOrder ?? nextOrder,
      isActive: prizeData.isActive !== false,
    },
  });
};

/**
 * Update a prize
 */
const updatePrize = async (prizeId, prizeData, userId) => {
  const prize = await prisma.eventPrize.findUnique({
    where: { id: prizeId },
    include: { Event: { select: { createdById: true, notingId: true } } },
  });

  if (!prize) {
    throw new Error('Prize not found');
  }

  if (prize.Event.createdById !== userId) {
    throw new Error('Only the event creator can manage prizes');
  }

  if (prize.Event.notingId) {
    throw new ValidationError('Prizes were set during noting approval and cannot be changed.');
  }

  return prisma.eventPrize.update({
    where: { id: prizeId },
    data: {
      position: prizeData.position,
      rank: prizeData.rank,
      title: prizeData.title,
      description: prizeData.description,
      prizeType: prizeData.prizeType,
      prizeAmount: prizeData.prizeAmount,
      additionalPerks: prizeData.additionalPerks,
      sortOrder: prizeData.sortOrder,
      isActive: prizeData.isActive,
    },
  });
};

/**
 * Delete a prize
 */
const deletePrize = async (prizeId, userId) => {
  const prize = await prisma.eventPrize.findUnique({
    where: { id: prizeId },
    include: { Event: { select: { createdById: true, notingId: true } } },
  });

  if (!prize) {
    throw new Error('Prize not found');
  }

  if (prize.Event.createdById !== userId) {
    throw new Error('Only the event creator can manage prizes');
  }

  if (prize.Event.notingId) {
    throw new ValidationError('Prizes were set during noting approval and cannot be changed.');
  }

  return prisma.eventPrize.delete({
    where: { id: prizeId },
  });
};

/**
 * Reorder prizes
 */
const reorderPrizes = async (eventId, prizeOrders, userId) => {
  // Verify event exists and user is creator
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new Error('Event not found');
  }

  if (event.createdById !== userId) {
    throw new Error('Only the event creator can manage prizes');
  }

  if (event.notingId) {
    throw new ValidationError('Prizes were set during noting approval and cannot be changed.');
  }

  // Update each prize's sort order
  const updates = prizeOrders.map(({ prizeId, sortOrder }) =>
    prisma.eventPrize.update({
      where: { id: prizeId },
      data: { sortOrder },
    })
  );

  await prisma.$transaction(updates);

  return getPrizes(eventId);
};

/**
 * Bulk create/update prizes
 */
const bulkUpsertPrizes = async (eventId, prizes, userId) => {
  // Verify event exists and user is creator
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new Error('Event not found');
  }

  if (event.createdById !== userId) {
    throw new Error('Only the event creator can manage prizes');
  }

  if (event.notingId) {
    throw new ValidationError('Prizes were set during noting approval and cannot be changed.');
  }

  // Get existing prizes
  const existingPrizes = await prisma.eventPrize.findMany({
    where: { eventId },
  });
  const existingIds = existingPrizes.map((p) => p.id);

  const toCreate = [];
  const toUpdate = [];
  const incomingIds = [];

  prizes.forEach((prize, index) => {
    if (prize.id && existingIds.includes(prize.id)) {
      // Update existing
      incomingIds.push(prize.id);
      toUpdate.push({
        where: { id: prize.id },
        data: {
          position: prize.position ?? index + 1,
          rank: prize.rank,
          title: prize.title,
          description: prize.description,
          prizeType: prize.prizeType || 'certificate',
          prizeAmount: prize.prizeAmount,
          additionalPerks: prize.additionalPerks,
          sortOrder: prize.sortOrder ?? index,
          isActive: prize.isActive !== false,
        },
      });
    } else {
      // Create new
      toCreate.push({
        eventId,
        position: prize.position ?? index + 1,
        rank: prize.rank,
        title: prize.title,
        description: prize.description,
        prizeType: prize.prizeType || 'certificate',
        prizeAmount: prize.prizeAmount,
        additionalPerks: prize.additionalPerks,
        sortOrder: prize.sortOrder ?? index,
        isActive: prize.isActive !== false,
      });
    }
  });

  // Determine which prizes to delete (existing but not in incoming)
  const toDelete = existingIds.filter((id) => !incomingIds.includes(id));

  // Execute all operations in a transaction
  await prisma.$transaction([
    // Delete removed prizes
    prisma.eventPrize.deleteMany({
      where: { id: { in: toDelete } },
    }),
    // Create new prizes
    ...toCreate.map((data) => prisma.eventPrize.create({ data })),
    // Update existing prizes
    ...toUpdate.map((update) => prisma.eventPrize.update(update)),
  ]);

  return getPrizes(eventId);
};

/**
 * Toggle prizes enabled for an event
 */
const togglePrizesEnabled = async (eventId, enabled, userId) => {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new Error('Event not found');
  }

  if (event.createdById !== userId) {
    throw new Error('Only the event creator can manage prizes');
  }

  if (event.notingId) {
    throw new ValidationError('Prizes were set during noting approval and cannot be changed.');
  }

  return prisma.event.update({
    where: { id: eventId },
    data: { prizesEnabled: enabled },
  });
};

module.exports = {
  getPrizes,
  getPrizeById,
  createPrize,
  updatePrize,
  deletePrize,
  reorderPrizes,
  bulkUpsertPrizes,
  togglePrizesEnabled,
};
