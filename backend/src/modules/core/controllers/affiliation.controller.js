const affiliationService = require('../services/affiliation.service');
const log = require('../../../shared/utils/logger');

/**
 * GET /affiliation/variants
 * Returns the current user's tenant university's canonical name, the full
 * set of algorithmically-generated affiliation variants, and a suggested
 * display affiliation string for the user — used by the Settings page and
 * author/contribution forms to auto-fill affiliation instead of a hardcoded
 * university name.
 */
exports.getMyAffiliationVariants = async (req, res) => {
  try {
    const result = await affiliationService.suggestAffiliationForUser(req.user.id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    log.error('Get affiliation variants error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch affiliation variants' });
  }
};
