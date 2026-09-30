/**
 * @module dpdp/controllers/dpdp
 * @description Data principal endpoints (any authenticated user) and public endpoints.
 */
const asyncHandler = require('../../../shared/utils/asyncHandler');
const consentService = require('../services/consent.service');
const rightsService = require('../services/rights.service');
const adminService = require('../services/admin.service');
const tenantContext = require('../../../shared/tenancy/tenantContext');

/**
 * Self-service calls always act on the caller's own data in the caller's own tenant, even for a
 * superadmin who is browsing another university with X-University-Id.
 */
const asPrincipal = (req, fn) => (req.user.universityId
  ? tenantContext.runForTenant(req.user.universityId, fn)
  : tenantContext.runAsSystem(fn));

const ok = (res, data, message, status = 200) => res.status(status).json({ success: true, data, ...(message ? { message } : {}) });

// ── consent ──────────────────────────────────────────────────────────────────
exports.getMyConsents = asyncHandler(async (req, res) => ok(res, await asPrincipal(req, () => consentService.getMyConsents(req.user.id))));

exports.giveConsent = asyncHandler(async (req, res) => {
  const { noticeId, decisions, guardian } = req.body;
  const data = await asPrincipal(req, () => consentService.recordConsent({ req, userId: req.user.id, noticeId, decisions, guardian }));
  let message = 'Your choices have been saved.';
  if (data.requiresGuardian && data.guardianPending) {
    message = data.guardianEmailSent === false
      ? 'Saved. We could not send the email to your guardian right now; please try again later or contact your university.'
      : 'Saved. We have emailed your parent/guardian a link to confirm. You can use the app once they confirm.';
  }
  return ok(res, data, message);
});

exports.withdrawConsent = asyncHandler(async (req, res) => {
  const { message, ...data } = await asPrincipal(req, () => consentService.withdrawConsent({ req, userId: req.user.id, purpose: req.params.purpose }));
  return ok(res, data, message);
});

// ── requests ─────────────────────────────────────────────────────────────────
exports.getMyRequests = asyncHandler(async (req, res) => ok(res, await asPrincipal(req, () => rightsService.listMyRequests(req.user.id))));

exports.createRequest = asyncHandler(async (req, res) => {
  const { type, description, details } = req.body;
  const request = await asPrincipal(req, () => rightsService.createRequest({ req, userId: req.user.id, type, description, details }));
  return ok(res, request, `Your request has been received. We will respond by ${new Date(request.dueAt).toDateString()}.`, 201);
});

exports.exportMyData = asyncHandler(async (req, res) => {
  const data = await asPrincipal(req, () => rightsService.exportForUser({ req, userId: req.user.id }));
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="my-personal-data-${stamp}.json"`);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(JSON.stringify(data, null, 2));
});

// ── nominee ──────────────────────────────────────────────────────────────────
exports.getMyNominee = asyncHandler(async (req, res) => ok(res, await asPrincipal(req, () => rightsService.getNominee(req.user.id))));

exports.putMyNominee = asyncHandler(async (req, res) => {
  const { name, email, phone, relation } = req.body;
  return ok(res, await asPrincipal(req, () => rightsService.upsertNominee({ req, userId: req.user.id, name, email, phone, relation })), 'Nominee saved');
});

exports.deleteMyNominee = asyncHandler(async (req, res) => ok(res, await asPrincipal(req, () => rightsService.deleteNominee({ req, userId: req.user.id })), 'Nominee removed'));

// ── contact ──────────────────────────────────────────────────────────────────
exports.getContact = asyncHandler(async (req, res) => {
  const c = await adminService.getContact(req.tenantId || null);
  return ok(res, {
    universityName: c.universityName,
    universitySlug: c.universitySlug,
    dpoName: c.dpoName,
    dpoEmail: c.dpoEmail,
    dpoPhone: c.dpoPhone,
    requireGuardianConsentForMinors: c.requireGuardianConsentForMinors,
  });
});

// ── public ───────────────────────────────────────────────────────────────────
exports.getPublicPrivacy = asyncHandler(async (req, res) => ok(res, await adminService.getPublicPrivacy(req.params.universitySlug)));

exports.getGuardianRequest = asyncHandler(async (req, res) => ok(res, await consentService.getGuardianRequest(req.params.token)));

exports.respondGuardianRequest = asyncHandler(async (req, res) => {
  const data = await consentService.respondGuardianRequest({ req, token: req.params.token, approve: req.body.approve });
  return ok(res, data, data.verified ? 'Thank you. Your consent has been recorded.' : 'You declined. The student will not be able to use the service.');
});
