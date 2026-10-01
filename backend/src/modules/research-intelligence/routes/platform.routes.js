/**
 * Research Intelligence platform routes — superadmin only, cross-tenant.
 * Mounted at /api/v1/research-intelligence/platform
 *
 * The superadmin decides which universities get the module; this is independent of
 * subscription plans and billing.
 */

'use strict';

const express = require('express');
const { protect, restrictTo } = require('../../../shared/middleware/auth');
const asyncHandler = require('../../../shared/utils/asyncHandler');
const accessCtrl = require('../controllers/access.controller');

const router = express.Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.use(protect, restrictTo('superadmin'));

router.get('/universities', asyncHandler(accessCtrl.listUniversityModules));
router.put(
  '/universities/:universityId',
  (req, res, next) => (UUID_RE.test(req.params.universityId) ? next() : res.status(400).json({ success: false, message: 'Invalid universityId' })),
  asyncHandler(accessCtrl.setUniversityModule)
);

module.exports = router;
