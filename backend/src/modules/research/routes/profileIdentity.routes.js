const express = require('express');
const router = express.Router();

const controller = require('../controllers/profileIdentity.controller');
const authorProfile = require('../controllers/authorProfile.controller');
const { protect } = require('../../../shared/middleware/auth');

// Fixed paths first: otherwise "/admin/import-runs" matches "/:userId/import-runs" with userId="admin".
router.get('/admin/import-runs', protect, controller.getAllImportRuns);

// Author profile: visibility-enforced view + the author's privacy settings.
router.get('/:userId/view', protect, authorProfile.getProfileView);
router.get('/:userId/cv', protect, authorProfile.downloadCv);
router.get('/:userId/settings', protect, authorProfile.getProfileSettings);
router.put('/:userId/settings', protect, authorProfile.updateProfileSettings);

router.get('/:userId/identity', protect, controller.getProfileIdentity);
router.put('/:userId/identity', protect, controller.updateProfileIdentity);
router.post('/:userId/sync', protect, controller.triggerProfileSync);
router.post('/:userId/import', protect, controller.importProfilePublications);
router.get('/:userId/import-runs', protect, controller.getProfileImportRuns);

module.exports = router;
