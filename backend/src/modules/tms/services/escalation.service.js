/**
 * TMS Escalation Service
 * Handles the escalation chain logic:
 *   Sub-Category → Category → Master Category → Registrar/Dean → VC
 * 
 * Also handles auto-escalation for the 48-hour rule.
 */
const prisma = require('../../../shared/config/database');
const {
  TICKET_STATUS,
  ESCALATION_LEVEL,
  TIMELINE_ACTION,
  LIMITS,
  ERROR_MESSAGES,
} = require('../constants/tms.constants');
const { userBrief, ticketInclude, getTicketById } = require('./ticket.service');
const { getHandlerForRole } = require('./category.service');

/**
 * Determine the next escalation level based on current level and ticket's academic flag
 */
function getNextEscalationLevel(currentLevel, isAcademic) {
  switch (currentLevel) {
    case ESCALATION_LEVEL.SUB_CATEGORY:
      return ESCALATION_LEVEL.CATEGORY;
    case ESCALATION_LEVEL.CATEGORY:
      return ESCALATION_LEVEL.MASTER_CATEGORY;
    case ESCALATION_LEVEL.MASTER_CATEGORY:
      return isAcademic ? ESCALATION_LEVEL.DEAN_ACADEMICS : ESCALATION_LEVEL.REGISTRAR;
    case ESCALATION_LEVEL.REGISTRAR:
    case ESCALATION_LEVEL.DEAN_ACADEMICS:
      return ESCALATION_LEVEL.VICE_CHANCELLOR;
    case ESCALATION_LEVEL.VICE_CHANCELLOR:
      return null; // Cannot escalate further
    default:
      return null;
  }
}

/**
 * Get the employee (assignee) ID for a given escalation level
 */
async function getEmployeeForLevel(ticket, level) {
  switch (level) {
    case ESCALATION_LEVEL.SUB_CATEGORY: {
      const sub = await prisma.tmsSubCategory.findUnique({
        where: { id: ticket.subCategoryId },
        select: { employeeId: true },
      });
      return sub?.employeeId || null;
    }
    case ESCALATION_LEVEL.CATEGORY: {
      const cat = await prisma.tmsCategory.findUnique({
        where: { id: ticket.categoryId },
        select: { employeeId: true },
      });
      return cat?.employeeId || null;
    }
    case ESCALATION_LEVEL.MASTER_CATEGORY: {
      const master = await prisma.tmsMasterCategory.findUnique({
        where: { id: ticket.masterCategoryId },
        select: { employeeId: true },
      });
      return master?.employeeId || null;
    }
    case ESCALATION_LEVEL.REGISTRAR: {
      return getHandlerForRole('registrar');
    }
    case ESCALATION_LEVEL.DEAN_ACADEMICS: {
      return getHandlerForRole('dean_academics');
    }
    case ESCALATION_LEVEL.VICE_CHANCELLOR: {
      return getHandlerForRole('vice_chancellor');
    }
    default:
      return null;
  }
}

/**
 * Escalate a ticket to the next level in the hierarchy
 */
async function escalateTicket(ticketId, userId, remarks, isAutomatic = false) {
  const ticket = await prisma.tmsTicket.findUnique({
    where: { id: ticketId },
    include: {
      masterCategory: { select: { isAcademic: true } },
    },
  });

  if (!ticket) throw new Error(ERROR_MESSAGES.TICKET_NOT_FOUND);
  if (ticket.status === TICKET_STATUS.CLOSED) throw new Error(ERROR_MESSAGES.ALREADY_CLOSED);
  if (ticket.status === TICKET_STATUS.RESOLVED) throw new Error(ERROR_MESSAGES.ALREADY_RESOLVED);

  const nextLevel = getNextEscalationLevel(ticket.currentLevel, ticket.masterCategory.isAcademic);
  if (!nextLevel) {
    // Already at VC level — mark accordingly
    if (ticket.currentLevel === ESCALATION_LEVEL.VICE_CHANCELLOR) {
      await prisma.$transaction(async (tx) => {
        await tx.tmsTimeline.create({
          data: {
            ticketId,
            action: TIMELINE_ACTION.REMARKED,
            remarks: 'Maximum escalation level reached. Student is advised to visit the Vice Chancellor\'s office for further assistance.',
            performedById: userId,
            isAutomatic,
            metadata: { finalEscalation: true },
          },
        });
      });
      return getTicketById(ticketId);
    }
    throw new Error(ERROR_MESSAGES.CANNOT_ESCALATE);
  }

  const nextAssigneeId = await getEmployeeForLevel(ticket, nextLevel);

  await prisma.$transaction(async (tx) => {
    await tx.tmsTicket.update({
      where: { id: ticketId },
      data: {
        currentLevel: nextLevel,
        status: TICKET_STATUS.ESCALATED,
        assignedToId: nextAssigneeId,
        lastEscalatedAt: new Date(),
        escalationDeadline: nextAssigneeId
          ? new Date(Date.now() + LIMITS.AUTO_ESCALATION_HOURS * 60 * 60 * 1000)
          : null,
      },
    });

    await tx.tmsTimeline.create({
      data: {
        ticketId,
        action: isAutomatic ? TIMELINE_ACTION.AUTO_ESCALATED : TIMELINE_ACTION.ESCALATED,
        fromLevel: ticket.currentLevel,
        toLevel: nextLevel,
        remarks: remarks || `${isAutomatic ? 'Auto-escalated' : 'Escalated'} from ${ticket.currentLevel} to ${nextLevel}`,
        performedById: userId,
        isAutomatic,
        metadata: {
          previousAssignee: ticket.assignedToId,
          newAssignee: nextAssigneeId,
        },
      },
    });
  });

  return getTicketById(ticketId);
}

