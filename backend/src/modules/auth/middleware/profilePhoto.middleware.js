/**
 * Profile Photo Upload Middleware
 * Checks if user has permission to upload profile photo
 */

/**
 * Check if user has permission to upload profile photo
 * Stubbed to allow by default as Chat module is disabled.
 */
const checkProfilePhotoPermission = async (req, res, next) => {
  next();
};

module.exports = {
  checkProfilePhotoPermission,
};
