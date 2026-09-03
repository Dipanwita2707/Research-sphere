/**
 * License Controller
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages hardware-bound software licenses for the SGT-UMS backend.
 *
 * This module is the "kill switch" server. Every running instance of the
 * application calls POST /api/v1/license/verify on startup. If this endpoint
 * returns anything other than 200, the client process exits immediately.
 *
 * Flow:
 *  1. Find license by licenseKey → 404 if missing
 *  2. If isActive = false       → 403 "License revoked"
 *  3. If hardwareId = null      → first run, bind hardware → 200
 *  4. If hardwareId matches     → 200 OK
 *  5. If hardwareId mismatch    → 403 "Unauthorized hardware"
 *
 * Admin routes (protected, superadmin only):
 *  POST   /api/v1/superadmin/license/issue    — create a new key
 *  GET    /api/v1/superadmin/license/list     — list all licenses
 *  POST   /api/v1/superadmin/license/revoke/:id — kill switch
 *  DELETE /api/v1/superadmin/license/:id      — delete a license record
 *  POST   /api/v1/superadmin/license/reset-hardware/:id — unbind hardware (allow re-activation on new machine)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../../../shared/config/database');
const { createModuleLogger } = require('../../../shared/utils/logger');

const log = createModuleLogger('license');

/**
 * Generates an unforgeable, HMAC-SHA256 signed runtime secret token.
 * This token is required by the client backend to authorize internal security and JWT operations.
 */
