/**
 * Password policy shared by change-password, reset-password and admin-set password.
 *
 * Rules: 10-128 characters, at least one letter and one digit, not equal to the
 * user's uid or email (case-insensitive), and not the same as the current password.
 */
const bcrypt = require('bcryptjs');

const MIN_LENGTH = 10;
// bcrypt only uses the first 72 bytes; a hard cap also bounds hashing cost.
const MAX_LENGTH = 128;

const POLICY_DESCRIPTION = `Password must be at least ${MIN_LENGTH} characters and contain at least one letter and one digit.`;

/**
 * Synchronous rule check (no current-password comparison).
 * @param {string} password
 * @param {{ uid?: string|null, email?: string|null }} [user]
 * @returns {string|null} error message, or null when the password is acceptable
 */
const validatePasswordPolicy = (password, user = {}) => {
  if (typeof password !== 'string' || password.length === 0) {
    return 'Password is required.';
  }
  if (password.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters.`;
  }
  if (password.length > MAX_LENGTH) {
    return `Password must be at most ${MAX_LENGTH} characters.`;
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Password must contain at least one letter and one digit.';
  }

  const lowered = password.trim().toLowerCase();
  const identifiers = [user.uid, user.email, user.email ? String(user.email).split('@')[0] : null]
    .filter((v) => typeof v === 'string' && v.trim())
    .map((v) => v.trim().toLowerCase());
  if (identifiers.includes(lowered)) {
    return 'Password must not be the same as your username or email.';
  }

  return null;
};

/**
 * Full check for a new password, including "not the same as the current password".
 * @param {string} newPassword
 * @param {{ uid?: string|null, email?: string|null, passwordHash?: string|null }} user
 * @returns {Promise<string|null>} error message, or null when acceptable
 */
const checkNewPassword = async (newPassword, user = {}) => {
  const ruleError = validatePasswordPolicy(newPassword, user);
  if (ruleError) return ruleError;

  if (user.passwordHash && await bcrypt.compare(newPassword, user.passwordHash)) {
    return 'New password must be different from your current password.';
  }
  return null;
};

module.exports = {
  MIN_LENGTH,
  MAX_LENGTH,
  POLICY_DESCRIPTION,
  validatePasswordPolicy,
  checkNewPassword,
};
