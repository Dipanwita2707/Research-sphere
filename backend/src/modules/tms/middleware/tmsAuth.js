/**
 * TMS Authorization Middleware
 * Ticket ownership and assignment verification
 */
const prisma = require('../../../shared/config/database');
const { ForbiddenError } = require('../../../shared/utils/AppError');
const { NotFoundError } = require('../../../shared/utils/AppError');

/**
 * Middleware: Verify the ticket exists and belongs to the current user (student creator)
 * Attaches ticket to req.ticket
 */
const requireTicketCreator = async (req, res, next) => {
  const userId = req.user.id;
  const { id } = req.params;

  const ticket = await prisma.tmsTicket.findUnique({
    where: { id },
    select: { id: true, createdById: true, status: true, requestId: true },
  });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  if (ticket.createdById !== userId) {
    throw new ForbiddenError('You can only access your own tickets');
  }

  req.ticket = ticket;
  next();
};

/**
 * Middleware: Verify the ticket exists and is assigned to the current user (employee)
 * Attaches ticket to req.ticket
 */
const requireTicketAssignee = async (req, res, next) => {
  const userId = req.user.id;
  const { id } = req.params;

  const ticket = await prisma.tmsTicket.findUnique({
    where: { id },
    select: {
      id: true,
      createdById: true,
      assignedToId: true,
      status: true,
      currentLevel: true,
      requestId: true,
    },
  });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  if (ticket.assignedToId !== userId) {
    throw new ForbiddenError('This ticket is not assigned to you');
  }

  req.ticket = ticket;
  next();
};

/**
 * Middleware: Verify user can view the ticket (creator or assigned employee or admin)
 * More permissive than requireTicketCreator/requireTicketAssignee
 * Attaches ticket to req.ticket
 */
const requireTicketAccess = async (req, res, next) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const { id } = req.params;

  const ticket = await prisma.tmsTicket.findUnique({
    where: { id },
    select: {
      id: true,
      createdById: true,
      assignedToId: true,
      status: true,
      currentLevel: true,
      requestId: true,
    },
  });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  // Allow access if: creator, assigned employee, or admin/superadmin
  const isCreator = ticket.createdById === userId;
  const isAssignee = ticket.assignedToId === userId;
  const isAdmin = ['admin', 'superadmin'].includes(userRole);

  if (!isCreator && !isAssignee && !isAdmin) {
    throw new ForbiddenError('You do not have access to this ticket');
  }

  req.ticket = ticket;
  next();
};

module.exports = {
  requireTicketCreator,
  requireTicketAssignee,
  requireTicketAccess,
};
