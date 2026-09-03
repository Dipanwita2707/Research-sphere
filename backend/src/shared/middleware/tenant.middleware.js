/**
 * Tenant Resolution Middleware
 * Resolves the active tenant context (req.tenantId) for every request.
 */
const resolveTenant = async (req, res, next) => {
  try {
    if (!req.user) return next(); // Not logged in, skip

    // Superadmin can switch context via X-University-Id header
    if (req.user.role === 'superadmin') {
      const headerUniversityId = req.headers['x-university-id'];
      req.tenantId = headerUniversityId || null; // null = global dashboard / all tenants
      req.isSuperadmin = true;
      return next();
    }

    // Regular users must have a university associated
    if (!req.user.universityId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: User is not associated with any university/tenant.'
      });
    }

    req.tenantId = req.user.universityId;
    req.isSuperadmin = false;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  resolveTenant
};
