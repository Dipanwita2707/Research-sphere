/**
 * Chat Auth Routes
 */
const router = require('express').Router();
const { requireChatAuth } = require('../middleware/requireChatAuth');
const { protect } = require('../../../shared/middleware/auth');
const {
  login,
  refresh,
  logout,
  logoutAll,
  getMe,
  getSessions,
  exchangeToken,
} = require('../controllers/chatAuth.controller');

// Public — credentials-based
router.post('/login', login);

// Public — refresh token only (no access token needed)
router.post('/refresh', refresh);

// Protected by main UMS token — silently creates a chat session
router.post('/exchange', protect, exchangeToken);

// Protected — require valid chat access token
router.post('/logout', requireChatAuth, logout);
router.post('/logout-all', requireChatAuth, logoutAll);
router.get('/me', requireChatAuth, getMe);
router.get('/sessions', requireChatAuth, getSessions);

module.exports = router;
