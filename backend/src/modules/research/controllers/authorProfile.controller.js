const authorProfileService = require('../services/authorProfile.service');
const { sendResolvedFile } = require('../../uploads/fileAccess.service');
const logger = require('../../../shared/utils/logger');

const handle = (fallback) => async (res, work) => {
  try {
    const data = await work();
    res.status(200).json({ success: true, data });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode < 500) {
      return res.status(statusCode).json({ success: false, code: error.code, message: error.message });
    }
    logger.error(fallback, error);
    return res.status(500).json({ success: false, message: fallback });
  }
};

const viewHandler = handle('Failed to load research profile');
const settingsHandler = handle('Failed to update profile settings');
const publicHandler = handle('Failed to load profile');

/** GET /research/profile/:userId/view — profile as the signed-in viewer is allowed to see it. */
exports.getProfileView = (req, res) =>
  viewHandler(res, () => authorProfileService.getProfileForViewer(req.params.userId, req.user));

/** GET /research/profile/:userId/settings — author/admin only. */
exports.getProfileSettings = (req, res) =>
  viewHandler(res, () => authorProfileService.getSettings(req.params.userId, req.user));

/** PUT /research/profile/:userId/settings — author/admin only. */
exports.updateProfileSettings = (req, res) =>
  settingsHandler(res, () => authorProfileService.updateSettings(req.params.userId, req.body, req.user));

/** GET /public/profiles/:universitySlug/:handle — no login; 404 unless the author made it public. */
exports.getPublicProfile = (req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  return publicHandler(res, () => authorProfileService.getPublicProfile(req.params.universitySlug, req.params.handle));
};

/** GET /public/profiles/:universitySlug/:handle/photo — the author's photo, only while public. */
exports.getPublicPhoto = async (req, res, next) => {
  try {
    const fullPath = await authorProfileService.getPublicPhotoPath(req.params.universitySlug, req.params.handle);
    // sendResolvedFile marks it private/short-lived, so un-publishing takes effect quickly
    // and no shared cache keeps serving the photo.
    sendResolvedFile(res, fullPath, next);
  } catch (error) {
    if (error.statusCode === 404) return res.status(404).json({ success: false, message: 'Photo not found' });
    return next(error);
  }
};
