/**
 * DSW RBAC (Role-Based Access Control) Middleware
 * Enforces strict authorization for all DSW operations
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { DSWPermissions, ErrorMessages } = require('../constants');

/**
 * Check if user has required permission
 * @param {string} permission - Permission to check
 * @param {Object} user - User object with role
 * @returns {boolean} True if authorized
 */
function hasPermission(permission, user) {
  const allowedRoles = DSWPermissions[permission];
  if (!allowedRoles) return false;
  return allowedRoles.includes(user.role);
}

/**
 * Middleware: Check if user can create club noting
 */
function canCreateClubNoting(req, res, next) {
  const { user } = req;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  if (!hasPermission('CREATE_CLUB_NOTING', user)) {
    return res.status(403).json({
      success: false,
      message: ErrorMessages.UNAUTHORIZED,
      detail: 'Only faculty members can create club creation notings',
    });
  }

  next();
}

/**
 * Middleware: Check if user can view club
 */
function canViewClub(req, res, next) {
  const { user } = req;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  if (!hasPermission('VIEW_CLUB', user)) {
    return res.status(403).json({
      success: false,
      message: ErrorMessages.UNAUTHORIZED,
    });
  }

  next();
}

/**
 * Middleware: Optional authentication - allows both authenticated and public access
 * Used for endpoints that should be accessible to everyone
 */
function optionalAuth(req, res, next) {
  // Just pass through - authentication is optional
  // If auth middleware runs before this, req.user will be populated
  // If not, req.user will be undefined but request continues
  next();
}

/**
 * Middleware: Check if user can manage club members
 * Must be Vice Chairperson or Faculty Facilitator of the club
 */
async function canManageMembers(req, res, next) {
  const { user } = req;
  const { clubId } = req.params;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  // Admins can always manage
  if (user.role === 'admin' || user.role === 'superadmin') {
    return next();
  }

  try {
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: {
        viceChairpersonId: true,
        facultyFacilitatorId: true,
      },
    });

    if (!club) {
      return res.status(404).json({
        success: false,
        message: ErrorMessages.CLUB_NOT_FOUND,
      });
    }

    // Check if user is Vice Chairperson or Faculty Facilitator
    if (club.viceChairpersonId !== user.id && club.facultyFacilitatorId !== user.id) {
      return res.status(403).json({
        success: false,
        message: ErrorMessages.UNAUTHORIZED,
        detail: 'Only Vice Chairperson or Faculty Facilitator can manage members',
      });
    }

    // Store club in request for use in controller
    req.club = club;
    next();
  } catch (error) {
    console.error('Error in canManageMembers middleware:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

/**
 * Middleware: Check if user can request club changes
 * Must be Faculty Facilitator of the club
 */
async function canRequestClubChange(req, res, next) {
  const { user } = req;
  const { clubId } = req.params;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  // Admins can always request changes
  if (user.role === 'admin' || user.role === 'superadmin') {
    return next();
  }

  try {
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: {
        facultyFacilitatorId: true,
      },
    });

    if (!club) {
      return res.status(404).json({
        success: false,
        message: ErrorMessages.CLUB_NOT_FOUND,
      });
    }

    // Check if user is Faculty Facilitator
    if (club.facultyFacilitatorId !== user.id) {
      return res.status(403).json({
        success: false,
        message: ErrorMessages.UNAUTHORIZED,
        detail: 'Only Faculty Facilitator can request club changes',
      });
    }

    req.club = club;
    next();
  } catch (error) {
    console.error('Error in canRequestClubChange middleware:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

/**
 * Middleware: Check if user can view audit logs
 */
function canViewAuditLogs(req, res, next) {
  const { user } = req;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  if (!hasPermission('VIEW_AUDIT_LOGS', user)) {
    return res.status(403).json({
      success: false,
      message: ErrorMessages.UNAUTHORIZED,
      detail: 'Only admins can view audit logs',
    });
  }

  next();
}

/**
 * Middleware: Check if user is DSW admin
 */
function isDSWAdmin(req, res, next) {
  const { user } = req;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: ErrorMessages.UNAUTHORIZED,
      detail: 'DSW admin access required',
    });
  }

  next();
}

/**
 * Check if user has club relationship
 * @param {string} userId - User ID
 * @param {string} clubId - Club ID
 * @returns {Promise<Object>} Relationship info
 */
async function getUserClubRelationship(userId, clubId) {
  const club = await prisma.club.findUnique({
    where: { id: clubId },
    select: {
      viceChairpersonId: true,
      facultyFacilitatorId: true,
      members: {
        where: {
          studentId: userId,
          isActive: true,
        },
      },
    },
  });

  if (!club) {
    return null;
  }

  return {
    isViceChairperson: club.viceChairpersonId === userId,
    isFacultyFacilitator: club.facultyFacilitatorId === userId,
    isMember: club.members.length > 0,
    canManageMembers:
      club.viceChairpersonId === userId || club.facultyFacilitatorId === userId,
  };
}

module.exports = {
  hasPermission,
  canCreateClubNoting,
  canViewClub,
  optionalAuth,
  canManageMembers,
  canRequestClubChange,
  canViewAuditLogs,
  isDSWAdmin,
  getUserClubRelationship,
};
