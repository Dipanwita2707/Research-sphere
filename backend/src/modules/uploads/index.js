/**
 * Authenticated upload file route.
 *
 * Mounted by server.js at `/uploads` (the URL shape the frontend already builds
 * via getUploadUrl/getFileUrl/getProfileImageUrl), replacing the former public
 * express.static. Browsers send the httpOnly `token` cookie with <img>/<a> requests
 * (SameSite=None; Secure in production), API clients may use a Bearer header.
 *
 *   GET /uploads/<relative path>   → protect → authorizeUploadPath → stream
 *
 * Other modules can reuse the building blocks exported by fileAccess.service.js.
 */
const express = require('express');
const { protect } = require('../../shared/middleware/auth');
const { serveUpload } = require('./fileAccess.service');

const router = express.Router();

// Express 5 requires named wildcards; serveUpload reads req.path, not the capture.
router.get('/*path', protect, serveUpload);

module.exports = router;
