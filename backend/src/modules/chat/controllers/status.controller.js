/**
 * Status Controller
 * Handles HTTP requests for online/offline status and last seen
 */
const presenceService = require('../services/presence.service');

/**
 * Get user status
 */
const getUserStatus = async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const requesterId = req.user.id;

    const status = await presenceService.getUserStatus(targetUserId, requesterId);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Get user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user status',
    });
  }
};

/**
 * Get bulk user status
 */
const getBulkStatus = async (req, res) => {
  try {
    const { userIds } = req.body;
    const requesterId = req.user.id;

    if (!userIds || !Array.isArray(userIds)) {
      return res.status(400).json({
        success: false,
        message: 'User IDs array is required',
      });
    }

    const statusMap = await presenceService.getBulkUserStatus(userIds, requesterId);
    
    // Convert Map to object for JSON response
    const statuses = {};
    statusMap.forEach((value, key) => {
      statuses[key] = value;
    });

    res.json({
      success: true,
      data: statuses,
    });
  } catch (error) {
    console.error('Get bulk status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user statuses',
    });
  }
};

/**
 * Get online members for a group
 */
const getGroupOnlineMembers = async (req, res) => {
  try {
    const { groupId } = req.params;

    const onlineUserIds = await presenceService.getGroupOnlineMembers(groupId);

    res.json({
      success: true,
      data: {
        groupId,
        onlineUserIds,
        count: onlineUserIds.length,
      },
    });
  } catch (error) {
    console.error('Get group online members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get online members',
    });
  }
};

/**
 * Update privacy settings
 */
const updatePrivacy = async (req, res) => {
  try {
    const userId = req.user.id;
    const { lastSeenPrivacy } = req.body;

    if (!lastSeenPrivacy) {
      return res.status(400).json({
        success: false,
        message: 'Privacy setting is required',
      });
    }

    const result = await presenceService.updateLastSeenPrivacy(userId, lastSeenPrivacy);

    res.json({
      success: true,
      message: 'Privacy settings updated',
      data: result,
    });
  } catch (error) {
    console.error('Update privacy error:', error);
    res.status(error.message.includes('Invalid') ? 400 : 500).json({
      success: false,
      message: error.message || 'Failed to update privacy settings',
    });
  }
};

/**
 * Get my privacy settings
 */
const getPrivacy = async (req, res) => {
  try {
    const userId = req.user.id;

    const status = await presenceService.getUserStatus(userId);

    res.json({
      success: true,
      data: {
        lastSeenPrivacy: status.lastSeenPrivacy || 'everyone',
      },
    });
  } catch (error) {
    console.error('Get privacy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get privacy settings',
    });
  }
};

module.exports = {
  getUserStatus,
  getBulkStatus,
  getGroupOnlineMembers,
  updatePrivacy,
  getPrivacy,
};
