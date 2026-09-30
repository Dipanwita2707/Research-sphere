/**
 * @module dpdp/middleware/requireConsent
 * @description Consent enforcement (DPDP s. 6): an authenticated, non-superadmin user
 * whose tenant has an active notice must have granted every required purpose (and,
 * for a minor where the university requires it, the guardian must have verified)
 * before using the app. Otherwise → 403 { code: 'CONSENT_REQUIRED' }.
 *
 * Two forms:
 *  - requireConsent: ordinary middleware for use after `protect` (req.user is set).
 *  - consentGate: mounted once in core/routes/index.js, in front of the module
 *    routers. `protect` runs inside each module router, so at that point req.user
 *    is not set yet; the gate identifies the caller itself (JWT verify + protect's
 *    cached session, or a tiny lookup), and only ever *blocks* a caller with a valid,
 *    active session. Anything it cannot decide (no/invalid token, revoked session,
 *    suspended tenant, errors) passes through unchanged so the module's own
 *    `protect` produces the usual 401/403, and public routes keep working.
 */
const jwt = require('jsonwebtoken');
const prisma = require('../../../shared/config/database');
const config = require('../../../shared/config/app.config');
const cache = require('../../../shared/config/redis');
const tenantContext = require('../../../shared/tenancy/tenantContext');
const licenseState = require('../../../shared/utils/licenseState');
const { createModuleLogger } = require('../../../shared/utils/logger');
const { consentDecision, isConsentExemptPath } = require('../dpdp.utils');
const consentService = require('../services/consent.service');

const log = createModuleLogger('dpdp');

const GATE_USER_TTL = 60;

const consentRequiredResponse = (res, state) => res.status(403).json({
  success: false,
  code: 'CONSENT_REQUIRED',
  message: state?.guardianPending
    ? 'Your parent or guardian has not yet confirmed consent. Ask them to open the link we emailed them.'
    : 'Please review the privacy notice and give the required consent to continue.',
  data: {
    needsConsent: !!state?.needsConsent,
    guardianPending: !!state?.guardianPending,
    isMinor: !!state?.isMinor,
  },
});

/** Path relative to the API prefix (/api/v1). */
const relativePath = (req) => {
  const full = String(req.originalUrl || req.url || '').split('?')[0];
  const m = full.match(/^\/api\/[^/]+(\/.*)?$/);
  return m ? m[1] || '/' : req.path || full;
};

/**
 * Evaluate consent for a user inside their tenant context.
 * @returns {Promise<{decision: 'allow'|'block', state?: object}>}
 */
const evaluate = async (user, path) => {
  if (!user || user.role === 'superadmin' || !user.universityId || isConsentExemptPath(path)) {
    return { decision: 'allow' };
  }
  const state = await tenantContext.runForTenant(user.universityId, () => consentService.getCachedConsentState(user.id));
  return { decision: consentDecision({ user, path, state }), state };
};

/** Middleware for use after protect. Fails open on internal errors (logged). */
const requireConsent = async (req, res, next) => {
  try {
    const { decision, state } = await evaluate(req.user, relativePath(req));
    if (decision === 'block') return consentRequiredResponse(res, state);
    return next();
  } catch (err) {
    log.error('requireConsent check failed; allowing request', { error: err.message });
    return next();
  }
};

const extractToken = (req) => {
  const h = req.headers?.authorization;
  if (h && h.startsWith('Bearer ')) return h.slice(7);
  return req.cookies?.token || null;
};

/** Minimal session info: protect's cached session if present, else a small lookup. */
const loadGateUser = async (userId) => {
  const session = await cache.get(`${cache.CACHE_KEYS.USER}auth:${userId}`);
  if (session) return session;
  // `user:auth:` keys are unscoped (see redis.js) and cleared by invalidateUser()
  const { data } = await cache.getOrSet(`${cache.CACHE_KEYS.USER}auth:dpdpgate:${userId}`, () => tenantContext.runAsSystem(() => prisma.userLogin.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true, universityId: true, tokenVersion: true, anonymizedAt: true },
  })), GATE_USER_TTL);
  return data;
};

/** Router-level gate (see module doc). */
const consentGate = async (req, res, next) => {
  try {
    const path = relativePath(req);
    if (isConsentExemptPath(path)) return next();
    const token = extractToken(req);
    if (!token || !licenseState.isVerified()) return next();

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
    } catch (_) {
      return next();
    }
    if (!decoded?.id || decoded.aud) return next();

    const user = await loadGateUser(decoded.id);
    if (!user || user.status !== 'active' || user.anonymizedAt) return next();
    if ((decoded.tv ?? -1) !== (user.tokenVersion ?? 0)) return next();
    if (user.role === 'superadmin' || !user.universityId) return next();

    const { getTenantStatus } = require('../../../shared/middleware/auth');
    const tenantStatus = await getTenantStatus(user.universityId);
    if (!tenantStatus?.allowed) return next();

    const { decision, state } = await evaluate(user, path);
    if (decision === 'block') return consentRequiredResponse(res, state);
    return next();
  } catch (err) {
    log.error('consentGate check failed; allowing request', { error: err.message });
    return next();
  }
};

module.exports = { requireConsent, consentGate, relativePath };
