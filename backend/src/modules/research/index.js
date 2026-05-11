/**
 * Research Module
 * Handles all research-related functionality including:
 * - Research contributions (papers, books, conferences)
 * - Research progress tracking
 * - DRD review workflow
 * - Collaborative editing
 * - Policy management (research, book, conference, grant)
 */

const express = require('express');
const router = express.Router();

// Core research routes
const contributionRoutes = require('./routes/contribution.routes');
const progressTrackerRoutes = require('./routes/progressTracker.routes');
const drdReviewRoutes = require('./routes/drdReview.routes');
const deanApprovalRoutes = require('./routes/deanApproval.routes');
const collaborativeEditingRoutes = require('./routes/collaborativeEditing.routes');
const googleDocsRoutes = require('./routes/googleDocs.routes');
const profileIdentityRoutes = require('./routes/profileIdentity.routes');

// Policy routes
const researchPolicyRoutes = require('./routes/policies/research.routes');
const bookPolicyRoutes = require('./routes/policies/book.routes');
const bookChapterPolicyRoutes = require('./routes/policies/bookChapter.routes');
const conferencePolicyRoutes = require('./routes/policies/conference.routes');
const grantPolicyRoutes = require('./routes/policies/grant.routes');
const incentivePolicyRoutes = require('./routes/policies/incentive.routes');

// Mount core research routes
// Contribution routes are mounted at root level for backward compatibility
// Frontend calls /research directly, not /research/contributions
router.use('/', contributionRoutes);
router.use('/progress', progressTrackerRoutes);
router.use('/drd-review', drdReviewRoutes);
router.use('/dean-approval', deanApprovalRoutes);
router.use('/collaborative-editing', collaborativeEditingRoutes);
router.use('/google-docs', googleDocsRoutes);
router.use('/profile', profileIdentityRoutes);

// Mount policy routes
router.use('/policies/research', researchPolicyRoutes);
router.use('/policies/book', bookPolicyRoutes);
router.use('/policies/book-chapter', bookChapterPolicyRoutes);
router.use('/policies/conference', conferencePolicyRoutes);
router.use('/policies/grant', grantPolicyRoutes);
router.use('/policies/incentive', incentivePolicyRoutes);

module.exports = router;
