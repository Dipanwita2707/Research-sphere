/**
 * DSW Noting Routes
 * Routes for DSW-Noting integration
 */

const express = require('express');
const router = express.Router();
const notingController = require('../controllers/notingController');
const {
  validateClubCreation,
  validateClubChangeRequest,
} = require('../validators');
const { canCreateClubNoting, canRequestClubChange } = require('../middleware/rbac');

// Create Club Creation Noting
router.post('/club-creation', canCreateClubNoting, validateClubCreation, notingController.createClubCreationNoting);

// Create Club Change Request Noting
router.post('/club-change/:clubId', canRequestClubChange, validateClubChangeRequest, notingController.createClubChangeRequestNoting);

// Process approved noting (internal/webhook)
router.post('/process-approval', notingController.processApprovedNoting);

module.exports = router;
