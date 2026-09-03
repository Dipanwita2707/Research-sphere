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

// Friendly GET endpoint for browser health verification
router.get('/verify', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'ResearchSphere DRM License Verification Service',
    method: 'POST',
    description: 'Send a POST request with { licenseKey, hardwareId } to verify your software instance.',
  });
});

router.post('/verify', licenseController.verifyLicense);

module.exports = router;
