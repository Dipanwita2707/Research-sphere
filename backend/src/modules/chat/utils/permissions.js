/**
 * Chat Permission System
 * Handles permission checks for chat groups and members
 * 
 * Two-level permission system:
 * 1. User-level (ChatUserPermission): Controls access to chat, DMs, profile, privacy, etc.
 * 2. Group-level (ChatGroupPermission): Controls messaging, files, voice, admin within groups.
 */
const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');

// Default permissions for new groups (GROUP-LEVEL only)
const DEFAULT_PERMISSIONS = {
  canSendMessage: true,
  canUploadFiles: true,
  canSendVoice: true,
  canSendVideo: true,
  canSendEmoji: true,
  canEditMessage: true,
  canDeleteMessage: true,
  canPinMessage: false,
  canMentionAll: false,
  canAddMembers: false,
  canRemoveMembers: false,
  adminOnlyMessaging: false,
  readOnlyMode: false,
  privateDMAllowed: true,
  searchMembers: true,
  maxFileSize: 10485760, // 10MB
};

// Permissions that admins/moderators always have
const ADMIN_PERMISSIONS = [
  'canSendMessage',
  'canUploadFiles',
  'canSendVoice',
  'canSendVideo',
  'canSendEmoji',
  'canEditMessage',
  'canDeleteMessage',
  'canPinMessage',
  'canMentionAll',
  'canAddMembers',
  'canRemoveMembers',
];

const MODERATOR_PERMISSIONS = [
  'canSendMessage',
  'canUploadFiles',
  'canSendVoice',
  'canSendVideo',
  'canSendEmoji',
  'canEditMessage',
  'canDeleteMessage',
  'canPinMessage',
  'canMentionAll',
];

/**
 * Get effective permissions for a user in a group
 * Priority: Member Override > Role Permissions > Group Default > Deny
 */
const getEffectivePermissions = async (groupId, userId) => {
  const cacheKey = `chat:permissions:${groupId}:${userId}`;
  
  // Check cache first
  const cached = await cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Get group permissions and member data
  const [groupPermission, member] = await Promise.all([
    prisma.chatGroupPermission.findUnique({
      where: { groupId },
    }),
    prisma.chatGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    }),
  ]);

  if (!member) {
    return null; // User not a member
  }

  // Start with group default permissions
  const effectivePermissions = { ...DEFAULT_PERMISSIONS };

  // Apply group permissions if set
  if (groupPermission) {
    Object.keys(DEFAULT_PERMISSIONS).forEach((key) => {
      if (groupPermission[key] !== undefined && groupPermission[key] !== null) {
        effectivePermissions[key] = groupPermission[key];
      }
    });
  }

  // Apply role-based overrides
  if (member.memberRole === 'owner' || member.memberRole === 'admin') {
    ADMIN_PERMISSIONS.forEach((perm) => {
      effectivePermissions[perm] = true;
    });
    // Admins bypass adminOnlyMessaging and readOnlyMode
    effectivePermissions.adminOnlyMessaging = false;
    effectivePermissions.readOnlyMode = false;
  } else if (member.memberRole === 'moderator') {
    MODERATOR_PERMISSIONS.forEach((perm) => {
      effectivePermissions[perm] = true;
    });
  }

  // Apply member-specific custom permissions (highest priority)
  if (member.customPermissions) {
    Object.keys(member.customPermissions).forEach((key) => {
      if (effectivePermissions.hasOwnProperty(key)) {
        effectivePermissions[key] = member.customPermissions[key];
      }
    });
  }

  // Handle special cases
  if (effectivePermissions.readOnlyMode && member.memberRole === 'member') {
    effectivePermissions.canSendMessage = false;
    effectivePermissions.canUploadFiles = false;
    effectivePermissions.canSendVoice = false;
    effectivePermissions.canSendVideo = false;
  }

  if (effectivePermissions.adminOnlyMessaging && member.memberRole === 'member') {
    effectivePermissions.canSendMessage = false;
    effectivePermissions.canUploadFiles = false;
    effectivePermissions.canSendVoice = false;
    effectivePermissions.canSendVideo = false;
  }

  // Check if member is muted
  if (member.isMuted) {
    const now = new Date();
    if (!member.mutedUntil || member.mutedUntil > now) {
      effectivePermissions.canSendMessage = false;
      effectivePermissions.canUploadFiles = false;
      effectivePermissions.canSendVoice = false;
      effectivePermissions.canSendVideo = false;
    }
  }

  // Cache for 5 minutes
  await cache.set(cacheKey, JSON.stringify(effectivePermissions), 300);

  return effectivePermissions;
};

/**
 * Check if user has a specific permission in a group
 */
const checkPermission = async (groupId, userId, permissionKey) => {
  const permissions = await getEffectivePermissions(groupId, userId);
  
  if (!permissions) {
    return false; // Not a member
  }

  return permissions[permissionKey] === true;
};

/**
 * Check if user is an admin/owner of the group
 */
const isGroupAdmin = async (groupId, userId) => {
  const member = await prisma.chatGroupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { memberRole: true },
  });

  return member && (member.memberRole === 'owner' || member.memberRole === 'admin');
};

/**
 * Check if user is a member of the group
 */
const isGroupMember = async (groupId, userId) => {
  const member = await prisma.chatGroupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { id: true },
  });

  return !!member;
};

/**
 * Invalidate permission cache for a user in a group
 */
const invalidatePermissionCache = async (groupId, userId = null) => {
  if (userId) {
    await cache.del(`chat:permissions:${groupId}:${userId}`);
  } else {
    // Invalidate all members' permissions when group permissions change
    const members = await prisma.chatGroupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
    
    const keys = members.map((m) => `chat:permissions:${groupId}:${m.userId}`);
    if (keys.length > 0) {
      await Promise.all(keys.map((key) => cache.del(key)));
    }
  }
};

module.exports = {
  DEFAULT_PERMISSIONS,
  getEffectivePermissions,
  checkPermission,
  isGroupAdmin,
  isGroupMember,
  invalidatePermissionCache,
};
