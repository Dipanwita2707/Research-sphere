const express = require('express');
const router = express.Router();
const drdAnalyticsRoutes = require('./routes/drdAnalytics.routes');

router.use('/', drdAnalyticsRoutes);

module.exports = router;
