/**
 * Pagination Helper Functions
 * Provides consistent pagination logic across controllers
 * Supports both offset-based and cursor-based pagination.
 */

const { LIMITS } = require('../constants/noting.constants');

/**
 * Parse and sanitize pagination parameters (offset-based)
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
 * Parse cursor-based pagination parameters.
 * Uses `cursor` (last item ID) + `take` (page size) instead of page/skip.
 *
 * Why cursor > offset for large tables:
 *   - OFFSET N forces the DB to scan N rows before returning results.
 *   - Cursor uses an indexed  WHERE id < ?  which is O(log N).
 *   - On Neon serverless the difference is 200-800ms for page > 5.
 *
 * @param {Object} query - Request query object
 * @returns {Object} { cursor, take, useCursor }
 */
function getCursorPaginationParams(query) {
  const cursor = query.cursor || null;
  let take = parseInt(query.limit) || LIMITS.DEFAULT_PAGE_SIZE;
  take = Math.max(1, Math.min(take, LIMITS.MAX_PAGE_SIZE));

  return {
    cursor,
    take,
    useCursor: !!cursor,
  };
}

/**
 * Build Prisma cursor pagination args
 * @param {string|null} cursor - UUID of last item (null for first page)
 * @param {number} take - Number of items to fetch
 * @param {string} orderField - Field to order by (default: 'updatedAt')
 * @returns {Object} Prisma args { take, ...(cursor ? { skip: 1, cursor: { id } } : {}) }
 */
function buildCursorArgs(cursor, take, orderField = 'updatedAt') {
  if (!cursor) {
    return { take };
  }
  return {
    take,
    skip: 1, // Skip the cursor item itself
    cursor: { id: cursor },
  };
}

/**
 * Create pagination metadata object (offset-based)
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

/**
 * Create cursor-based pagination metadata
 * @param {Array} items - Fetched items
 * @param {number} take - Requested page size
 * @param {number|null} total - Total count (null = not computed)
 * @returns {Object} Cursor pagination metadata
 */
function createCursorPaginationMeta(items, take, total = null) {
  const hasNextPage = items.length === take;
  const nextCursor = hasNextPage && items.length > 0
    ? items[items.length - 1].id
    : null;

  return {
    nextCursor,
    hasNextPage,
    limit: take,
    ...(total !== null ? { total } : {}),
  };
}

module.exports = {
  getPaginationParams,
  getCursorPaginationParams,
  buildCursorArgs,
  createPaginationMeta,
  createCursorPaginationMeta,
};
