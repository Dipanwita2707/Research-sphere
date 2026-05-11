const { publicationSyncService } = require('../services');

const isPrivileged = (user) => ['admin', 'super_admin'].includes(user?.role);

const ensureSelfOrPrivileged = (req, res) => {
  const targetUserId = req.params.userId;
  if (req.user?.id === targetUserId || isPrivileged(req.user)) {
    return targetUserId;
  }

  res.status(403).json({
    success: false,
    message: 'You do not have permission to access this profile',
  });
  return null;
};

const handleError = (res, error, fallback) => {
  const statusCode = error.statusCode || 500;
  if (statusCode < 500) {
    return res.status(statusCode).json({ success: false, message: error.message });
  }

  console.error(error);
  return res.status(500).json({ success: false, message: fallback, error: error.message });
};

exports.getProfileIdentity = async (req, res) => {
  try {
    const targetUserId = ensureSelfOrPrivileged(req, res);
    if (!targetUserId) return;

    const identity = await publicationSyncService.getProfileIdentity(targetUserId);
    res.status(200).json({ success: true, data: identity });
  } catch (error) {
    handleError(res, error, 'Failed to fetch research profile identity');
  }
};

/**
 * Normalize ORCID ID by trimming whitespace and handling null/undefined
 * @param {string|null|undefined} orcid - The ORCID ID to normalize
 * @returns {string|null} - Normalized ORCID ID or null
 */
const normalizeOrcid = (orcid) => {
  if (!orcid) return null;
  const trimmed = String(orcid).trim();
  return trimmed.length > 0 ? trimmed : null;
};

exports.updateProfileIdentity = async (req, res) => {
  try {
    const targetUserId = ensureSelfOrPrivileged(req, res);
    if (!targetUserId) return;

    // 1. Fetch current identity to detect ORCID changes
    const currentIdentity = await publicationSyncService.getProfileIdentity(targetUserId);
    const currentOrcid = normalizeOrcid(currentIdentity?.orcid);
    const newOrcid = normalizeOrcid(req.body?.orcid);

    // 2. Detect if ORCID was added or changed
    const orcidChanged = newOrcid && newOrcid !== currentOrcid;

    // 3. Save identity data
    const identity = await publicationSyncService.upsertProfileIdentity(targetUserId, req.body);

    // 4. Conditionally trigger sync if ORCID changed
    let syncTriggered = false;
    let syncError = null;

    if (orcidChanged) {
      try {
        await publicationSyncService.syncFacultyPublications(targetUserId, {
          triggeredById: req.user.id,
          triggerType: 'auto_on_identity_update',
          sourcePreference: 'orcid',
        });
        syncTriggered = true;
      } catch (error) {
        console.error('Auto-sync failed after ORCID update:', error);
        syncError = error.message;
        // Don't throw - identity save was successful
      }
    }

    // 5. Return response with sync status
    res.status(200).json({
      success: true,
      message: syncTriggered 
        ? 'Research profile identity updated and sync initiated'
        : 'Research profile identity updated successfully',
      data: {
        ...identity,
        syncTriggered,
        syncError,
      },
    });
  } catch (error) {
    handleError(res, error, 'Failed to update research profile identity');
  }
};

exports.triggerProfileSync = async (req, res) => {
  try {
    const targetUserId = ensureSelfOrPrivileged(req, res);
    if (!targetUserId) return;

    const result = await publicationSyncService.syncFacultyPublications(targetUserId, {
      triggeredById: req.user.id,
      triggerType: 'manual',
      sourcePreference: req.body?.sourcePreference || 'all',
    });

    res.status(200).json({
      success: true,
      message: 'Publication sync completed',
      data: result,
    });
  } catch (error) {
    handleError(res, error, 'Failed to sync publications');
  }
};

exports.importProfilePublications = async (req, res) => {
  try {
    const targetUserId = ensureSelfOrPrivileged(req, res);
    if (!targetUserId) return;

    const result = await publicationSyncService.importManualPublications(targetUserId, {
      publications: Array.isArray(req.body?.publications) ? req.body.publications : [],
      importFormat: req.body?.importFormat || 'manual',
      triggeredById: req.user.id,
      actor: {
        id: req.user.id,
        role: req.user.role,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Publications imported successfully',
      data: result,
    });
  } catch (error) {
    handleError(res, error, 'Failed to import publications');
  }
};

exports.getProfileImportRuns = async (req, res) => {
  try {
    const targetUserId = ensureSelfOrPrivileged(req, res);
    if (!targetUserId) return;

    const runs = await publicationSyncService.listImportRuns({
      userId: targetUserId,
      limit: Number(req.query.limit) || 20,
    });

    res.status(200).json({ success: true, data: runs });
  } catch (error) {
    handleError(res, error, 'Failed to fetch import runs');
  }
};

exports.getAllImportRuns = async (req, res) => {
  try {
    if (!isPrivileged(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view import runs',
      });
    }

    const runs = await publicationSyncService.listImportRuns({
      limit: Number(req.query.limit) || 50,
    });

    res.status(200).json({ success: true, data: runs });
  } catch (error) {
    handleError(res, error, 'Failed to fetch import runs');
  }
};
