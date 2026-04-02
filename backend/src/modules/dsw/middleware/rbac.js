/**
 * DSW RBAC (Role-Based Access Control) Middleware
 * Uses centralized permission system from permissions.config.js
 *
 * MIGRATED: Now uses centralized permission checking instead of hardcoded role arrays
 * - Permission checks use getDefaultPermissions() for inherent rights
 * - Explicit permissions checked via centralDeptPermissions
 * - Context-aware checks (club ownership) are preserved as secondary validation
 */

const prisma = require("../../../shared/config/database");
const { ErrorMessages } = require("../constants");
const {
  checkPermission,
  checkAnyPermission,
  requireDSWPermission,
} = require("../../../shared/middleware/auth");
const {
  getDefaultPermissions,
} = require("../../../shared/config/permissions.config");

/**
 * Check if user has required DSW permission (using centralized system)
 * @param {string} permissionKey - Permission key from permissions.config.js
 * @param {Object} user - User object with role and permissions
 * @returns {boolean} True if authorized
 */
function hasPermission(permissionKey, user) {
  if (!user) return false;

  // Check 1: Default permissions based on role
  const defaultPerms = getDefaultPermissions(user.role);
  if (defaultPerms[permissionKey] === true) {
    return true;
  }

  // Check 2: Explicit permissions from centralDeptPermissions
  const hasExplicitPermission = user.centralDeptPermissions?.some(
    (deptPerm) =>
      deptPerm.permissions && deptPerm.permissions[permissionKey] === true,
  );

  return hasExplicitPermission;
}

/**
 * Middleware: Check if user can create club noting
 * Uses centralized permission: dsw_create_club_noting
 */
function canCreateClubNoting(req, res, next) {
  const { user } = req;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (!hasPermission("dsw_create_club_noting", user)) {
    return res.status(403).json({
      success: false,
      message: ErrorMessages.UNAUTHORIZED,
      detail:
        "You need dsw_create_club_noting permission to create club notings",
      requiredPermission: "dsw_create_club_noting",
    });
  }

  next();
}

/**
 * Middleware: Check if user can view club
 * Uses centralized permission: dsw_view_club
 */
function canViewClub(req, res, next) {
  const { user } = req;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (!hasPermission("dsw_view_club", user)) {
    return res.status(403).json({
      success: false,
      message: ErrorMessages.UNAUTHORIZED,
      requiredPermission: "dsw_view_club",
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
 * Uses centralized permission: dsw_manage_members
 *
 * Two-layer authorization:
 * 1. Permission check (admin, superadmin, or explicit dsw_manage_members)
 * 2. Context check (must be Chairperson or Faculty Facilitator of THIS club)
 */
async function canManageMembers(req, res, next) {
  const { user } = req;
  const { clubId } = req.params;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  // Layer 1: Check if user has dsw_manage_members permission (admins get this by default)
  if (hasPermission("dsw_manage_members", user)) {
    // Admin/superadmin with permission can manage any club
    if (user.role === "admin" || user.role === "superadmin") {
      return next();
    }
  }

  // Layer 2: Context check - must be Chairperson or Faculty Facilitator of THIS club
  try {
    const club = await prisma.club.findUnique({
      where: { id: clubId },
      select: {
        chairpersonId: true,
        facultyFacilitatorId: true,
      },
    });

    if (!club) {
      return res.status(404).json({
        success: false,
        message: ErrorMessages.CLUB_NOT_FOUND,
      });
    }

    // Check if user is Chairperson or Faculty Facilitator of THIS club
    if (
      club.chairpersonId === user.id ||
      club.facultyFacilitatorId === user.id
    ) {
      req.club = club;
      return next();
    }

    return res.status(403).json({
      success: false,
      message: ErrorMessages.UNAUTHORIZED,
      detail:
        "Only Chairperson or Faculty Facilitator of this club can manage members",
      requiredPermission: "dsw_manage_members (or club relationship)",
    });
  } catch (error) {
    console.error("Error in canManageMembers middleware:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

/**
 * Middleware: Check if user can request club changes
 * Uses centralized permission: dsw_request_club_change
 *
 * Two-layer authorization:
 * 1. Permission check (admin, superadmin, or explicit permission)
 * 2. Context check (must be Faculty Facilitator of THIS club)
 */
async function canRequestClubChange(req, res, next) {
  const { user } = req;
  const { clubId } = req.params;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  // Admin/superadmin can always request changes
  if (user.role === "admin" || user.role === "superadmin") {
    return next();
  }

  // Check permission first
  if (!hasPermission("dsw_request_club_change", user)) {
    return res.status(403).json({
      success: false,
      message: ErrorMessages.UNAUTHORIZED,
      detail: "You need dsw_request_club_change permission",
      requiredPermission: "dsw_request_club_change",
    });
  }

  // Context check - must be Faculty Facilitator of THIS club
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
        detail: "Only Faculty Facilitator of this club can request changes",
      });
    }

    req.club = club;
    next();
  } catch (error) {
    console.error("Error in canRequestClubChange middleware:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

/**
 * Middleware: Check if user can view audit logs
 * Uses centralized permission: dsw_view_audit_logs
 */
function canViewAuditLogs(req, res, next) {
  const { user } = req;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (!hasPermission("dsw_view_audit_logs", user)) {
    return res.status(403).json({
      success: false,
      message: ErrorMessages.UNAUTHORIZED,
      detail: "dsw_view_audit_logs permission required",
      requiredPermission: "dsw_view_audit_logs",
    });
  }

  next();
}

/**
 * Middleware: Check if user can approve clubs
 * Uses centralized permission: dsw_approve_club
 */
function canApproveClub(req, res, next) {
  const { user } = req;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (!hasPermission("dsw_approve_club", user)) {
    return res.status(403).json({
      success: false,
      message: ErrorMessages.UNAUTHORIZED,
      detail: "dsw_approve_club permission required",
      requiredPermission: "dsw_approve_club",
    });
  }

  next();
}

/**
 * Middleware: Check if user can view all clubs
 * Uses centralized permission: dsw_view_all_clubs
 */
function canViewAllClubs(req, res, next) {
  const { user } = req;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (!hasPermission("dsw_view_all_clubs", user)) {
    return res.status(403).json({
      success: false,
      message: ErrorMessages.UNAUTHORIZED,
      detail: "dsw_view_all_clubs permission required",
      requiredPermission: "dsw_view_all_clubs",
    });
  }

  next();
}

/**
 * Middleware: Check if user is DSW admin (has dsw_approve_club permission)
 */
function isDSWAdmin(req, res, next) {
  const { user } = req;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  // Check for admin-level DSW permissions
  const hasAdminPerms =
    hasPermission("dsw_approve_club", user) ||
    hasPermission("dsw_approve_club_change", user);

  if (!hasAdminPerms) {
    return res.status(403).json({
      success: false,
      message: ErrorMessages.UNAUTHORIZED,
      detail:
        "DSW admin permissions required (dsw_approve_club or dsw_approve_club_change)",
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
      chairpersonId: true,
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
    isChairperson: club.chairpersonId === userId,
    isFacultyFacilitator: club.facultyFacilitatorId === userId,
    isMember: club.members.length > 0,
    canManageMembers:
      club.chairpersonId === userId || club.facultyFacilitatorId === userId,
  };
}

module.exports = {
  hasPermission,
  canCreateClubNoting,
  canViewClub,
  canViewAllClubs,
  canApproveClub,
  optionalAuth,
  canManageMembers,
  canRequestClubChange,
  canViewAuditLogs,
  isDSWAdmin,
  getUserClubRelationship,
};
