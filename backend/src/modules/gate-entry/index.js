const express = require('express');
const router = express.Router();

// Import routes
const gatePassRoutes = require('./routes/gatePass.routes');

// Mount routes
router.use('/', gatePassRoutes);

module.exports = router;
