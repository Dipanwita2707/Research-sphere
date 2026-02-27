/**
 * Group Controller
 * Handles HTTP requests for chat group management
 */
const groupService = require('../services/group.service');
const { isGroupMember, getEffectivePermissions } = require('../utils/permissions');

/**
 * Create a new group
 */
const createGroup = async (req, res) => {
  try {
    const { name, description, isEncrypted, initialMembers, permissions } = req.body;
    const userId = req.user.id;

    if (!name || name.length < 3 || name.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Group name must be between 3 and 100 characters',
      });
    }

    const group = await groupService.createGroup({
      name,
      description,
      createdById: userId,
      isEncrypted: isEncrypted || false,
      initialMembers: initialMembers || [],
      permissions: permissions || {},
    });

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      data: group,
    });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create group',
    });
  }
};

/**
 * Get user's groups
 */
const getMyGroups = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 50 } = req.query;

    const result = await groupService.getUserGroups(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json({
      success: true,
      data: result.groups,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get groups',
    });
  }
};

/**
 * Get group by ID
 */
const getGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check membership
    const isMember = await isGroupMember(id, userId);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group',
      });
    }

    const group = await groupService.getGroupById(id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found',
      });
    }

    // Get user's permissions
    const myPermissions = await getEffectivePermissions(id, userId);

    res.json({
      success: true,
      data: {
        ...group,
        myPermissions,
      },
    });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get group',
    });
  }
};

/**
 * Update group
 */
const updateGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, description, avatar } = req.body;

    const group = await groupService.updateGroup(id, userId, {
      name,
      description,
      avatar,
    });

    res.json({
      success: true,
      message: 'Group updated successfully',
      data: group,
    });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(error.message.includes('Only admins') ? 403 : 500).json({
      success: false,
      message: error.message || 'Failed to update group',
    });
  }
};

/**
 * Delete group
 */
const deleteGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userType = req.user.userType;

    await groupService.deleteGroup(id, userId, userType);

    res.json({
      success: true,
      message: 'Group deleted successfully',
    });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(error.message.includes('Only') ? 403 : 500).json({
      success: false,
      message: error.message || 'Failed to delete group',
    });
  }
};

/**
 * Add member to group
 */
const addMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId: targetUserId, role } = req.body;
    const addedBy = req.user.id;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const member = await groupService.addMember(id, targetUserId, addedBy, role);

    res.status(201).json({
      success: true,
      message: 'Member added successfully',
      data: member,
    });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(error.message.includes('Only admins') ? 403 : 500).json({
      success: false,
      message: error.message || 'Failed to add member',
    });
  }
};

/**
 * Bulk add members from CSV
 */
const bulkAddMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const addedBy = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'CSV file is required',
      });
    }

    // Parse CSV content
    const csvContent = req.file.buffer.toString('utf-8');
    const lines = csvContent.split('\n').filter((line) => line.trim());
    
    // Skip header if present
    const hasHeader = lines[0].toLowerCase().includes('userid') || 
                      lines[0].toLowerCase().includes('uid') ||
                      lines[0].toLowerCase().includes('email');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const userIdentifiers = dataLines
      .map((line) => line.trim().split(',')[0].trim())
      .filter((id) => id);

    if (userIdentifiers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid user identifiers found in CSV',
      });
    }

    if (userIdentifiers.length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 5000 users per upload',
      });
    }

    const result = await groupService.bulkAddMembers(id, userIdentifiers, addedBy);

    res.json({
      success: true,
      message: `Added ${result.success.length} members`,
      data: result,
    });
  } catch (error) {
    console.error('Bulk add members error:', error);
    res.status(error.message.includes('Only admins') ? 403 : 500).json({
      success: false,
      message: error.message || 'Failed to bulk add members',
    });
  }
};

/**
 * Remove member from group
 */
const removeMember = async (req, res) => {
  try {
    const { id, userId: targetUserId } = req.params;
    const removedBy = req.user.id;

    await groupService.removeMember(id, targetUserId, removedBy);

    res.json({
      success: true,
      message: 'Member removed successfully',
    });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(error.message.includes('permission') ? 403 : 500).json({
      success: false,
      message: error.message || 'Failed to remove member',
    });
  }
};

/**
 * Update member role
 */
