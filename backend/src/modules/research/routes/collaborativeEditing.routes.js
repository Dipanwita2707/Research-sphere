const express = require('express');
const router = express.Router();
const collaborativeEditingController = require('../controllers/collaborativeEditing.controller');
const { protect, requireAnyPermission } = require('../../../shared/middleware/auth');

// All routes require authentication
router.use(protect);

// Collaborative editing session management
router.post('/sessions/:iprApplicationId/start', 
  requireAnyPermission('central-department', ['ipr_review', 'ipr_approve', 'drd_ipr_review', 'drd_ipr_approve']),
  collaborativeEditingController.startCollaborativeSession
);

router.get('/sessions/:iprApplicationId', 
  requireAnyPermission('central-department', ['ipr_review', 'ipr_approve', 'drd_ipr_review', 'drd_ipr_approve']),
  collaborativeEditingController.getCollaborativeSession
);

router.post('/sessions/:sessionId/end', 
  requireAnyPermission('central-department', ['ipr_review', 'ipr_approve', 'drd_ipr_review', 'drd_ipr_approve']),
  collaborativeEditingController.endCollaborativeSession
);

// Edit suggestions management - Individual (legacy)
router.post('/:iprApplicationId/suggestions', 
  requireAnyPermission('central-department', ['ipr_review', 'ipr_approve', 'drd_ipr_review', 'drd_ipr_approve']),
  collaborativeEditingController.createEditSuggestion
);

router.get('/:iprApplicationId/suggestions', 
  collaborativeEditingController.getEditSuggestions
);

router.post('/suggestions/:suggestionId/respond', 
  collaborativeEditingController.respondToSuggestion
);

// Batch operations - New endpoints
router.post('/:iprApplicationId/suggestions/batch', 
  requireAnyPermission('central-department', ['ipr_review', 'ipr_approve', 'drd_ipr_review', 'drd_ipr_approve']),
  collaborativeEditingController.submitBatchSuggestions
);

router.post('/:iprApplicationId/respond/batch', 
  collaborativeEditingController.respondToBatchSuggestions
);

// Alternative batch respond route (frontend compatibility)
router.post('/:iprApplicationId/suggestions/batch-respond', 
  collaborativeEditingController.respondToBatchSuggestions
);

// Review history
router.get('/:iprApplicationId/history', 
  collaborativeEditingController.getReviewHistory
);

// ========== MENTOR COLLABORATIVE EDITING ROUTES ===
// These routes are for mentors to review student IPR applications

// Mentor creates individual edit suggestion
router.post('/mentor/:iprApplicationId/suggestions', 
  collaborativeEditingController.mentorCreateEditSuggestion
);

// Mentor gets their edit suggestions for an application
router.get('/mentor/:iprApplicationId/suggestions', 
  collaborativeEditingController.getMentorEditSuggestions
);

// Mentor submits batch suggestions
router.post('/mentor/:iprApplicationId/suggestions/batch', 
  collaborativeEditingController.mentorSubmitBatchSuggestions
);

module.exports = router;