const express = require('express');
const router = express.Router();

const controller = require('../controllers/profileIdentity.controller');
const { protect } = require('../../../shared/middleware/auth');

router.get('/:userId/identity', protect, controller.getProfileIdentity);
router.put('/:userId/identity', protect, controller.updateProfileIdentity);
router.post('/:userId/sync', protect, controller.triggerProfileSync);
router.post('/:userId/import', protect, controller.importProfilePublications);
router.get('/:userId/import-runs', protect, controller.getProfileImportRuns);
router.get('/admin/import-runs', protect, controller.getAllImportRuns);

module.exports = router;
