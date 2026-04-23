/**
 * Chat Auth Module
 * Separate authentication system for chat — scoped JWT sessions.
 */
const router = require('express').Router();
const chatAuthRoutes = require('./routes/chatAuth.routes');

router.use('/', chatAuthRoutes);

module.exports = router;