const updateMemberRole = async (req, res) => {
  try {
    const { id, userId: targetUserId } = req.params;
    const { role } = req.body;
    const updatedBy = req.user.id;
    const updaterUserType = req.user.userType;

    if (!['admin', 'moderator', 'member'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be admin, moderator, or member',
      });
    }

    const member = await groupService.updateMemberRole(id, targetUserId, role, updatedBy, updaterUserType);

    res.json({
      success: true,
      message: 'Member role updated successfully',
      data: member,
    });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(error.message.includes('owner') ? 403 : 500).json({
      success: false,
      message: error.message || 'Failed to update member role',
    });
  }
};

/**
 * Update member custom permissions
 */
const updateMemberPermissions = async (req, res) => {
  try {
    const { id, userId: targetUserId } = req.params;
    const { permissions } = req.body;
    const updatedBy = req.user.id;
    const updaterUserType = req.user.userType;

    const member = await groupService.updateMemberPermissions(id, targetUserId, permissions, updatedBy, updaterUserType);

    res.json({
      success: true,
      message: 'Member permissions updated successfully',
      data: member,
    });
  } catch (error) {
    console.error('Update member permissions error:', error);
    res.status(error.message.includes('Only admins') ? 403 : 500).json({
      success: false,
      message: error.message || 'Failed to update member permissions',
    });
  }
};

/**
 * Update group permissions
 */
const updateGroupPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;
    const updatedBy = req.user.id;
    const updaterUserType = req.user.userType;

    const groupPermission = await groupService.updateGroupPermissions(id, permissions, updatedBy, updaterUserType);

    res.json({
      success: true,
      message: 'Group permissions updated successfully',
      data: groupPermission,
    });
  } catch (error) {
    console.error('Update group permissions error:', error);
    res.status(error.message.includes('Only admins') ? 403 : 500).json({
      success: false,
      message: error.message || 'Failed to update group permissions',
    });
  }
};

/**
 * Search group members
 */
const searchMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const { q, limit = 20 } = req.query;
    const userId = req.user.id;

    // Check membership
    const isMember = await isGroupMember(id, userId);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this group',
      });
    }

    const members = await groupService.searchGroupMembers(id, q || '', parseInt(limit));

    res.json({
      success: true,
      data: members,
    });
  } catch (error) {
    console.error('Search members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search members',
    });
  }
};

/**
 * Mute a member
 */
const muteMember = async (req, res) => {
  try {
    const { id, userId: targetUserId } = req.params;
    const { duration } = req.body; // Duration in minutes
    const mutedBy = req.user.id;

    let mutedUntil = null;
    if (duration) {
      mutedUntil = new Date(Date.now() + duration * 60 * 1000);
    }

    const member = await groupService.muteMember(id, targetUserId, mutedUntil, mutedBy);

    res.json({
      success: true,
      message: 'Member muted successfully',
      data: member,
    });
  } catch (error) {
    console.error('Mute member error:', error);
    res.status(error.message.includes('Only admins') ? 403 : 500).json({
      success: false,
      message: error.message || 'Failed to mute member',
    });
  }
};

/**
 * Unmute a member
 */
const unmuteMember = async (req, res) => {
  try {
    const { id, userId: targetUserId } = req.params;
    const unmutedBy = req.user.id;

    const member = await groupService.unmuteMember(id, targetUserId, unmutedBy);

    res.json({
      success: true,
      message: 'Member unmuted successfully',
      data: member,
    });
  } catch (error) {
    console.error('Unmute member error:', error);
    res.status(error.message.includes('Only admins') ? 403 : 500).json({
      success: false,
      message: error.message || 'Failed to unmute member',
    });
  }
};

/**
 * Leave group
 */
const leaveGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await groupService.removeMember(id, userId, userId);

    res.json({
      success: true,
      message: 'Left group successfully',
    });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to leave group',
    });
  }
};

module.exports = {
  createGroup,
  getMyGroups,
  getGroup,
  updateGroup,
  deleteGroup,
  addMember,
  bulkAddMembers,
  removeMember,
  updateMemberRole,
  updateMemberPermissions,
  updateGroupPermissions,
  searchMembers,
  muteMember,
  unmuteMember,
  leaveGroup,
};
