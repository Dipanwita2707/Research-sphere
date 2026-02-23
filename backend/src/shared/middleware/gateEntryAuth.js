/**
 * Gate Entry Permission Middleware
 * Fine-grained permission checks for Gate Entry module
 */

const prisma = require('../config/database');
const {
  GATE_ENTRY_PERMISSIONS,
  hasGateEntryPermission,
  canCancelPass: checkCanCancelPass,
  canExtendPass: checkCanExtendPass
} = require('../constants/gateEntryPermissions');

/**
 * Check if user can create gate passes
 * All roles (admin, staff, faculty, student) can create
 */
const canCreatePass = async (req, res, next) => {
  try {
    const user = req.user;
    
    if (!user || !user.role) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (hasGateEntryPermission(user.role, GATE_ENTRY_PERMISSIONS.CREATE)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'You do not have permission to create gate passes'
    });
  } catch (error) {
    console.error('canCreatePass middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Permission check failed'
    });
  }
};

/**
 * Check if user can verify passes (check-in/check-out)
 * Only Admin and Guard (staff) allowed
 */
const canVerifyPass = async (req, res, next) => {
  try {
    const user = req.user;
    
    if (!user || !user.role) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (hasGateEntryPermission(user.role, GATE_ENTRY_PERMISSIONS.VERIFY)) {
      return next();
    }

    const role = user.role.toLowerCase();
    const isStudent = role === 'student';
    const isFaculty = role === 'faculty';

    return res.status(403).json({
      success: false,
      message: isStudent 
        ? 'Students can only create passes, not verify them'
        : isFaculty 
        ? 'Faculty can only create passes for visitors, not verify them'
        : 'Only Admin and Security Guards can verify passes'
    });
  } catch (error) {
    console.error('canVerifyPass middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Permission check failed'
    });
  }
};

/**
 * Check if user can view analytics dashboard
 * Only Admin allowed
 */
const canViewAnalytics = async (req, res, next) => {
  try {
    const user = req.user;
    
    if (!user || !user.role) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (hasGateEntryPermission(user.role, GATE_ENTRY_PERMISSIONS.ANALYTICS)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Only administrators can view analytics'
    });
  } catch (error) {
    console.error('canViewAnalytics middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Permission check failed'
    });
  }
};

/**
 * Check if user can cancel a specific pass (context-dependent)
 * Before check-in: Only creator or admin
 * After check-in: Creator, admin, or guard
 */
const canCancelPass = async (req, res, next) => {
  try {
    const user = req.user;
    const passId = req.params.passId;
    
    if (!user || !user.role) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!passId) {
      return res.status(400).json({
        success: false,
        message: 'Pass ID is required'
      });
    }

    // Fetch the pass to check status and creator
    const pass = await prisma.gate_pass.findUnique({
      where: { pass_id: passId },
      select: {
        id: true,
        pass_id: true,
        created_by_id: true,
        pass_status: true,
        status: true
      }
    });

    if (!pass) {
      return res.status(404).json({
        success: false,
        message: 'Pass not found'
      });
    }

    // Check if already cancelled
    if (pass.status === 'cancelled' || pass.pass_status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Pass is already cancelled'
      });
    }

    // Context-dependent permission check
    if (checkCanCancelPass(user, pass)) {
      // Attach pass to request for controller use
      req.gatePass = pass;
      return next();
    }

    // Determine why permission denied
    const role = user.role.toLowerCase();
    const isCreator = pass.created_by_id === user.id;
    const isCheckedIn = pass.pass_status === 'checked_in';
    
    if (!isCheckedIn && role === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Guards can only cancel passes after visitor check-in'
      });
    }

    if (!isCreator && !['admin', 'superadmin'].includes(role) && role !== 'staff') {
      return res.status(403).json({
        success: false,
        message: 'You can only cancel passes created by you'
      });
    }

    return res.status(403).json({
      success: false,
      message: 'You do not have permission to cancel this pass'
    });
  } catch (error) {
    console.error('canCancelPass middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Permission check failed'
    });
  }
};

/**
 * Check if user can extend a pass
 * Only creator or admin allowed
 */
const canExtendPass = async (req, res, next) => {
  try {
    const user = req.user;
    const passId = req.params.passId;
    
    if (!user || !user.role) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!passId) {
      return res.status(400).json({
        success: false,
        message: 'Pass ID is required'
      });
    }

    // Fetch the pass to check creator
    const pass = await prisma.gate_pass.findUnique({
      where: { pass_id: passId },
      select: {
        id: true,
        pass_id: true,
        created_by_id: true,
        pass_status: true,
        status: true,
        visit_end_date: true
      }
    });

    if (!pass) {
      return res.status(404).json({
        success: false,
        message: 'Pass not found'
      });
    }

    // Check if pass can be extended (not cancelled or expired)
    if (pass.status === 'cancelled' || pass.status === 'expired') {
      return res.status(400).json({
        success: false,
        message: `Cannot extend ${pass.status} pass`
      });
    }

    // Permission check
    if (checkCanExtendPass(user, pass)) {
      // Attach pass to request for controller use
      req.gatePass = pass;
      return next();
    }

    const role = user.role.toLowerCase();
    const isCreator = pass.created_by_id === user.id;
    
    if (role === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Guards cannot extend passes. Only pass creator or admin can extend.'
      });
    }

    if (!isCreator) {
      return res.status(403).json({
        success: false,
        message: 'You can only extend passes created by you'
      });
    }

    return res.status(403).json({
      success: false,
      message: 'You do not have permission to extend this pass'
    });
  } catch (error) {
    console.error('canExtendPass middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Permission check failed'
    });
  }
};

/**
 * Helper: Check if user has VIEW_ALL permission
 * Used in controllers to filter data
 */
const hasViewAllPermission = (user) => {
  if (!user || !user.role) return false;
  return hasGateEntryPermission(user.role, GATE_ENTRY_PERMISSIONS.VIEW_ALL);
};

/**
 * Helper: Check if user has VIEW_OWN permission
 */
const hasViewOwnPermission = (user) => {
  if (!user || !user.role) return false;
  return hasGateEntryPermission(user.role, GATE_ENTRY_PERMISSIONS.VIEW_OWN);
};

module.exports = {
  canCreatePass,
  canVerifyPass,
  canViewAnalytics,
  canCancelPass,
  canExtendPass,
  hasViewAllPermission,
  hasViewOwnPermission
};
