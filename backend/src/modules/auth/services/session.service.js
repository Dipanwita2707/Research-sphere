/**
 * Session primitives: JWT signing, auth cookie options and session revocation.
 *
 * Every JWT carries `tv` = UserLogin.tokenVersion. `protect` rejects a token whose
 * `tv` differs from the stored value, so incrementing tokenVersion revokes every
 * session of that user at once (logout-all, password change/reset, deactivation,
 * role change). Always call revokeUserSessions() (or write REVOKE_SESSIONS_DATA
 * and then cache.invalidateUser) when doing any of those from another module.
 */
const jwt = require('jsonwebtoken');
const prisma = require('../../../shared/config/database');
const config = require('../../../shared/config/app.config');
const cache = require('../../../shared/config/redis');

const AUTH_COOKIE = 'token';
const SAMESITE_VALUES = ['lax', 'strict', 'none'];

/**
 * @param {{ id: string, universityId?: string|null, role?: string, tokenVersion?: number }} user
 * @returns {string}
 */
const signToken = (user) => jwt.sign(
  {
    id: user.id,
    universityId: user.universityId || null,
    role: user.role,
    tv: user.tokenVersion ?? 0,
  },
  config.jwt.secret,
  { expiresIn: config.jwt.expire, algorithm: 'HS256' }
);

/**
 * SameSite comes from COOKIE_SAMESITE (default 'lax'). Use 'lax' when the frontend
 * reaches the API through the same origin (Next.js /api rewrite, nginx, ALB path
 * routing). Use 'none' only for a cross-site API origin; it forces `secure`.
 */
const getSameSite = () => {
  const value = String(process.env.COOKIE_SAMESITE || 'lax').trim().toLowerCase();
  return SAMESITE_VALUES.includes(value) ? value : 'lax';
};

const baseCookieOptions = () => {
  const sameSite = getSameSite();
  return {
    httpOnly: true,
    secure: config.env === 'production' || sameSite === 'none',
    sameSite,
    path: '/',
  };
};

/** Options for setting the auth cookie; lifetime from JWT_COOKIE_EXPIRE (days). */
const getAuthCookieOptions = () => ({
  ...baseCookieOptions(),
  maxAge: config.jwt.cookieExpire * 24 * 60 * 60 * 1000,
});

const setAuthCookie = (res, token) => res.cookie(AUTH_COOKIE, token, getAuthCookieOptions());

const clearAuthCookie = (res) => res.clearCookie(AUTH_COOKIE, baseCookieOptions());

/** Prisma `data` fragment that revokes all existing sessions of the updated user. */
const REVOKE_SESSIONS_DATA = Object.freeze({ tokenVersion: { increment: 1 } });

/**
 * Revoke every session of a user and drop their cached auth record.
 * Inside a transaction, write REVOKE_SESSIONS_DATA instead and call
 * cache.invalidateUser(userId) after the commit (so the cache cannot be
 * refilled with the old tokenVersion before the commit lands).
 * @param {string} userId
 * @returns {Promise<number>} the new tokenVersion
 */
const revokeUserSessions = async (userId) => {
  const updated = await prisma.userLogin.update({
    where: { id: userId },
    data: REVOKE_SESSIONS_DATA,
    select: { tokenVersion: true },
  });
  await cache.invalidateUser(userId);
  return updated.tokenVersion;
};

module.exports = {
  AUTH_COOKIE,
  signToken,
  getAuthCookieOptions,
  setAuthCookie,
  clearAuthCookie,
  REVOKE_SESSIONS_DATA,
  revokeUserSessions,
};
