/**
 * Profile Photo Upload Middleware
 * Checks if user has permission to upload profile photo
 */
const { getUserPermission } = require('../../chat/services/userPermission.service');

/**
 * Check if user has permission to upload profile photo
 * Uses the new user-level permission system
 */
const checkProfilePhotoPermission = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // Admin and superadmin always have permission
    if (userRole === 'admin' || userRole === 'superadmin') {
      return next();
    }

    // Check user's individual permission
    const userPerm = await getUserPermission(userId);

    // If no permission record exists, allow by default (backwards compatible)
    if (!userPerm) {
      return next();
    }

    // Check if user has the canUploadProfilePhoto permission
    if (userPerm.canUploadProfilePhoto === false) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to upload a profile photo. Contact your administrator.',
      });
    }

    next();
  } catch (error) {
    console.error('Profile photo permission check error:', error);
    // On error, allow upload (fail-safe)
    next();
  }
};

module.exports = {
  checkProfilePhotoPermission,
};
