/**
 * User Permission Controller
 * Handles HTTP requests for managing individual user-level chat permissions
 * 
 * Admin-only endpoints for:
 * - Adding users to the chat system (individual or bulk)
 * - Updating user permissions
 * - Removing users from chat
 * - Viewing authorized users
 * - Getting user permission status
 */
const userPermissionService = require('../services/userPermission.service');

/**
 * Get all authorized chat users (paginated, searchable)
 */
const getAuthorizedUsers = async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const result = await userPermissionService.getAuthorizedUsers({
      page: parseInt(page),
      limit: parseInt(limit),
      search,
    });

    res.json({
      success: true,
      data: result.users,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Get authorized users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get authorized users',
    });
  }
};

/**
 * Get a single user's chat permissions
 */
const getUserPermission = async (req, res) => {
  try {
    const { userId } = req.params;
    const perm = await userPermissionService.getUserPermission(userId);

    if (!perm) {
      return res.status(404).json({
        success: false,
        message: 'User not found in chat permission system',
      });
    }

    res.json({
      success: true,
      data: perm,
    });
  } catch (error) {
    console.error('Get user permission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user permission',
    });
  }
};

/**
 * Check current user's own chat access and permissions
 */
const getMyPermissions = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // Admins and superadmins always have full access
    if (userRole === 'admin' || userRole === 'superadmin') {
      return res.json({
        success: true,
        data: {
          hasAccess: true,
          permissions: userPermissionService.DEFAULT_USER_PERMISSIONS,
        },
      });
    }

    const perm = await userPermissionService.getUserPermission(userId);
    const hasAccess = await userPermissionService.hasUserChatAccess(userId);

    res.json({
      success: true,
      data: {
        hasAccess,
        permissions: perm || userPermissionService.DEFAULT_USER_PERMISSIONS,
      },
    });
  } catch (error) {
    console.error('Get my permissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get your permissions',
    });
  }
};

/**
 * Add a single user to the chat system
 */
const addUser = async (req, res) => {
  try {
    const { userId, uid, permissions = {} } = req.body;
    const addedBy = req.user.id;

    if (!userId && !uid) {
      return res.status(400).json({
        success: false,
        message: 'Either userId or uid is required',
      });
    }

    let perm;
    if (uid) {
      perm = await userPermissionService.addUserByUid(uid, permissions, addedBy);
    } else {
      perm = await userPermissionService.addUser(userId, permissions, addedBy);
    }

    res.status(201).json({
      success: true,
      message: 'User added to chat system successfully',
      data: perm,
    });
  } catch (error) {
    console.error('Add user error:', error);
    const status = error.message.includes('not found') ? 404 :
                   error.message.includes('already') ? 409 : 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to add user',
    });
  }
};

/**
 * Bulk add users from a list of identifiers
 */
const bulkAddUsers = async (req, res) => {
  try {
    const addedBy = req.user.id;
    let identifiers = [];
    let permissions = {};

    // Check if it's a CSV file upload or JSON body
    if (req.file) {
      const csvContent = req.file.buffer.toString('utf-8');
      const lines = csvContent.split('\n').filter((line) => line.trim());

      // Skip header if present
      const hasHeader = lines[0].toLowerCase().includes('userid') ||
                        lines[0].toLowerCase().includes('uid') ||
                        lines[0].toLowerCase().includes('email');
      const dataLines = hasHeader ? lines.slice(1) : lines;

      identifiers = dataLines
        .map((line) => line.trim().split(',')[0].trim())
        .filter((id) => id);
    } else if (req.body.identifiers) {
      identifiers = req.body.identifiers;
      permissions = req.body.permissions || {};
    } else {
      return res.status(400).json({
        success: false,
        message: 'Either a CSV file or identifiers array is required',
      });
    }

    if (identifiers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid user identifiers found',
      });
    }

    if (identifiers.length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 5000 users per upload',
      });
    }

    const result = await userPermissionService.bulkAddUsers(identifiers, permissions, addedBy);

    res.json({
      success: true,
      message: `Added ${result.success.length} users, ${result.failed.length} failed, ${result.duplicates.length} duplicates`,
      data: result,
    });
  } catch (error) {
    console.error('Bulk add users error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to bulk add users',
    });
  }
};

/**
 * Update a user's chat permissions
 */
const updateUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body;

    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Permissions object is required',
      });
    }

    const perm = await userPermissionService.updateUserPermissions(userId, permissions);

    res.json({
      success: true,
      message: 'User permissions updated successfully',
      data: perm,
    });
  } catch (error) {
    console.error('Update user permissions error:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message || 'Failed to update user permissions',
    });
  }
};

/**
 * Remove a user from the chat system
 */
const removeUser = async (req, res) => {
  try {
    const { userId } = req.params;
    await userPermissionService.removeUser(userId);

    res.json({
      success: true,
      message: 'User removed from chat system',
    });
  } catch (error) {
    console.error('Remove user error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to remove user',
    });
  }
};

/**
 * Toggle chat access for a user
 */
const toggleUserChat = async (req, res) => {
  try {
    const { userId } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'enabled must be a boolean',
      });
    }

    const perm = await userPermissionService.toggleUserChat(userId, enabled);

    res.json({
      success: true,
      message: `Chat ${enabled ? 'enabled' : 'disabled'} for user`,
      data: perm,
    });
  } catch (error) {
    console.error('Toggle user chat error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to toggle user chat',
    });
  }
};

/**
 * Get chat permission stats
 */
const getStats = async (req, res) => {
  try {
    const stats = await userPermissionService.getStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get stats',
    });
  }
};

/**
 * Search users not already in the chat system
 */
const searchUnaddedUsers = async (req, res) => {
  try {
    const { q = '', limit = 20 } = req.query;
    const users = await userPermissionService.searchUnaddedUsers(q, parseInt(limit));

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Search unadded users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search users',
    });
  }
};

module.exports = {
  getAuthorizedUsers,
  getUserPermission,
  getMyPermissions,
  addUser,
  bulkAddUsers,
  updateUserPermissions,
  removeUser,
  toggleUserChat,
  getStats,
  searchUnaddedUsers,
};
