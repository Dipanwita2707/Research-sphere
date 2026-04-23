/**
 * Socket.io Authentication Middleware
 * Verifies chat-scoped JWT tokens for socket connections.
 * Backward-compatible: also accepts old UMS tokens during rollout.
 */
const jwt = require('jsonwebtoken');
const config = require('../../../shared/config/app.config');
const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');
const { verifyChatToken } = require('../../chat-auth/services/token.service');
const { isSessionValid } = require('../../chat-auth/services/chatAuth.service');

/**
 * Authenticate socket connection
 */
const socketAuth = async (socket, next) => {
  try {
    // Get token from handshake auth or query
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    let userId;

    // Try chat-scoped token first
    try {
      const decoded = verifyChatToken(token);
      if (decoded.scope === 'chat') {
        // Validate session is not revoked
        const valid = await isSessionValid(decoded.sid);
        if (!valid) {
          return next(new Error('Chat session revoked or expired'));
        }
        userId = decoded.sub;
      } else {
        return next(new Error('Invalid token scope for socket'));
      }
    } catch (_chatErr) {
      // Backward compat: fall back to old UMS token during rollout
      try {
        const decoded = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
        userId = decoded.id;
      } catch (_umsErr) {
        return next(new Error('Invalid or expired token'));
      }
    }

    // Get user from database (cached 5 min to avoid a DB hit on every reconnect)
    const userCacheKey = `chat:socket-user:${userId}`;
    let user;
    try {
      const cachedUser = await cache.get(userCacheKey);
      if (cachedUser) {
        user = JSON.parse(cachedUser);
      }
    } catch (_) {}

    if (!user) {
      user = await prisma.userLogin.findUnique({
        where: { id: userId },
        select: {
          id: true,
          uid: true,
          email: true,
          role: true,
          status: true,
          profileImage: true,
          employeeDetails: {
            select: { firstName: true, lastName: true, displayName: true },
          },
          studentLogin: {
            select: { firstName: true, lastName: true },
          },
        },
      });
      if (user) {
        cache.set(userCacheKey, JSON.stringify(user), 300).catch(() => {});
      }
    }

    if (!user || user.status !== 'active') {
      return next(new Error('User not found or inactive'));
    }

    // Attach user to socket
    socket.user = user;
    socket.userId = user.id;

    next();
  } catch (error) {
    console.error('Socket auth error:', error.message);
    next(new Error('Invalid or expired token'));
  }
};

module.exports = { socketAuth };