/**
 * Process auto-escalation for all tickets past their deadline
 * Called by a scheduled cron job
 */
async function processAutoEscalations() {
  const now = new Date();

  const overdueTickets = await prisma.tmsTicket.findMany({
    where: {
      escalationDeadline: { lte: now },
      status: { in: [TICKET_STATUS.OPEN, TICKET_STATUS.IN_PROGRESS, TICKET_STATUS.ESCALATED] },
    },
    include: {
      masterCategory: { select: { isAcademic: true } },
    },
  });

  const results = [];

  for (const ticket of overdueTickets) {
    try {
      const nextLevel = getNextEscalationLevel(ticket.currentLevel, ticket.masterCategory.isAcademic);

      if (!nextLevel) {
        // At VC level, mark as final
        await prisma.$transaction(async (tx) => {
          await tx.tmsTicket.update({
            where: { id: ticket.id },
            data: { escalationDeadline: null },
          });
          await tx.tmsTimeline.create({
            data: {
              ticketId: ticket.id,
              action: TIMELINE_ACTION.AUTO_ESCALATED,
              remarks: 'No action taken within 48 hours at final level. Student is advised to visit the Vice Chancellor\'s office for further assistance.',
              isAutomatic: true,
              metadata: { finalEscalation: true, currentLevel: ticket.currentLevel },
            },
          });
        });
        results.push({ ticketId: ticket.id, action: 'final_notice' });
        continue;
      }

      const nextAssigneeId = await getEmployeeForLevel(ticket, nextLevel);

      await prisma.$transaction(async (tx) => {
        await tx.tmsTicket.update({
          where: { id: ticket.id },
          data: {
            currentLevel: nextLevel,
            status: TICKET_STATUS.ESCALATED,
            assignedToId: nextAssigneeId,
            lastEscalatedAt: now,
            escalationDeadline: nextAssigneeId
              ? new Date(now.getTime() + LIMITS.AUTO_ESCALATION_HOURS * 60 * 60 * 1000)
              : null,
          },
        });

        await tx.tmsTimeline.create({
          data: {
            ticketId: ticket.id,
            action: TIMELINE_ACTION.AUTO_ESCALATED,
            fromLevel: ticket.currentLevel,
            toLevel: nextLevel,
            remarks: `Auto-escalated: No action taken within ${LIMITS.AUTO_ESCALATION_HOURS} hours. Escalated from ${ticket.currentLevel} to ${nextLevel}.`,
            isAutomatic: true,
            metadata: {
              previousAssignee: ticket.assignedToId,
              newAssignee: nextAssigneeId,
              deadline: ticket.escalationDeadline,
            },
          },
        });
      });

      results.push({ ticketId: ticket.id, action: 'escalated', from: ticket.currentLevel, to: nextLevel });
    } catch (error) {
      console.error(`Auto-escalation failed for ticket ${ticket.id}:`, error.message);
      results.push({ ticketId: ticket.id, action: 'error', error: error.message });
    }
  }

  return results;
}

module.exports = {
  getNextEscalationLevel,
  getEmployeeForLevel,
  escalateTicket,
  processAutoEscalations,
};
