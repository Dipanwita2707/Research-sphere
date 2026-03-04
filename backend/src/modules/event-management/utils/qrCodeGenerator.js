/**
 * QR Code Generation Utility
 *
 * Generates deterministic-prefix QR codes used for event registration.
 * Format: EVT-{eventId}-{timestamp}-{hash16}
 */

const crypto = require('crypto');

/**
 * Generate a unique QR code string for an event registration.
 *
 * @param {string} eventId - The event's unique ID
 * @param {string} userId  - The registering user's ID
 * @returns {string} e.g. "EVT-42-1717000000000-A1B2C3D4E5F6G7H8"
 */
const generateQRCode = (eventId, userId) => {
  const timestamp = Date.now();
  const randomData = `${eventId}-${userId}-${timestamp}-${crypto.randomBytes(8).toString('hex')}`;
  const hash = crypto.createHash('sha256').update(randomData).digest('hex').substring(0, 16);

  return `EVT-${eventId}-${timestamp}-${hash}`.toUpperCase();
};

module.exports = {
  generateQRCode,
};
