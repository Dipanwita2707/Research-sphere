/**
 * License Routes
 * ─────────────────────────────────────────────────────────────────────────────
 * Public:
 *   POST /api/v1/license/verify          — called by client app on every startup
 *
 * Admin (superadmin only, mounted under /api/v1/superadmin/license):
 *   POST   /issue                         — issue a new license key
 *   GET    /list                          — list all licenses
 *   POST   /revoke/:id                    — KILL SWITCH: revoke a license
 *   POST   /reset-hardware/:id            — unbind hardware (allow new machine)
 *   DELETE /:id                           — permanently delete a license
 * ─────────────────────────────────────────────────────────────────────────────
 */

const express = require('express');
const router = express.Router();
const licenseController = require('../controllers/license.controller');

// ── Public verification endpoint ──────────────────────────────────────────────
// No auth needed — the client app calls this before it even boots
// Rate-limited to prevent brute-forcing (via the global apiLimiter in server.js)
router.post('/verify', licenseController.verifyLicense);

module.exports = router;
