/**
 * @module dpdp/controllers/admin
 * @description DPO / admin endpoints (requireDpdpAdmin). Tenant scoping comes from
 * protect + the Prisma tenant extension; a superadmin without X-University-Id works
 * on platform-wide data (platform notices/policies, all incidents and requests).
 */
const asyncHandler = require('../../../shared/utils/asyncHandler');
const rightsService = require('../services/rights.service');
const breachService = require('../services/breach.service');
const retentionService = require('../services/retention.service');
const adminService = require('../services/admin.service');

const ok = (res, data, message, status = 200) => res.status(status).json({ success: true, data, ...(message ? { message } : {}) });
const tenantOf = (req) => req.tenantId || null;

exports.overview = asyncHandler(async (req, res) => ok(res, await adminService.getOverview(tenantOf(req))));

// requests
exports.listRequests = asyncHandler(async (req, res) => ok(res, await rightsService.listRequests(req.query)));
exports.updateRequest = asyncHandler(async (req, res) => ok(res, await rightsService.updateRequest({ req, id: req.params.id, ...req.body })));
exports.fulfilRequest = asyncHandler(async (req, res) => ok(
  res,
  await rightsService.fulfilRequest({ req, id: req.params.id, response: req.body.response, force: req.body.force }),
  'Request fulfilled',
));

// notices
exports.listNotices = asyncHandler(async (req, res) => ok(res, await adminService.listNotices(tenantOf(req))));
exports.createNotice = asyncHandler(async (req, res) => ok(res, await adminService.createNotice({ req, tenantId: tenantOf(req), ...req.body }), 'Notice created (inactive)', 201));
exports.activateNotice = asyncHandler(async (req, res) => ok(
  res,
  await adminService.activateNotice({ req, tenantId: tenantOf(req), id: req.params.id }),
  'Notice activated. Users will be asked to review it and give consent again.',
));

// breaches
exports.listBreaches = asyncHandler(async (req, res) => ok(res, await breachService.listBreaches({ isSuperadmin: !!req.isSuperadmin })));
exports.createBreach = asyncHandler(async (req, res) => ok(res, await breachService.createBreach({ req, ...req.body }), 'Incident recorded. The Data Protection Board must be informed within 72 hours.', 201));
exports.updateBreach = asyncHandler(async (req, res) => ok(res, await breachService.updateBreach({ req, id: req.params.id, ...req.body })));
exports.notifyPrincipals = asyncHandler(async (req, res) => {
  const out = await breachService.notifyPrincipals({ req, id: req.params.id, message: req.body.message });
  return ok(res, out, `Notified ${out.notified} of ${out.total} users`);
});

// retention
exports.getRetentionPolicies = asyncHandler(async (req, res) => ok(res, await retentionService.getEffectivePolicies(tenantOf(req))));
exports.putRetentionPolicies = asyncHandler(async (req, res) => ok(
  res,
  await retentionService.savePolicies({ req, tenantId: tenantOf(req), policies: req.body.policies }),
  'Retention policies saved',
));

// contact
exports.putContact = asyncHandler(async (req, res) => ok(res, await adminService.updateContact({ req, tenantId: tenantOf(req), ...req.body }), 'Contact details saved'));
