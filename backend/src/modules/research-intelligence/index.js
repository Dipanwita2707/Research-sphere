/**
 * Research Intelligence module
 *
 * Mounted at /api/v1/research-intelligence (see modules/core/routes/index.js).
 *   /platform/*  superadmin: enable the module per university
 *   /*           tenant routes: gated by the university switch and per-user capabilities
 * The pipeline queue and nightly refresh are started by server.js (jobs/researchIntelligenceQueue).
 */

'use strict';

const router = require('express').Router();

router.use('/platform', require('./routes/platform.routes'));
router.use('/', require('./routes/rip.routes'));

module.exports = router;
