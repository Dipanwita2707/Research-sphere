/**
 * Search Controller
 * Handles mail search with filters
 */
const { searchMail } = require('../services/search.service');
const { searchUsersForMail } = require('../services/recipient.service');

/**
 * GET /api/v1/mail/search
 * Search mail by query, sender, attachments, date range, label
 */
exports.search = async (req, res) => {
  try {
    const { q, from, to, hasAttachments, dateFrom, dateTo, labelId, page = 1, limit = 20 } = req.query;

    if (!q && !from && !to && !labelId && !dateFrom && !dateTo && !hasAttachments) {
      return res.status(400).json({
        success: false,
        message: 'At least one search parameter is required',
      });
    }

    const result = await searchMail(req.user.id, {
      q,
      from,
      to,
      hasAttachments,
      dateFrom,
      dateTo,
      labelId,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      data: {
        threads: result.threads,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      },
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, message: 'Search failed' });
  }
};

/**
 * GET /api/v1/mail/search/users/:query
 * Search users for recipient selection (fast typeahead)
 */
exports.searchUsers = async (req, res) => {
  try {
    const { query } = req.params;
    const { includeGroups } = req.query;

    if (!query || query.length < 2) {
      return res.json({ success: true, data: [] });
    }

    const results = await searchUsersForMail(
      query,
      req.user.role,
      includeGroups === 'true'
    );

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ success: false, message: 'User search failed' });
  }
};

/**
 * GET /api/v1/mail/search/groups
 * Return all departments, schools, and central departments for group mail browsing.
 * Only accessible to non-student users.
 */
exports.getAllGroups = async (req, res) => {
  try {
    if (req.user.role === 'student') {
      return res.status(403).json({ success: false, message: 'Students cannot send group mail' });
    }

    const { getAllMailGroups } = require('../services/recipient.service');
    const groups = await getAllMailGroups();
    res.json({ success: true, data: groups });
  } catch (error) {
    console.error('Get all groups error:', error);
    res.status(500).json({ success: false, message: 'Failed to load groups' });
  }
};
