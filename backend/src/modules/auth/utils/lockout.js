/**
 * Account lockout after repeated failed logins.
 *
 * After `config.security.maxLoginAttempts` consecutive wrong passwords the account
 * is locked for `config.security.lockoutDuration` minutes. The counter is reset on
 * a successful login and when a lock is applied (so the user gets a fresh set of
 * attempts once the lock expires). A password reset also clears the lock.
 */
const config = require('../../../shared/config/app.config');

const getSettings = (overrides = {}) => ({
  maxAttempts: overrides.maxAttempts ?? config.security.maxLoginAttempts,
  lockoutMinutes: overrides.lockoutMinutes ?? config.security.lockoutDuration,
});

/**
 * @param {{ lockedUntil?: Date|string|null }} user
 * @param {Date} [now]
 * @returns {{ locked: boolean, minutesRemaining: number }}
 */
const getLockState = (user, now = new Date()) => {
  const lockedUntil = user && user.lockedUntil ? new Date(user.lockedUntil) : null;
  if (!lockedUntil || lockedUntil <= now) {
    return { locked: false, minutesRemaining: 0 };
  }
  return {
    locked: true,
    minutesRemaining: Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000)),
  };
};

/**
 * Atomically count a failed attempt and lock the account when the limit is hit.
 * @param {object} db - Prisma client (or transaction client)
 * @param {string} userId
 * @param {{ now?: Date, maxAttempts?: number, lockoutMinutes?: number }} [options]
 * @returns {Promise<{ locked: boolean, attempts: number, lockedUntil?: Date, minutesRemaining?: number }>}
 */
const recordFailedLogin = async (db, userId, options = {}) => {
  const now = options.now || new Date();
  const { maxAttempts, lockoutMinutes } = getSettings(options);

  const { failedLoginAttempts } = await db.userLogin.update({
    where: { id: userId },
    data: { failedLoginAttempts: { increment: 1 } },
    select: { failedLoginAttempts: true },
  });

  if (failedLoginAttempts >= maxAttempts) {
    const lockedUntil = new Date(now.getTime() + lockoutMinutes * 60000);
    await db.userLogin.update({
      where: { id: userId },
      data: { lockedUntil, failedLoginAttempts: 0 },
    });
    return { locked: true, attempts: failedLoginAttempts, lockedUntil, minutesRemaining: lockoutMinutes };
  }

  return { locked: false, attempts: failedLoginAttempts };
};

/** Fields to write on a successful login. */
const successfulLoginData = (now = new Date()) => ({
  failedLoginAttempts: 0,
  lockedUntil: null,
  lastLoginAt: now,
});

const lockedResponseBody = (minutesRemaining) => ({
  success: false,
  code: 'ACCOUNT_LOCKED',
  minutesRemaining,
  message: `Too many failed login attempts. Your account is locked for ${minutesRemaining} more minute${minutesRemaining === 1 ? '' : 's'}.`,
});

module.exports = {
  getLockState,
  recordFailedLogin,
  successfulLoginData,
  lockedResponseBody,
};
