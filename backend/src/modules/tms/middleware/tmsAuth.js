/**
 * TMS Authorization Middleware
 * Ticket ownership and assignment verification
 */
const prisma = require('../../../shared/config/database');
const { ForbiddenError, NotFoundError } = require('../../../shared/utils/AppError');
const { getDefaultPermissions, getPermissionKeyVariants } = require('../../../shared/config/permissions.config');

function hasPermission(user, permissionKey) {
  if (!user || !permissionKey) return false;

  const permissionVariants = getPermissionKeyVariants(permissionKey);
  const defaultPermissions = getDefaultPermissions(user.role);

  if (permissionVariants.some((variant) => defaultPermissions[variant] === true)) {
    return true;
  }

  const hasCentralPermission = user.centralDeptPermissions?.some((deptPerm) =>
    deptPerm.permissions && permissionVariants.some((variant) => deptPerm.permissions[variant] === true)
  );

  if (hasCentralPermission) {
    return true;
  }

  return user.schoolDeptPermissions?.some((deptPerm) =>
    deptPerm.permissions && permissionVariants.some((variant) => deptPerm.permissions[variant] === true)
  ) || false;
}

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
 * Middleware: Verify user can view the ticket.
 * Allows the creator, current assignee, employees who have already acted on the
 * ticket, and users with TMS analytics visibility.
 * Attaches ticket to req.ticket
 */
const requireTicketAccess = async (req, res, next) => {
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
      timeline: {
        where: { performedById: userId },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  // Allow access if: creator, current assignee, prior actor on the ticket,
  // or someone who can review TMS analytics.
  const isCreator = ticket.createdById === userId;
  const isAssignee = ticket.assignedToId === userId;
  const hasActedOnTicket = ticket.timeline.length > 0;
  const hasAnalyticsAccess = hasPermission(req.user, 'tms_view_analytics');

  if (!isCreator && !isAssignee && !hasActedOnTicket && !hasAnalyticsAccess) {
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
