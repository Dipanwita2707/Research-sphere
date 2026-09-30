/**
 * @module dpdp/routes
 * @description DPDP API, mounted at /api/v1/dpdp. Contract: see DPDP_API.md.
 * /dpdp/* is exempt from the consent gate so users can always read the notice,
 * give/withdraw consent and exercise their rights.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect } = require('../../../shared/middleware/auth');
const { validateRequest } = require('../../../shared/utils/zodValidation');
const { requireDpdpAdmin } = require('../middleware/dpdpAdmin');
const v = require('../validators/dpdp.validators');
const c = require('../controllers/dpdp.controller');
const a = require('../controllers/admin.controller');

const router = express.Router();

// ── public (no auth) ─────────────────────────────────────────────────────────
const guardianLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.DPDP_GUARDIAN_RATE_LIMIT || '20', 10) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ success: false, message: 'Too many attempts. Please try again in a few minutes.' }),
});
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' }),
});

router.get('/public/guardian-consent/:token', guardianLimiter, validateRequest({ params: v.tokenParams }), c.getGuardianRequest);
router.post('/public/guardian-consent/:token', guardianLimiter, validateRequest({ params: v.tokenParams, body: v.guardianResponseBody }), c.respondGuardianRequest);
router.get('/public/:universitySlug/privacy', publicLimiter, validateRequest({ params: v.slugParams }), c.getPublicPrivacy);

// ── authenticated ────────────────────────────────────────────────────────────
router.use(protect);

router.get('/consents/me', c.getMyConsents);
router.post('/consents', validateRequest({ body: v.consentBody }), c.giveConsent);
router.post('/consents/:purpose/withdraw', validateRequest({ params: v.purposeParams }), c.withdrawConsent);

router.get('/requests/me', c.getMyRequests);
router.post('/requests', validateRequest({ body: v.createRequestBody }), c.createRequest);
router.get('/export/me', c.exportMyData);

router.get('/nominee/me', c.getMyNominee);
router.put('/nominee/me', validateRequest({ body: v.nomineeBody }), c.putMyNominee);
router.delete('/nominee/me', c.deleteMyNominee);

router.get('/contact', c.getContact);

// ── admin / DPO ──────────────────────────────────────────────────────────────
const admin = express.Router();
admin.use(requireDpdpAdmin);

admin.get('/overview', a.overview);

admin.get('/requests', validateRequest({ query: v.listRequestsQuery }), a.listRequests);
admin.patch('/requests/:id', validateRequest({ params: v.idParams, body: v.updateRequestBody }), a.updateRequest);
admin.post('/requests/:id/fulfil', validateRequest({ params: v.idParams, body: v.fulfilRequestBody }), a.fulfilRequest);

admin.get('/notices', a.listNotices);
admin.post('/notices', validateRequest({ body: v.noticeBody }), a.createNotice);
admin.post('/notices/:id/activate', validateRequest({ params: v.idParams }), a.activateNotice);

admin.get('/breaches', a.listBreaches);
admin.post('/breaches', validateRequest({ body: v.breachBody }), a.createBreach);
admin.patch('/breaches/:id', validateRequest({ params: v.idParams, body: v.breachUpdateBody }), a.updateBreach);
admin.post('/breaches/:id/notify-principals', validateRequest({ params: v.idParams, body: v.notifyBody }), a.notifyPrincipals);

admin.get('/retention-policies', a.getRetentionPolicies);
admin.put('/retention-policies', validateRequest({ body: v.retentionBody }), a.putRetentionPolicies);

admin.put('/contact', validateRequest({ body: v.contactBody }), a.putContact);

router.use('/admin', admin);

module.exports = router;