function generateRuntimeSecret(licenseKey, hardwareId) {
  const masterSalt = process.env.LICENSE_MASTER_SALT || process.env.LICENSE_SALT || 'LICENSE_SECURE_RUNTIME_SALT_2026';
  return crypto
    .createHmac('sha256', masterSalt)
    .update(`${licenseKey}:${hardwareId}:sgt_authorized_instance`)
    .digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — called by client app on every startup (no auth required)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/license/verify
 * Body: { licenseKey: string, hardwareId: string }
 *
 * Validates the license and hardware authorization status.
 */
exports.verifyLicense = async (req, res) => {
  try {
    const { licenseKey, hardwareId } = req.body;

    // Basic input validation
    if (!licenseKey || !hardwareId) {
      log.warn('License verify: missing licenseKey or hardwareId');
      return res.status(400).json({
        success: false,
        message: 'Invalid request. Contact the developer.',
      });
    }

    // 1. Look up license
    const license = await prisma.license.findUnique({
      where: { licenseKey },
    });

    if (!license) {
      log.warn(`License verify: unknown key attempted — ${licenseKey.substring(0, 8)}...`);
      return res.status(403).json({
        success: false,
        message: 'Invalid license key. Contact the developer.',
      });
    }

    // 2. Check if revoked
    if (!license.isActive) {
      log.warn(`License verify: revoked key used — assigned to "${license.assignedTo}"`);
      return res.status(403).json({
        success: false,
        message: 'License has been revoked. Contact the developer.',
      });
    }

    const allowedList = Array.isArray(license.allowedHardwareIds) ? license.allowedHardwareIds : [];
    const isMatched = (license.hardwareId && license.hardwareId === hardwareId) || allowedList.includes(hardwareId);

    // 3. Already authorized hardware
    if (isMatched) {
      const runtimeSecret = generateRuntimeSecret(license.licenseKey, hardwareId);
      log.info(`License OK: "${license.assignedTo}" on authorized hardware`);
      return res.status(200).json({
        success: true,
        valid: true,
        assignedTo: license.assignedTo,
        runtimeSecret,
        message: 'License valid.',
      });
    }

    // 4. Requires manual approval mode
    if (license.requiresApproval) {
      // Record this hardware ID so developer can see and approve it
      if (license.pendingHardwareId !== hardwareId) {
        await prisma.license.update({
          where: { id: license.id },
          data: { pendingHardwareId: hardwareId },
        });
      }
      log.warn(`License activation pending approval for "${license.assignedTo}" on machine ${hardwareId.substring(0, 12)}...`);
      return res.status(428).json({
        success: false,
        pendingApproval: true,
        message: 'Hardware authorization pending developer approval. Please contact the administrator.',
      });
    }

    // 5. Automatic first-run binding mode (if approval not strictly required)
    if (!license.hardwareId && allowedList.length === 0) {
      await prisma.license.update({
        where: { id: license.id },
        data: {
          hardwareId,
          allowedHardwareIds: [hardwareId],
          activatedAt: new Date(),
        },
      });
      const runtimeSecret = generateRuntimeSecret(license.licenseKey, hardwareId);
      log.info(`License activated: "${license.assignedTo}" — hardware bound on first run`);
      return res.status(200).json({
        success: true,
        valid: true,
        assignedTo: license.assignedTo,
        runtimeSecret,
        message: 'License activated successfully.',
      });
    }

    // 6. Hardware mismatch — different machine attempting to use bound key
    await prisma.license.update({
      where: { id: license.id },
      data: { pendingHardwareId: hardwareId },
    });
    log.warn(
      `License verify: unauthorized hardware for "${license.assignedTo}" — ` +
        `expected ${license.hardwareId?.substring(0, 12)}..., got ${hardwareId.substring(0, 12)}...`
    );
    return res.status(403).json({
      success: false,
      message: 'Unauthorized hardware. This machine has not been granted access by the developer.',
    });
  } catch (err) {
    log.error('License verify error:', err.message);
    return res.status(403).json({
      success: false,
      message: 'License verification failed. Contact the developer.',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — protected routes (superadmin only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/superadmin/license/issue
 * Body: { assignedTo: string, notes?: string, requiresApproval?: boolean, preAuthorizedHardwareId?: string }
 * Issues a new unique license key.
 */
exports.issueLicense = async (req, res) => {
  try {
    const { assignedTo, notes, requiresApproval = true, preAuthorizedHardwareId } = req.body;

    if (!assignedTo || !assignedTo.trim()) {
      return res.status(400).json({ success: false, message: 'assignedTo is required.' });
    }

    const licenseKey = uuidv4(); // Globally unique key

    const license = await prisma.license.create({
      data: {
        licenseKey,
        assignedTo: assignedTo.trim(),
        notes: notes || null,
        requiresApproval: Boolean(requiresApproval),
        hardwareId: preAuthorizedHardwareId || null,
        allowedHardwareIds: preAuthorizedHardwareId ? [preAuthorizedHardwareId] : [],
        isActive: true,
      },
    });

    log.info(`License issued to "${license.assignedTo}" — key: ${licenseKey}`);

    return res.status(201).json({
      success: true,
      message: `License issued to "${license.assignedTo}"`,
      data: {
        id: license.id,
        licenseKey: license.licenseKey,
        assignedTo: license.assignedTo,
        isActive: license.isActive,
        requiresApproval: license.requiresApproval,
        hardwareId: license.hardwareId,
        notes: license.notes,
        createdAt: license.createdAt,
      },
    });
  } catch (err) {
    log.error('Issue license error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to issue license.' });
  }
};

/**
 * GET /api/v1/superadmin/license/list
 * Lists all licenses with their current status, bound hardware, and pending approvals.
 */
exports.listLicenses = async (req, res) => {
  try {
    const licenses = await prisma.license.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        licenseKey: true,
        assignedTo: true,
        isActive: true,
        requiresApproval: true,
        hardwareId: true,
        allowedHardwareIds: true,
        pendingHardwareId: true,
        notes: true,
        activatedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });

    const masked = licenses.map((l) => ({
      ...l,
      hardwareId: l.hardwareId ? `${l.hardwareId.substring(0, 16)}...` : null,
      pendingHardwareId: l.pendingHardwareId ? `${l.pendingHardwareId.substring(0, 16)}...` : null,
      status: !l.isActive
        ? 'REVOKED'
        : l.pendingHardwareId && !l.hardwareId
        ? 'PENDING_APPROVAL'
        : l.hardwareId
        ? 'ACTIVE'
        : 'UNBOUND',
    }));

    return res.status(200).json({ success: true, count: licenses.length, data: masked });
  } catch (err) {
    log.error('List licenses error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to list licenses.' });
  }
};

/**
 * POST /api/v1/superadmin/license/approve-hardware/:id
 * Approves the currently pending hardware ID for this license.
 */
exports.approveHardware = async (req, res) => {
  try {
    const { id } = req.params;

    const license = await prisma.license.findUnique({ where: { id } });
    if (!license) {
      return res.status(404).json({ success: false, message: 'License not found.' });
    }

    if (!license.pendingHardwareId) {
      return res.status(400).json({
        success: false,
        message: 'No pending hardware authorization request for this license.',
      });
    }

    const approvedHardwareId = license.pendingHardwareId;
    const currentList = Array.isArray(license.allowedHardwareIds) ? license.allowedHardwareIds : [];
    const updatedList = Array.from(new Set([...currentList, approvedHardwareId]));

    const updated = await prisma.license.update({
      where: { id },
      data: {
        hardwareId: approvedHardwareId,
        allowedHardwareIds: updatedList,
        pendingHardwareId: null,
        activatedAt: new Date(),
      },
    });

    log.info(`✅ Hardware APPROVED for license "${license.assignedTo}" (${approvedHardwareId.substring(0, 12)}...)`);

    return res.status(200).json({
      success: true,
      message: `Hardware approved for "${license.assignedTo}". The user can now run the application.`,
      data: {
        id: updated.id,
        assignedTo: updated.assignedTo,
        authorizedHardwareId: `${approvedHardwareId.substring(0, 16)}...`,
        activatedAt: updated.activatedAt,
      },
    });
  } catch (err) {
    log.error('Approve hardware error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to approve hardware.' });
  }
};

/**
 * POST /api/v1/superadmin/license/authorize-hardware/:id
 * Body: { hardwareId: string }
 * Explicitly adds a hardware ID to the authorized whitelist for this license.
 */
exports.authorizeHardware = async (req, res) => {
  try {
    const { id } = req.params;
    const { hardwareId } = req.body;

    if (!hardwareId || typeof hardwareId !== 'string') {
      return res.status(400).json({ success: false, message: 'hardwareId is required.' });
    }

    const license = await prisma.license.findUnique({ where: { id } });
    if (!license) {
      return res.status(404).json({ success: false, message: 'License not found.' });
    }

    const currentList = Array.isArray(license.allowedHardwareIds) ? license.allowedHardwareIds : [];
    const updatedList = Array.from(new Set([...currentList, hardwareId.trim()]));

    const updated = await prisma.license.update({
      where: { id },
      data: {
        hardwareId: license.hardwareId || hardwareId.trim(),
        allowedHardwareIds: updatedList,
        pendingHardwareId: license.pendingHardwareId === hardwareId ? null : license.pendingHardwareId,
        activatedAt: license.activatedAt || new Date(),
      },
    });

    log.info(`✅ Hardware explicitly AUTHORIZED for license "${license.assignedTo}"`);

    return res.status(200).json({
      success: true,
      message: `Hardware authorized for "${license.assignedTo}".`,
      data: {
        id: updated.id,
        assignedTo: updated.assignedTo,
        allowedCount: updatedList.length,
      },
    });
  } catch (err) {
    log.error('Authorize hardware error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to authorize hardware.' });
  }
};

