const express = require('express');
const router = express.Router();
const { protect } = require('../../../shared/middleware/auth');
const googleDocsController = require('../controllers/googleDocs.controller');
const { requireViewScope } = require('../services/reviewScope');

// Participants, and DRD reviewers inside their assigned IPR schools
const requireIprViewScope = requireViewScope('ipr');

// Protect all routes
router.use(protect);

// Get document with changes
router.get('/document/:iprApplicationId/:fieldName', requireIprViewScope, googleDocsController.getDocument);

// Submit a change
router.post('/submit-change', requireIprViewScope, googleDocsController.submitChange);

// Accept a change (for applicants)
router.post('/accept-change/:changeId', googleDocsController.acceptChange);

// Reject a change (for applicants)
router.post('/reject-change/:changeId', googleDocsController.rejectChange);

// Get pending changes for an application
router.get('/pending-changes/:iprApplicationId', requireIprViewScope, googleDocsController.getPendingChanges);

// Auto-save draft
router.post('/save-draft', googleDocsController.saveDraft);

// Get document status
router.get('/status/:iprApplicationId', requireIprViewScope, googleDocsController.getDocumentStatus);

module.exports = router;