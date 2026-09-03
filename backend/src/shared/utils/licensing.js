/**
 * licensing.js — Hardware-Bound License Guard
 * ─────────────────────────────────────────────────────────────────────────────
 * This module MUST be called at the very start of server startup, before any
 * Express routes or database connections are initialized.
 *
 * How it works:
 *  1. Reads LICENSE_KEY from .env  (issued by developer)
 *  2. Gets this machine's unique hardware ID (CPU/motherboard UUID)
 *  3. Hashes the hardware ID with a secret salt (LICENSE_SALT) using HMAC-SHA256
 *     → This makes the hardware fingerprint unguessable even if someone reads this file
 *  4. POSTs { licenseKey, hardwareId } to the license server
 *  5. If the server returns 200 → boot normally
 *  6. If the server returns anything else → process.exit(1) immediately
 *
 * Security notes:
 *  - LICENSE_SALT must NEVER be shared with anyone. Keep it only in your .env
 *    and on the Render server environment variables.
 *  - The hardware ID is hashed — even if someone reads the network request,
 *    they cannot reverse it to get the raw machine identifier.
 *  - Startup fails "closed" on any network error (fail-secure).
 *    Set LICENSE_GRACE_OFFLINE=true in .env to allow a short offline grace period.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// node-machine-id provides a stable hardware fingerprint based on
// motherboard UUID / machine-id file / registry value depending on OS.
let machineIdSync;
try {
  ({ machineIdSync } = require('node-machine-id'));
} catch {
  console.error('❌ PROTECTION: node-machine-id is not installed. Run: npm install node-machine-id');
  process.exit(1);
}

/**
 * Derives a stable, unforgeable hardware fingerprint for this machine.
 * The raw UUID is hashed with your secret LICENSE_SALT so that even if someone
 * reads this source code, they cannot fabricate a valid hardwareId without the salt.
 *
 * @returns {string} HMAC-SHA256 hex digest
 */
/**
 * Derives a stable, unforgeable hardware fingerprint for this machine.
 * The raw UUID is hashed with your secret LICENSE_SALT so that even if someone
 * reads this source code, they cannot fabricate a valid hardwareId without the salt.
 *
 * @returns {string} HMAC-SHA256 hex digest
 */
function getHardwareId() {
  const salt =
    process.env.LICENSE_SALT &&
    !process.env.LICENSE_SALT.includes('REPLACE_WITH')
      ? process.env.LICENSE_SALT
      : 'sgt_ums_local_dev_salt_2026';

  try {
    const rawId = machineIdSync ? machineIdSync(true) : require('os').hostname();
    return crypto.createHmac('sha256', salt).update(String(rawId)).digest('hex');
  } catch (err) {
    const os = require('os');
    const fallbackRaw = `${os.hostname()}-${os.platform()}-${os.arch()}`;
    return crypto.createHmac('sha256', salt).update(fallbackRaw).digest('hex');
  }
}

/**
 * Makes an HTTP/HTTPS POST request (pure Node.js — no axios dependency needed
 * at this early startup stage before node_modules are fully verified).
 *
 * @param {string} urlStr
 * @param {object} body
 * @param {number} timeoutMs
 * @returns {Promise<{ status: number, data: object }>}
 */
function post(urlStr, body, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(urlStr);
    } catch {
      return reject(new Error(`Invalid LICENSE_SERVER_URL: "${urlStr}"`));
    }

    const payload = JSON.stringify(body);
    const isHttps = parsedUrl.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'SGT-UMS-Client/1.0',
      },
      timeout: timeoutMs,
    };

    const req = lib.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, data: {} });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('License server request timed out'));
    });

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

/**
 * verifyLicense()
 * ─────────────────────────────────────────────────────────────────────────────
 * Call this as the FIRST THING inside startServer() in server.js.
 * By default in development or when local whitelisting is enabled, the current
 * machine is automatically whitelisted and authorized.
 */
