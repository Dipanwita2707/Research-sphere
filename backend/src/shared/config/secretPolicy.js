/**
 * @module secretPolicy
 * @description Startup checks for secrets: in production a secret must be set, long
 * enough, and must not be a placeholder copied from an example file or compose default
 * (e.g. "your-super-secret-jwt-key-change-this-in-production").
 */

/** Substrings that only appear in example / placeholder values (matched case-insensitively). */
const PLACEHOLDER_MARKERS = [
  'change-this', 'change_this', 'changethis',
  'change-me', 'change_me', 'changeme',
  'your-super-secret', 'your_super_secret',
  'secret', 'example', 'placeholder', 'dev-only', 'insecure',
];

/** True when the value looks like a placeholder rather than a generated secret. */
const isPlaceholderSecret = (value) => {
  const v = String(value || '').toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => v.includes(marker));
};

/**
 * Throw when a required production secret is missing, short or a placeholder.
 * @param {string} name     env var name (for the message)
 * @param {string|undefined} value
 * @param {{ minLength?: number }} [options]
 */
const assertProductionSecret = (name, value, { minLength = 32 } = {}) => {
  if (!value || value.length < minLength) {
    throw new Error(`FATAL: ${name} must be set to at least ${minLength} characters in production. Aborting.`);
  }
  if (isPlaceholderSecret(value)) {
    throw new Error(
      `FATAL: ${name} is a placeholder value (from an example file or compose default). ` +
      `Generate a random secret, e.g. \`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"\`. Aborting.`
    );
  }
};

module.exports = { PLACEHOLDER_MARKERS, isPlaceholderSecret, assertProductionSecret };
