/**
 * QR Code Generation Utility
 */

const crypto = require('crypto');

/**
 * Generate a unique QR code for event registration
 * Format: EVT-{eventId}-{timestamp}-{randomHash}
 */
const generateQRCode = (eventId, userId) => {
  const timestamp = Date.now();
  const randomData = `${eventId}-${userId}-${timestamp}-${crypto.randomBytes(8).toString('hex')}`;
  const hash = crypto.createHash('sha256').update(randomData).digest('hex').substring(0, 16);
  
  return `${eventId}-${timestamp}-${hash}`.toUpperCase();
};

/**
 * Validate QR code format
 */
const isValidQRCodeFormat = (qrCode) => {
  // Basic format validation
  const pattern = /^EVT-\d{4}-\d{4}-\d+-[A-F0-9]{16}$/;
  return pattern.test(qrCode);
};

module.exports = {
  generateQRCode,
  isValidQRCodeFormat,
};
