/**
 * Pagination Helper Functions
 * Provides consistent pagination logic across controllers
 */

const { LIMITS } = require('../constants/noting.constants');

/**
 * Parse and sanitize pagination parameters
 * @param {Object} query - Request query object
 * @returns {Object} Sanitized pagination params
 */
function getPaginationParams(query) {
  let page = parseInt(query.page) || 1;
  let limit = parseInt(query.limit) || LIMITS.DEFAULT_PAGE_SIZE;

  // Sanitize values
  page = Math.max(1, page);
  limit = Math.max(1, Math.min(limit, LIMITS.MAX_PAGE_SIZE));

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

/**
 * Create pagination metadata object
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 * @returns {Object} Pagination metadata
 */
function createPaginationMeta(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
}

module.exports = {
  getPaginationParams,
  createPaginationMeta,
};
