/**
 * DPDP Module
 * Digital Personal Data Protection Act 2023 + DPDP Rules 2025: privacy notices and
 * consent, guardian consent for children, data principal rights, breach register,
 * retention and DPO contact.
 *
 * Exports the router (mount at /dpdp) plus:
 *  - requireConsent: middleware for use after protect
 *  - consentGate: router-level gate used in core/routes/index.js
 *  - ensureDefaultNotice(): creates the platform default notice if missing (call at startup)
 */
const router = require('./routes/dpdp.routes');
const { requireConsent, consentGate } = require('./middleware/requireConsent');
const { requireDpdpAdmin, canManageDpdp } = require('./middleware/dpdpAdmin');
const { ensureDefaultNotice } = require('./services/consent.service');
const { DEFAULT_NOTICE } = require('./dpdp.constants');

module.exports = router;
module.exports.requireConsent = requireConsent;
module.exports.consentGate = consentGate;
module.exports.requireDpdpAdmin = requireDpdpAdmin;
module.exports.canManageDpdp = canManageDpdp;
module.exports.ensureDefaultNotice = ensureDefaultNotice;
module.exports.DEFAULT_NOTICE = DEFAULT_NOTICE;
