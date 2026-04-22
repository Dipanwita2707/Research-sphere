/**
 * DSW Routes Index
 * Main router for DSW module
 */

const express = require('express');
const router = express.Router();
const clubRoutes = require('./clubRoutes');
const categoryRoutes = require('./categoryRoutes');
const auditRoutes = require('./auditRoutes');
const notingRoutes = require('./notingRoutes');
const clubController = require('../controllers/clubController');
const { canViewClub } = require('../middleware/rbac');
const { protect } = require('../../../shared/middleware/auth');

// Statistics endpoint (requires authentication)
router.get('/statistics/advanced', protect, canViewClub, clubController.getAdvancedStatistics);
router.get('/statistics', protect, canViewClub, clubController.getStatistics);

// Sub-routes
router.use('/clubs', clubRoutes);
router.use('/categories', categoryRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/noting', notingRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'DSW module is operational',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
