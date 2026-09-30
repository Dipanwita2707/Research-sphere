const express = require('express');
const { bindMiddleware } = require('../../../shared/tenancy/tenantContext');
const router = express.Router();
const multer = require('multer');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const forgotPasswordController = require('../controllers/forgotPassword.controller');
const { protect } = require('../../../shared/middleware/auth');
const { checkProfilePhotoPermission } = require('../middleware/profilePhoto.middleware');
const {
  forgotPasswordIpLimiter,
  forgotPasswordEmailLimiter,
  resetPasswordLimiter,
} = require('../../../shared/middleware/rateLimiter');

// Configure multer for profile photo uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// Validation middleware
const loginValidation = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 10 }).withMessage('New password must be at least 10 characters')
];

const updateProfileValidation = [
  body('firstName').optional().trim().isLength({ min: 1, max: 100 }).withMessage('First name must be 1-100 characters'),
  body('lastName').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Last name must be 1-100 characters'),
  body('phone').optional().trim().isLength({ max: 20 }).withMessage('Phone number must be at most 20 characters'),
  body('email').optional().trim().isEmail().withMessage('Invalid email format')
];

// Public routes
router.post('/login', loginValidation, authController.login);
router.post('/forgot-password', forgotPasswordIpLimiter, forgotPasswordEmailLimiter, body('email').trim().isEmail().withMessage('Valid email required'), forgotPasswordController.forgotPassword);
router.post('/reset-password', resetPasswordLimiter, forgotPasswordController.resetPassword);
// Public so that a stale/revoked session can always clear its cookie
router.post('/logout', authController.logout);

// Protected routes
router.use(protect);
router.post('/logout-all', authController.logoutAll);
router.get('/me', authController.getMe);
router.put('/change-password', changePasswordValidation, authController.changePassword);
router.put('/profile', updateProfileValidation, authController.updateProfile);
router.get('/settings', authController.getSettings);
router.put('/settings', authController.updateSettings);

// Profile photo routes (with permission check)
router.post('/profile/photo', checkProfilePhotoPermission, bindMiddleware(upload.single('photo')), authController.uploadProfilePhoto);
router.delete('/profile/photo', authController.deleteProfilePhoto);

module.exports = router;
