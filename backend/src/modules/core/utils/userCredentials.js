/**
 * @module userCredentials
 * @description Password helpers for admin-driven account management (create, reset,
 * bulk upload). No hardcoded default passwords: when an admin does not choose one, a
 * strong random password is generated and returned once so it can be handed over.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { validatePasswordPolicy } = require('../../auth/utils/passwordPolicy');

const BCRYPT_ROUNDS = 12;
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!#$%&*_?'; // no = + - @ so a password never looks like a spreadsheet formula
const ALPHABET = LETTERS + DIGITS + SYMBOLS;

/** Uniformly random character from a set (crypto.randomInt avoids modulo bias). */
const pick = (set) => set[crypto.randomInt(set.length)];

/**
 * Generate a strong random password that satisfies the password policy
 * (letters + digits, >= 10 chars). Ambiguous characters (0/O, 1/l/I) are excluded.
 * @param {number} [length=16]
 * @returns {string}
 */
const generateStrongPassword = (length = 16) => {
  const chars = [pick(LETTERS), pick(LETTERS), pick(DIGITS), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(ALPHABET));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

/** Error for an unacceptable password; safe to show to the admin. */
class PasswordPolicyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PasswordPolicyError';
    this.statusCode = 400;
    this.isOperational = true;
  }
}

/**
 * Resolve the password for an admin-created/reset account.
 * @param {string|undefined|null} requested - password chosen by the admin (optional)
 * @param {{ uid?: string|null, email?: string|null }} user - for the "not your username" rule
 * @returns {Promise<{ passwordHash: string, passwordChangedAt: Date, generatedPassword: string|null }>}
 *   generatedPassword is set only when one was generated (return it to the admin once).
 * @throws {PasswordPolicyError} when the requested password violates the policy
 */
const preparePassword = async (requested, user = {}) => {
  let password = typeof requested === 'string' && requested.length > 0 ? requested : null;
  let generatedPassword = null;
  if (password) {
    const policyError = validatePasswordPolicy(password, user);
    if (policyError) throw new PasswordPolicyError(policyError);
  } else {
    password = generateStrongPassword();
    generatedPassword = password;
  }
  return {
    passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    passwordChangedAt: new Date(),
    generatedPassword,
  };
};

module.exports = {
  BCRYPT_ROUNDS,
  generateStrongPassword,
  preparePassword,
  PasswordPolicyError,
};