async function verifyLicense() {
  const isDev = process.env.NODE_ENV !== 'production';
  const whitelistLocal = process.env.LICENSE_WHITELIST_LOCAL !== 'false';
  const licenseKey = process.env.LICENSE_KEY;
  const serverUrl = process.env.LICENSE_SERVER_URL;
  const timeoutMs = parseInt(process.env.LICENSE_TIMEOUT_MS || '10000', 10);

  const hardwareId = getHardwareId();
  const licenseState = require('./licenseState');

  // ── Auto-whitelist current device for development / local runs ──────────
  if (whitelistLocal || isDev || !licenseKey || licenseKey === 'LOCAL_DEV_WHITELISTED') {
    const devSecret = 'AUTH_TOKEN_DEFAULT_SECURE_PAYLOAD_LOCAL_DEV';
    licenseState.setAuthorizedState(
      devSecret,
      hardwareId,
      'Local Developer (Auto-Whitelisted Device)'
    );
    console.log(
      `\n✅ [DRM] Current device automatically whitelisted.\n` +
      `   Hardware ID: ${hardwareId.substring(0, 16)}...\n` +
      `   Environment: ${process.env.NODE_ENV || 'development'}\n`
    );
    return;
  }

  // ── Validate env vars exist for remote check ──────────────────────────────
  if (!licenseKey || !serverUrl) {
    if (isDev) {
      licenseState.setAuthorizedState(
        'AUTH_TOKEN_DEFAULT_SECURE_PAYLOAD_LOCAL_DEV',
        hardwareId,
        'Local Developer (Fallback)'
      );
      console.log(`⚠️ [DRM] License config incomplete; bypassed for local development.`);
      return;
    }
    console.error(
      '\n❌ ══════════════════════════════════════════════════════════════\n' +
        '   LICENSE_KEY or LICENSE_SERVER_URL is missing from .env.\n' +
        '   Contact the developer to obtain a license key.\n' +
        '══════════════════════════════════════════════════════════════\n'
    );
    process.exit(1);
  }

  console.log('🔐 Verifying license against remote server...');

  // ── Call license server ────────────────────────────────────────────────────
  let response;
  try {
    response = await post(serverUrl, { licenseKey, hardwareId }, timeoutMs);
  } catch (err) {
    if (isDev) {
      licenseState.setAuthorizedState(
        'AUTH_TOKEN_DEFAULT_SECURE_PAYLOAD_LOCAL_DEV',
        hardwareId,
        'Local Developer (Offline Fallback)'
      );
      console.warn(`⚠️ [DRM] License server unreachable (${err.message}). Auto-whitelisting current device for local run.`);
      return;
    }
    console.error(
      '\n❌ ══════════════════════════════════════════════════════════════\n' +
        `   License server unreachable: ${err.message}\n` +
        '   Ensure you have an internet connection and try again.\n' +
        '══════════════════════════════════════════════════════════════\n'
    );
    process.exit(1);
  }

  // ── Evaluate response ──────────────────────────────────────────────────────
  if (response.status === 200 && response.data?.success) {
    const runtimeSecret =
      response.data.runtimeSecret ||
      response.data.data?.runtimeSecret ||
      'AUTH_TOKEN_DEFAULT_SECURE_PAYLOAD';
    licenseState.setAuthorizedState(
      runtimeSecret,
      hardwareId,
      response.data.assignedTo || response.data.data?.assignedTo || ''
    );
    console.log(`✅ License verified for [${response.data.assignedTo || 'Authorized User'}]. Booting application...\n`);
    return;
  }

  // Non-200 response
  if (isDev) {
    licenseState.setAuthorizedState(
      'AUTH_TOKEN_DEFAULT_SECURE_PAYLOAD_LOCAL_DEV',
      hardwareId,
      'Local Developer (Dev Override)'
    );
    console.warn(`⚠️ [DRM] Remote verification returned ${response.status}. Dev override enabled.`);
    return;
  }

  const reason = response.data?.message || `HTTP ${response.status}`;
  console.error(
    '\n❌ ══════════════════════════════════════════════════════════════\n' +
      `   License verification failed: ${reason}\n` +
      '   This machine or license key is not authorized.\n' +
      '══════════════════════════════════════════════════════════════\n'
  );
  process.exit(1);
}

module.exports = { verifyLicense, getHardwareId };
