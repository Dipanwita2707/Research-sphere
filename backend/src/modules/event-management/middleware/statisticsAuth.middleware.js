/**
 * Event statistics authorization middleware.
 * Strictly allows admin-level users.
 */

const ADMIN_ROLES = new Set(['admin', 'superadmin']);

const requireEventStatisticsAdmin = (req, res, next) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  const roleName = String(
    user?.role?.name || (typeof user?.role === 'string' ? user.role : '') || user?.userType || '',
  ).toLowerCase();
  if (!ADMIN_ROLES.has(roleName)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied - only admins can view event statistics',
    });
  }

  return next();
};

module.exports = {
  requireEventStatisticsAdmin,
};