/**
 * POST /api/v1/superadmin/license/revoke/:id
 * KILL SWITCH — immediately deactivates a license.
 */
exports.revokeLicense = async (req, res) => {
  try {
    const { id } = req.params;

    const license = await prisma.license.findUnique({ where: { id } });
    if (!license) {
      return res.status(404).json({ success: false, message: 'License not found.' });
    }
    if (!license.isActive) {
      return res.status(400).json({ success: false, message: 'License is already revoked.' });
    }

    await prisma.license.update({
      where: { id },
      data: { isActive: false, revokedAt: new Date() },
    });

    log.warn(`🔴 License REVOKED for "${license.assignedTo}"`);

    return res.status(200).json({
      success: true,
      message: `License for "${license.assignedTo}" has been revoked. Their app will refuse to start on next restart.`,
    });
  } catch (err) {
    log.error('Revoke license error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to revoke license.' });
  }
};

/**
 * POST /api/v1/superadmin/license/reset-hardware/:id
 * Unbinds the hardware ID so the license can be activated on a new machine.
 */
exports.resetHardware = async (req, res) => {
  try {
    const { id } = req.params;

    const license = await prisma.license.findUnique({ where: { id } });
    if (!license) {
      return res.status(404).json({ success: false, message: 'License not found.' });
    }

    await prisma.license.update({
      where: { id },
      data: { hardwareId: null, allowedHardwareIds: [], pendingHardwareId: null, activatedAt: null },
    });

    log.info(`Hardware reset for license "${license.assignedTo}" — ready for re-authorization`);

    return res.status(200).json({
      success: true,
      message: `Hardware binding cleared for "${license.assignedTo}". You can now approve a new machine.`,
    });
  } catch (err) {
    log.error('Reset hardware error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to reset hardware binding.' });
  }
};

/**
 * DELETE /api/v1/superadmin/license/:id
 * Permanently deletes a license record.
 */
exports.deleteLicense = async (req, res) => {
  try {
    const { id } = req.params;

    const license = await prisma.license.findUnique({ where: { id } });
    if (!license) {
      return res.status(404).json({ success: false, message: 'License not found.' });
    }

    await prisma.license.delete({ where: { id } });

    log.warn(`License DELETED for "${license.assignedTo}"`);

    return res.status(200).json({
      success: true,
      message: `License for "${license.assignedTo}" permanently deleted.`,
    });
  } catch (err) {
    log.error('Delete license error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to delete license.' });
  }
};
