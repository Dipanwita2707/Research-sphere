/**
 * Chat Token Service
 * Signs and verifies scoped JWT tokens for the chat module.
 * Uses a separate secret (CHAT_JWT_SECRET) from the main UMS JWT.
 */
const jwt = require('jsonwebtoken');
const config = require('../../../shared/config/app.config');

/**
 * Sign a short-lived chat access token.
 * @param {string} userId
 * @param {string} sessionId
 * @returns {string} JWT
 */
const signChatAccessToken = (userId, sessionId) => {
  return jwt.sign(
    { sub: userId, sid: sessionId, scope: 'chat' },
    config.chatJwt.secret,
    { expiresIn: config.chatJwt.accessExpire, algorithm: 'HS256' }
  );
};

/**
 * Sign a long-lived chat refresh token.
 * @param {string} userId
 * @param {string} sessionId
 * @returns {string} JWT
 */
const signChatRefreshToken = (userId, sessionId) => {
  return jwt.sign(
    { sub: userId, sid: sessionId, scope: 'chat_refresh' },
    config.chatJwt.secret,
    { expiresIn: config.chatJwt.refreshExpire, algorithm: 'HS256' }
  );
};

/**
 * Verify a chat token (access or refresh) and return the decoded payload.
 * @param {string} token
 * @returns {{ sub: string, sid: string, scope: string, iat: number, exp: number }}
 */
const verifyChatToken = (token) => {
  return jwt.verify(token, config.chatJwt.secret, { algorithms: ['HS256'] });
};

module.exports = { signChatAccessToken, signChatRefreshToken, verifyChatToken };
