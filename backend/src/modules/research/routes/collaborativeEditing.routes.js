const express = require('express');
const router = express.Router();
const collaborativeEditingController = require('../controllers/collaborativeEditing.controller');
const { protect, requireAnyPermission } = require('../../../shared/middleware/auth');
const { requireSchoolScope, requireViewScope } = require('../services/reviewScope');

// DRD reviewers: suggestions/sessions only inside their assigned IPR schools; reads stay open to
// applicants, inventors and mentors (participants) and to in-scope reviewers.
const requireIprActScope = requireSchoolScope('ipr');
const requireIprViewScope = requireViewScope('ipr');

// All routes require authentication
router.use(protect);

// Collaborative editing session management
router.post('/sessions/:iprApplicationId/start', 
  requireAnyPermission('central-department', ['ipr_review', 'ipr_approve', 'drd_ipr_review', 'drd_ipr_approve']),
  requireIprActScope,
  collaborativeEditingController.startCollaborativeSession
);

router.get('/sessions/:iprApplicationId', 
  requireAnyPermission('central-department', ['ipr_review', 'ipr_approve', 'drd_ipr_review', 'drd_ipr_approve']),
  requireIprViewScope,
  collaborativeEditingController.getCollaborativeSession
);

router.post('/sessions/:sessionId/end', 
  requireAnyPermission('central-department', ['ipr_review', 'ipr_approve', 'drd_ipr_review', 'drd_ipr_approve']),
  requireIprActScope,
  collaborativeEditingController.endCollaborativeSession
);

// Edit suggestions management - Individual (legacy)
router.post('/:iprApplicationId/suggestions', 
  requireAnyPermission('central-department', ['ipr_review', 'ipr_approve', 'drd_ipr_review', 'drd_ipr_approve']),
  requireIprActScope,
  collaborativeEditingController.createEditSuggestion
);

router.get('/:iprApplicationId/suggestions', 
  requireIprViewScope,
  collaborativeEditingController.getEditSuggestions
);

router.post('/suggestions/:suggestionId/respond', 
  collaborativeEditingController.respondToSuggestion
);

// Batch operations - New endpoints
router.post('/:iprApplicationId/suggestions/batch', 
  requireAnyPermission('central-department', ['ipr_review', 'ipr_approve', 'drd_ipr_review', 'drd_ipr_approve']),
  requireIprActScope,
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
  requireIprViewScope,
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