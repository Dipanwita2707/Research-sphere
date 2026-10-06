/**
 * Public branding, mounted at /api/v1/public/branding (no login). Used by the public
 * author profile (/p/<slug>/...) and any slug-addressed page. Only active universities
 * are served; the response holds display data only (names, colours, logo URLs).
 *
 *   GET /:slug                  branding JSON
 *   GET /:slug/logo/:variant    light|dark|favicon PNG, hero JPEG
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/branding.controller');

const router = express.Router();

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' }),
});

const SLUG = /^[a-z0-9-]{1,64}$/i;
const VARIANT = /^(light|dark|favicon|hero)$/;
const validParams = (req, res, next) => {
  const { slug, variant } = req.params;
  if (!SLUG.test(slug || '') || (variant !== undefined && !VARIANT.test(variant))) {
    return res.status(404).json({ success: false, message: 'Not found' });
  }
  return next();
};

router.get('/:slug', publicLimiter, validParams, controller.getPublicBranding);
router.get('/:slug/logo/:variant', publicLimiter, validParams, controller.getPublicLogo);

module.exports = router;
