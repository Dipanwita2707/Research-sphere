/**
 * Draft Controller
 * Handles saving, getting, and deleting drafts
 */
const draftService = require('../services/draft.service');

/**
 * GET /api/v1/mail/drafts
 * Get all drafts for user
 */
exports.getDrafts = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const result = await draftService.getDrafts(req.user.id, {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      data: result.drafts,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error('Get drafts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch drafts' });
  }
};

/**
 * GET /api/v1/mail/drafts/:draftId
 * Get a single draft
 */
exports.getDraft = async (req, res) => {
  try {
    const draft = await draftService.getDraft(req.params.draftId, req.user.id);

    if (!draft) {
      return res.status(404).json({ success: false, message: 'Draft not found' });
    }

    res.json({ success: true, data: draft });
  } catch (error) {
    console.error('Get draft error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch draft' });
  }
};

/**
 * POST /api/v1/mail/drafts
 * Save or update a draft (auto-save)
 */
exports.saveDraft = async (req, res) => {
  try {
    const draft = await draftService.saveDraft(req.user.id, req.body);

    res.status(201).json({
      success: true,
      message: 'Draft saved',
      data: draft,
    });
  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({ success: false, message: 'Failed to save draft' });
  }
};

/**
 * DELETE /api/v1/mail/drafts/:draftId
 * Delete a draft
 */
exports.deleteDraft = async (req, res) => {
  try {
    await draftService.deleteDraft(req.params.draftId, req.user.id);
    res.json({ success: true, message: 'Draft deleted' });
  } catch (error) {
    console.error('Delete draft error:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message || 'Failed to delete draft',
    });
  }
};
