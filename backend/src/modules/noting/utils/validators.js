/**
 * Input Validation Utilities for Noting System
 * Provides reusable validation functions
 */

const { ValidationError } = require('../../../shared/utils/AppError');
const { LIMITS } = require('../constants/noting.constants');
const { CATEGORIES } = require('../config/noting.config');

/**
 * Validate description field
 * @param {string} description - Description text
 * @param {boolean} required - Whether description is required
 * @returns {string} Trimmed description
 * @throws {ValidationError} If validation fails
 */
function validateDescription(description, required = false) {
  const desc = String(description || '').trim();

  if (required && !desc) {
    throw new ValidationError('Description is required');
  }

  if (desc) {
    const wordCount = desc.split(/\s+/).filter(Boolean).length;
    if (wordCount > LIMITS.DESCRIPTION_MAX_WORDS) {
      throw new ValidationError(
        `Description must be at most ${LIMITS.DESCRIPTION_MAX_WORDS} words (current: ${wordCount})`
      );
    }
  }

  return desc;
}

/**
 * Validate category and subcategory
 * @param {string} category - Category value
 * @param {string} subcategory - Subcategory value
 * @throws {ValidationError} If validation fails
 */
function validateCategory(category, subcategory) {
  if (!category || !subcategory) {
    throw new ValidationError('Category and subcategory are required');
  }

  const validCategories = Object.keys(CATEGORIES);
  if (!validCategories.includes(category)) {
    throw new ValidationError(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
  }

  const validSubcategories = Object.keys(CATEGORIES[category].subcategories);
  if (!validSubcategories.includes(subcategory)) {
    throw new ValidationError(
      `Invalid subcategory for ${category}. Must be one of: ${validSubcategories.join(', ')}`
    );
  }
}

/**
 * Sanitize and validate attachments array
 * @param {Array} attachmentsPayload - Raw attachments array from request
 * @returns {Array} Validated attachments array
 */
function sanitizeAttachments(attachmentsPayload) {
  if (!Array.isArray(attachmentsPayload)) {
    return [];
  }

  return attachmentsPayload
    .filter((a) => a && (a.filePath || a.fileName))
    .map((a) => ({
      filePath: String(a.filePath || '')
        .trim()
        .slice(0, LIMITS.FILE_PATH_MAX_LENGTH),
      fileName: String(a.fileName || a.filePath || 'attachment')
        .trim()
        .slice(0, LIMITS.FILE_NAME_MAX_LENGTH),
      fileDescription: a.fileDescription
        ? String(a.fileDescription).trim().slice(0, LIMITS.FILE_DESCRIPTION_MAX_LENGTH)
        : null,
    }))
    .filter((a) => a.filePath);
}

/**
 * Sanitize points array
 * @param {Array} points - Points array from request
 * @returns {Array} Validated points array with sort order
 */
function sanitizePoints(points) {
  if (!Array.isArray(points)) {
    return [];
  }

  const trimmed = points
    .map((content) => String(content).trim())
    .filter(Boolean);

  // Dedupe while preserving order (defensive against duplicate sends)
  const seen = new Set();
  const unique = [];
  for (const c of trimmed) {
    if (seen.has(c)) continue;
    seen.add(c);
    unique.push(c);
  }

  return unique.map((content, index) => ({
    sortOrder: index + 1,
    content,
  }));
}

/**
 * Parse policy compliance value
 * @param {string} value - Policy compliance value ('yes', 'no', or anything else)
 * @returns {boolean|null} Boolean or null
 */
function parsePolicyCompliance(value) {
  if (value === 'yes') return true;
  if (value === 'no') return false;
  return null;
}

const { sanitizeSponsors } = require('../../../shared/utils/validators');

/** Alias for shared sponsor sanitization (Cash: amount, In-kind: notes) */
function sanitizeEventSponsors(sponsors) {
  return sanitizeSponsors(sponsors);
}

module.exports = {
  validateDescription,
  validateCategory,
  sanitizeAttachments,
  sanitizePoints,
  parsePolicyCompliance,
  sanitizeEventSponsors,
};
