/**
 * Public author profiles, mounted at /api/v1/public/profiles (no login).
 * Only profiles whose author chose "public" are served; everything else is a 404
 * so the endpoint cannot be used to discover who has a private profile.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/authorProfile.controller');

const router = express.Router();

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' }),
});

const SLUG = /^[a-z0-9-]{1,80}$/i;
const validParams = (req, res, next) => {
  const { universitySlug, handle } = req.params;
  if (!SLUG.test(universitySlug || '') || !SLUG.test(handle || '')) {
    return res.status(404).json({ success: false, code: 'PROFILE_NOT_FOUND', message: 'Profile not found' });
  }
  return next();
};

router.get('/:universitySlug/:handle', publicLimiter, validParams, controller.getPublicProfile);
router.get('/:universitySlug/:handle/photo', publicLimiter, validParams, controller.getPublicPhoto);

module.exports = router;
