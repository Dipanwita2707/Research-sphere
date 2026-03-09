/**
 * TMS (Ticket Management System) Module
 * Handles student grievances, assistance requests, enquiries, and feedback
 * 
 * Features:
 * - Student ticket submission with category hierarchy
 * - Employee ticket management and resolution
 * - Escalation workflow (Sub-Category → Category → Master Category → Registrar/Dean → VC)
 * - Auto-escalation after 48 hours of inaction
 * - Admin analytics and category management
 * - Rating system for resolved tickets
 * 
 * @module tms
 */
const router = require('express').Router();
const tmsRoutes = require('./routes');

router.use('/', tmsRoutes);

module.exports = router;
