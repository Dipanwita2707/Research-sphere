/**
 * Label Routes
 * CRUD labels, apply/remove label from messages
 */
const express = require('express');
const router = express.Router();
const { protect } = require('../../../shared/middleware/auth');
const labelController = require('../controllers/label.controller');

// All routes require authentication
router.use(protect);

// CRUD
router.get('/', labelController.getLabels);
router.post('/', labelController.createLabel);
router.put('/:labelId', labelController.updateLabel);
router.delete('/:labelId', labelController.deleteLabel);

// Apply/Remove labels
router.post('/apply', labelController.applyLabel);
router.post('/remove', labelController.removeLabel);

// Get labels for a specific thread
router.get('/thread/:threadId', labelController.getThreadLabels);

// Get threads/messages with a label
router.get('/:labelId/threads', labelController.getLabelThreads);
router.get('/:labelId/messages', labelController.getLabelMessages);

module.exports = router;
