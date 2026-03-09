/**
 * UUID Detection Utility
 *
 * Provides a centralized UUID v4 format check to replace inline regex
 * patterns scattered across the codebase.
 */

/** UUID v4 pattern */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check if a string is a valid UUID v4 format
 * @param {string} str
 * @returns {boolean}
 */
const isUUID = (str) => UUID_REGEX.test(str);

module.exports = { isUUID };
