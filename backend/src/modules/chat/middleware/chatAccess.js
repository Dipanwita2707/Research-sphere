/**
 * Chat Access Middleware
 * Controls access to chat features based on user-level permissions
 * 
 * Two middleware functions:
 * 1. requireChatAccess - Checks if user is in the authorized list and has chat enabled
 * 2. requireUserPermission - Checks specific user-level permissions (e.g., canCreateGroup)
 */
const { hasUserChatAccess, getUserPermission } = require('../services/userPermission.service');

/**
 * Middleware to check if user has chat access
 * If no users have been added to the permission system yet, all users are allowed (backwards compatible)
 */
const requireChatAccess = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // Superadmin and admin always have access
    if (userRole === 'superadmin' || userRole === 'admin') {
      return next();
    }

    const hasAccess = await hasUserChatAccess(userId);
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to the chat application. Please contact your administrator.',
        code: 'CHAT_ACCESS_DENIED',
      });
    }

    next();
  } catch (error) {
    console.error('Chat access check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify chat access',
    });
  }
};

/**
 * Middleware factory to check specific user-level permissions
 * @param {string} permissionKey - The permission to check (e.g., 'canCreateGroup', 'canPrivateMessage')
 */
const requireUserPermission = (permissionKey) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;

      // Superadmin and admin bypass permission checks
      if (userRole === 'superadmin' || userRole === 'admin') {
        return next();
      }

      const perm = await getUserPermission(userId);

      // If no permission record exists, allow (backwards compatible mode)
      if (!perm) {
        return next();
      }

      if (perm[permissionKey] === false) {
        return res.status(403).json({
          success: false,
          message: `You do not have permission: ${permissionKey}`,
          code: 'PERMISSION_DENIED',
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify permission',
      });
    }
  };
};

module.exports = {
  requireChatAccess,
  requireUserPermission,
};
