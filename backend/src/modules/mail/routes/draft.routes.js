/**
 * Draft Routes
 * Save, get, delete drafts
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../../../shared/middleware/auth');
const draftController = require('../controllers/draft.controller');

// All routes require authentication
router.use(protect);

// CRUD
router.get('/', draftController.getDrafts);
router.get('/:draftId', draftController.getDraft);
router.post('/', draftController.saveDraft);
router.delete('/:draftId', draftController.deleteDraft);

module.exports = router;
