/**
 * Authenticated branding routes, mounted at /api/v1/branding (before the DPDP consent
 * gate: the app chrome needs the university's look even while consent is pending).
 *
 *   GET    /me                      branding of the caller's university
 *   GET    /me/logo/:variant        that university's light|dark|favicon|hero image
 *   GET    /admin                   editor values          (tenant admin, own university only)
 *   PUT    /admin                   update                 (tenant admin)
 *   POST   /admin/reset             back to default        (tenant admin)
 *   POST   /admin/assets/:variant   upload image, field "file" (tenant admin)
 *   DELETE /admin/assets/:variant   remove image           (tenant admin)
 */
const express = require('express');
const { protect, restrictTo } = require('../../../shared/middleware/auth');
const tenantContext = require('../../../shared/tenancy/tenantContext');
const controller = require('../controllers/branding.controller');

const router = express.Router();
const VARIANT = /^(light|dark|favicon|hero)$/;
const checkVariant = (req, res, next) =>
  VARIANT.test(req.params.variant || '') ? next() : res.status(404).json({ success: false, message: 'Not found' });

router.use(protect);

router.get('/me', controller.getMyBranding);
router.get('/me/logo/:variant', checkVariant, controller.getMyLogo);

const admin = express.Router();
admin.use(restrictTo('admin'));
admin.get('/', controller.tenantAdminEditor.get);
admin.put('/', controller.tenantAdminEditor.update);
admin.post('/reset', controller.tenantAdminEditor.reset);
admin.post('/assets/:variant', checkVariant, controller.handleUpload(tenantContext.bindMiddleware(controller.brandImageUpload)), controller.tenantAdminEditor.upload);
admin.delete('/assets/:variant', checkVariant, controller.tenantAdminEditor.remove);
router.use('/admin', admin);

module.exports = router;
