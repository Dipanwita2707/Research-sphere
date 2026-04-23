/**
 * Chat Auth Service
 * Manages chat sessions: create, refresh (with token rotation), revoke, list.
 */
const crypto = require('crypto');
const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');
const { signChatAccessToken, signChatRefreshToken, verifyChatToken } = require('./token.service');

const CHAT_SESSION_CACHE_PREFIX = 'chat:session:';
const CHAT_SESSION_CACHE_TTL = 300; // 5 minutes

/**
 * Hash a raw refresh token with SHA-256.
 */
const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

/**
 * Parse a duration string like "30d" into milliseconds.
 */
const parseDuration = (str) => {
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) return 30 * 24 * 60 * 60 * 1000; // default 30 days
  const val = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return val * multipliers[unit];
};

/**
 * Create a new chat session for a user.
 * @param {string} userId
 * @param {{ deviceId?: string, platform?: string, deviceName?: string, ipAddress?: string, userAgent?: string }} meta
 * @returns {{ chatAccessToken: string, chatRefreshToken: string, sessionId: string }}
 */
const createChatSession = async (userId, meta = {}) => {
  const config = require('../../../shared/config/app.config');
  const refreshExpireMs = parseDuration(config.chatJwt.refreshExpire);

  // Create session row
  const session = await prisma.chatSession.create({
    data: {
      userId,
      deviceId: meta.deviceId || null,
      platform: meta.platform || null,
      deviceName: meta.deviceName || null,
      ipAddress: meta.ipAddress || null,
      userAgent: meta.userAgent || null,
      refreshTokenHash: 'pending', // placeholder, updated below
      expiresAt: new Date(Date.now() + refreshExpireMs),
    },
  });

  // Generate tokens with session id
  const chatAccessToken = signChatAccessToken(userId, session.id);
  const chatRefreshToken = signChatRefreshToken(userId, session.id);

  // Store hash of refresh token
  const refreshHash = hashToken(chatRefreshToken);
  await prisma.chatSession.update({
    where: { id: session.id },
    data: { refreshTokenHash: refreshHash },
  });

  // Cache session validity
  await cache.set(
    `${CHAT_SESSION_CACHE_PREFIX}${session.id}`,
    JSON.stringify({ valid: true, userId }),
    CHAT_SESSION_CACHE_TTL
  );

  return { chatAccessToken, chatRefreshToken, sessionId: session.id };
};

/**
 * Refresh a chat session — implements token rotation.
 * @param {string} rawRefreshToken
 * @returns {{ chatAccessToken: string, chatRefreshToken: string, sessionId: string }}
 */
const refreshChatSession = async (rawRefreshToken) => {
  // Verify the JWT first
  let decoded;
  try {
    decoded = verifyChatToken(rawRefreshToken);
  } catch (err) {
    throw Object.assign(new Error('Invalid or expired refresh token'), { statusCode: 401 });
  }

  if (decoded.scope !== 'chat_refresh') {
    throw Object.assign(new Error('Invalid token scope'), { statusCode: 401 });
  }

  const refreshHash = hashToken(rawRefreshToken);

  // Find the session
  const session = await prisma.chatSession.findFirst({
    where: {
      id: decoded.sid,
      refreshTokenHash: refreshHash,
      revokedAt: null,
    },
  });

  if (!session) {
    // Possible token reuse attack — revoke all sessions for this user
    await prisma.chatSession.updateMany({
      where: { userId: decoded.sub, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw Object.assign(new Error('Refresh token reuse detected — all sessions revoked'), { statusCode: 401 });
  }

  if (session.expiresAt < new Date()) {
    throw Object.assign(new Error('Session expired'), { statusCode: 401 });
  }

  // Issue new token pair (rotation)
  const newAccessToken = signChatAccessToken(session.userId, session.id);
  const newRefreshToken = signChatRefreshToken(session.userId, session.id);
  const newHash = hashToken(newRefreshToken);

  const config = require('../../../shared/config/app.config');
  const refreshExpireMs = parseDuration(config.chatJwt.refreshExpire);

  await prisma.chatSession.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: newHash,
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + refreshExpireMs),
    },
  });

  // Update cache
  await cache.set(
    `${CHAT_SESSION_CACHE_PREFIX}${session.id}`,
    JSON.stringify({ valid: true, userId: session.userId }),
    CHAT_SESSION_CACHE_TTL
  );

  return { chatAccessToken: newAccessToken, chatRefreshToken: newRefreshToken, sessionId: session.id };
};

/**
 * Revoke a single chat session.
 */
const revokeChatSession = async (sessionId) => {
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
  await cache.del(`${CHAT_SESSION_CACHE_PREFIX}${sessionId}`);
};

/**
 * Revoke all chat sessions for a user.
 */
const revokeAllUserChatSessions = async (userId) => {
  const sessions = await prisma.chatSession.findMany({
    where: { userId, revokedAt: null },
    select: { id: true },
  });

  await prisma.chatSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  // Clear cache for all sessions
  for (const s of sessions) {
    await cache.del(`${CHAT_SESSION_CACHE_PREFIX}${s.id}`);
  }
};

/**
 * Check if a session is still valid (not revoked, not expired).
 * Uses Redis cache with DB fallback.
 */
const isSessionValid = async (sessionId) => {
  // Try cache first
  const cached = await cache.get(`${CHAT_SESSION_CACHE_PREFIX}${sessionId}`);
  if (cached) {
    const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
    return parsed.valid === true;
  }

  // Fallback to DB
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    select: { revokedAt: true, expiresAt: true, userId: true },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    await cache.set(
      `${CHAT_SESSION_CACHE_PREFIX}${sessionId}`,
      JSON.stringify({ valid: false }),
      CHAT_SESSION_CACHE_TTL
    );
    return false;
  }

  await cache.set(
    `${CHAT_SESSION_CACHE_PREFIX}${sessionId}`,
    JSON.stringify({ valid: true, userId: session.userId }),
    CHAT_SESSION_CACHE_TTL
  );
  return true;
};

/**
 * List active (non-revoked, non-expired) sessions for a user.
 */
const listActiveSessions = async (userId) => {
  return prisma.chatSession.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      platform: true,
      deviceName: true,
      ipAddress: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { lastUsedAt: 'desc' },
  });
};

module.exports = {
  createChatSession,
  refreshChatSession,
  revokeChatSession,
  revokeAllUserChatSessions,
  isSessionValid,
  listActiveSessions,
};
