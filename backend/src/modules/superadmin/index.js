/**
 * Superadmin Module
 * Handles SaaS level administration, tenant provisioning, tiers, billing aggregates, and global audit logs.
 * Also exports the public license verification route (mounted separately without auth).
 */
const superadminRoutes = require('./routes/superadmin.routes');
const licensePublicRoutes = require('./routes/license.routes');

module.exports = superadminRoutes;
module.exports.licensePublicRoutes = licensePublicRoutes;
