/**
 * DSW (Dean of Students' Welfare) Module
 * Main entry point for the DSW system
 * 
 * This module provides complete club management functionality:
 * - Club creation via Noting system
 * - Member management
 * - RBAC enforcement
 * - Audit logging
 * - Category management
 */

const router = require('express').Router();
const dswRoutes = require('./routes');

router.use('/', dswRoutes);

module.exports = router;
