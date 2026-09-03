const express = require('express');
const router = express.Router();
const affiliationController = require('../controllers/affiliation.controller');
const { protect } = require('../../../shared/middleware/auth');

// Any authenticated user can fetch their own suggested affiliation + variants.
router.use(protect);
router.get('/variants', affiliationController.getMyAffiliationVariants);

module.exports = router;
