/**
 * Generate unique Noting ID: SGTU/{ACAD|ADMIN}/{SUBTYPE}/{YEAR}/{RANDOM}
 */
const { CATEGORIES } = require('../config/noting.config');

function generateNotingId(category, subcategory) {
  const prefix = category === 'academic' ? 'ACAD' : 'ADMIN';
  const sub = CATEGORIES[category]?.subcategories?.[subcategory]?.idCode || 'GEN';
  const year = new Date().getFullYear();
  const random = Math.floor(10000 + Math.random() * 90000);
  return `SGTU/${prefix}/${sub}/${year}/${random}`;
}

module.exports = { generateNotingId };
