/**
 * Generate unique Noting ID: SGTU/{ACAD|ADMIN}/{SUBTYPE}/{YEAR}/{RANDOM}
 * Uses crypto.randomInt for cryptographically secure random numbers
 */
const { randomInt } = require('crypto');
const { CATEGORIES } = require('../config/noting.config');

function generateNotingId(category, subcategory) {
  const prefix = category === 'academic' ? 'ACAD' : 'ADMIN';
  const sub = CATEGORIES[category]?.subcategories?.[subcategory]?.idCode || 'GEN';
  const year = new Date().getFullYear();
  const random = randomInt(10000, 100000); // 5-digit, cryptographically secure
  return `SGTU/${prefix}/${sub}/${year}/${random}`;
}

module.exports = { generateNotingId };
