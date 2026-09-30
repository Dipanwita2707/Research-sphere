/**
 * @module withTenantContext
 * @description Kept for existing imports; see bindMiddleware in shared/tenancy/tenantContext.js.
 */
const { bindMiddleware } = require('../../../shared/tenancy/tenantContext');

module.exports = { withTenantContext: bindMiddleware };
