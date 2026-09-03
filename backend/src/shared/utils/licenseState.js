'use strict';

/**
 * licenseState.js — In-Memory Runtime Cryptographic State
 * ─────────────────────────────────────────────────────────────────────────────
 * Holds the temporary runtime authorization token provided dynamically by the
 * remote licensing server during startup.
 *
 * Security Guarantee:
 *  - This secret is NEVER committed to git and NEVER stored in .env files.
 *  - It is ONLY returned by the remote licensing server on successful verification.
 *  - If someone comments out `verifyLicense()` in server.js, `systemSecret` remains
 *    null, causing JWT creation, session signing, and protected API routes to fail.
 * ─────────────────────────────────────────────────────────────────────────────
 */

let _runtimeSecret = null;
let _isVerified = false;
let _hardwareFingerprint = null;
let _assignedTo = null;

module.exports = {
  /**
   * Sets the runtime secret after successful verification with the license server.
   * @param {string} secret
   * @param {string} hardwareId
   * @param {string} assignedTo
   */
  setAuthorizedState(secret, hardwareId, assignedTo = '') {
    if (!secret || typeof secret !== 'string') {
      throw new Error('Invalid runtime secret format');
    }
    _runtimeSecret = secret;
    _hardwareFingerprint = hardwareId;
    _assignedTo = assignedTo;
    _isVerified = true;
  },

  /**
   * Retrieves the dynamic runtime secret required for JWT signing & security checks.
   * @returns {string}
   */
  getRuntimeSecret() {
    if (!_isVerified || !_runtimeSecret) {
      const err = new Error('SECURITY VIOLATION: Application runtime is unauthorized. Missing license secret.');
      err.statusCode = 403;
      throw err;
    }
    return _runtimeSecret;
  },

  /**
   * Returns whether the application has been verified by the remote server.
   * @returns {boolean}
   */
  isVerified() {
    return _isVerified && Boolean(_runtimeSecret);
  },

  /**
   * Gets details of the active license.
   */
  getLicenseDetails() {
    return {
      isVerified: _isVerified,
      assignedTo: _assignedTo,
      hardwareFingerprint: _hardwareFingerprint ? `${_hardwareFingerprint.substring(0, 8)}...` : null,
    };
  },
};
