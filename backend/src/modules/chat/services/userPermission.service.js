/**
 * User Permission Service
 * Business logic for managing individual user-level chat permissions
 * 
 * These permissions control:
 * - Whether a user can access the chat application at all
 * - Individual feature access (DMs, group creation, profile photo, etc.)
 * - Privacy, customization, and notification controls
 */
const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');

// Default user-level permissions
const DEFAULT_USER_PERMISSIONS = {
  chatEnabled: true,
  canPrivateMessage: true,
  canCreateGroup: true,
  canUploadProfilePhoto: true,
  canSetLastSeen: true,
  canSetOnlineStatus: true,
  canSetProfilePrivacy: true,
  canSetAboutPrivacy: true,
  canSetStatusPrivacy: true,
  canSetReadReceipts: true,
  canSetMessageTimer: true,
  canSetGroupsPrivacy: true,
  canBlockContacts: true,
  canChangeTheme: true,
  canChangeWallpaper: true,
  canToggleNotifications: true,
};

/**
 * Get user chat permission record (cached)
 */
const getUserPermission = async (userId) => {
  const cacheKey = `chat:user-permission:${userId}`;
  
  const cached = await cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const perm = await prisma.chatUserPermission.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          uid: true,
          email: true,
          role: true,
          profileImage: true,
          employeeDetails: {
            select: { firstName: true, lastName: true, displayName: true },
          },
          studentLogin: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
  });

  if (perm) {
    await cache.set(cacheKey, JSON.stringify(perm), 300);
  }

  return perm;
};

/**
 * Check if a user has chat access (is in the authorized list and enabled)
 */
const hasUserChatAccess = async (userId) => {
  const cacheKey = `chat:user-access:${userId}`;
  
  const cached = await cache.get(cacheKey);
  if (cached !== null && cached !== undefined) {
    return cached === 'true';
  }

  // Check if there are ANY user permissions created (if none exist, allow all - backwards compatibility)
  const totalPermissions = await prisma.chatUserPermission.count();
  
  if (totalPermissions === 0) {
    // No user permissions configured yet - allow all users (backwards compatible)
    await cache.set(cacheKey, 'true', 300);
    return true;
  }

  const perm = await prisma.chatUserPermission.findUnique({
    where: { userId },
    select: { chatEnabled: true },
  });

  const hasAccess = perm?.chatEnabled === true;
  await cache.set(cacheKey, hasAccess.toString(), 300);
  return hasAccess;
};

/**
 * Get all authorized chat users (paginated)
 */
const getAuthorizedUsers = async ({ page = 1, limit = 50, search = '' } = {}) => {
  const skip = (page - 1) * limit;

  const where = search
    ? {
        user: {
          OR: [
            { uid: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            {
              employeeDetails: {
                OR: [
                  { firstName: { contains: search, mode: 'insensitive' } },
                  { lastName: { contains: search, mode: 'insensitive' } },
                ],
              },
            },
            {
              studentLogin: {
                OR: [
                  { firstName: { contains: search, mode: 'insensitive' } },
                  { lastName: { contains: search, mode: 'insensitive' } },
                ],
              },
            },
          ],
        },
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.chatUserPermission.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            uid: true,
            email: true,
            role: true,
            profileImage: true,
            employeeDetails: {
              select: { firstName: true, lastName: true, displayName: true },
            },
            studentLogin: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.chatUserPermission.count({ where }),
  ]);

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Add a single user to the chat system with permissions
 */
const addUser = async (userId, permissions = {}, addedBy = null) => {
  // Verify user exists
  const user = await prisma.userLogin.findUnique({
    where: { id: userId },
    select: { id: true, uid: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Check if already added
  const existing = await prisma.chatUserPermission.findUnique({
    where: { userId },
  });

  if (existing) {
    throw new Error('User already has chat permissions configured');
  }

  // Merge with defaults
  const validKeys = Object.keys(DEFAULT_USER_PERMISSIONS);
  const filteredPermissions = {};
  for (const key of Object.keys(permissions)) {
    if (validKeys.includes(key)) {
      filteredPermissions[key] = permissions[key];
    }
  }

  const perm = await prisma.chatUserPermission.create({
    data: {
      userId,
      ...DEFAULT_USER_PERMISSIONS,
      ...filteredPermissions,
      addedBy,
    },
    include: {
      user: {
        select: {
          id: true,
          uid: true,
          email: true,
          role: true,
          profileImage: true,
          employeeDetails: {
            select: { firstName: true, lastName: true, displayName: true },
          },
          studentLogin: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
  });

  await invalidateUserPermissionCache(userId);
  return perm;
};

/**
 * Add user by UID
 */
const addUserByUid = async (uid, permissions = {}, addedBy = null) => {
  const user = await prisma.userLogin.findFirst({
    where: { uid },
    select: { id: true },
  });

  if (!user) {
    throw new Error(`User with UID '${uid}' not found`);
  }

  return addUser(user.id, permissions, addedBy);
};

/**
 * Bulk add users from a list of UIDs/emails
 */
const bulkAddUsers = async (identifiers, permissions = {}, addedBy = null) => {
  const results = {
    success: [],
    failed: [],
    duplicates: [],
  };

  // Find all users by uid or email
  const users = await prisma.userLogin.findMany({
    where: {
      OR: [
        { uid: { in: identifiers } },
        { email: { in: identifiers.map((id) => id.toLowerCase()) } },
      ],
    },
    select: { id: true, uid: true, email: true },
  });

  const userMap = new Map();
  users.forEach((user) => {
    userMap.set(user.uid, user);
    if (user.email) {
      userMap.set(user.email.toLowerCase(), user);
    }
  });

  // Get existing permissions
  const existingPerms = await prisma.chatUserPermission.findMany({
    select: { userId: true },
  });
  const existingUserIds = new Set(existingPerms.map((p) => p.userId));

  // Merge permissions with defaults
  const validKeys = Object.keys(DEFAULT_USER_PERMISSIONS);
  const filteredPermissions = {};
  for (const key of Object.keys(permissions)) {
    if (validKeys.includes(key)) {
      filteredPermissions[key] = permissions[key];
    }
  }

  const toCreate = [];
  const processedUserIds = new Set();

  for (const identifier of identifiers) {
    const user = userMap.get(identifier) || userMap.get(identifier.toLowerCase());

    if (!user) {
      results.failed.push({ identifier, reason: 'User not found' });
      continue;
    }

    if (existingUserIds.has(user.id) || processedUserIds.has(user.id)) {
      results.duplicates.push({ identifier, userId: user.id, uid: user.uid });
      continue;
    }

    toCreate.push({
      userId: user.id,
      ...DEFAULT_USER_PERMISSIONS,
      ...filteredPermissions,
      addedBy,
    });
    processedUserIds.add(user.id);
    results.success.push({ identifier, userId: user.id, uid: user.uid });
  }

  // Bulk create
  if (toCreate.length > 0) {
    await prisma.chatUserPermission.createMany({
      data: toCreate,
      skipDuplicates: true,
    });

    // Invalidate cache for all added users
    await Promise.all(
      toCreate.map((p) => invalidateUserPermissionCache(p.userId))
    );
  }

  return results;
};

/**
 * Update a user's chat permissions
 */
const updateUserPermissions = async (userId, permissions) => {
  const validKeys = Object.keys(DEFAULT_USER_PERMISSIONS);
  const filteredPermissions = {};
  for (const key of Object.keys(permissions)) {
    if (validKeys.includes(key)) {
      filteredPermissions[key] = permissions[key];
    }
  }

  const perm = await prisma.chatUserPermission.update({
    where: { userId },
    data: filteredPermissions,
    include: {
      user: {
        select: {
          id: true,
          uid: true,
          email: true,
          role: true,
          profileImage: true,
          employeeDetails: {
            select: { firstName: true, lastName: true, displayName: true },
          },
          studentLogin: {
            select: { firstName: true, lastName: true },
          },
        },
      },
    },
  });

  await invalidateUserPermissionCache(userId);
  return perm;
};

/**
 * Remove a user from the chat system
 */
const removeUser = async (userId) => {
  await prisma.chatUserPermission.delete({
    where: { userId },
  });
  await invalidateUserPermissionCache(userId);
  return { success: true };
};

/**
 * Enable/disable chat for a user
 */
const toggleUserChat = async (userId, enabled) => {
  const perm = await prisma.chatUserPermission.update({
    where: { userId },
    data: { chatEnabled: enabled },
  });
  await invalidateUserPermissionCache(userId);
  return perm;
};

/**
 * Get user permission stats
 */
const getStats = async () => {
  const [total, enabled, disabled] = await Promise.all([
    prisma.chatUserPermission.count(),
    prisma.chatUserPermission.count({ where: { chatEnabled: true } }),
    prisma.chatUserPermission.count({ where: { chatEnabled: false } }),
  ]);

  return { total, enabled, disabled };
};

/**
 * Search users not yet added to chat permissions
 */
const searchUnaddedUsers = async (query, limit = 20) => {
  // Get all existing permission user IDs
  const existingPerms = await prisma.chatUserPermission.findMany({
    select: { userId: true },
  });
  const existingUserIds = existingPerms.map((p) => p.userId);

  const users = await prisma.userLogin.findMany({
    where: {
      id: { notIn: existingUserIds.length > 0 ? existingUserIds : ['none'] },
      OR: [
        { uid: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        {
          employeeDetails: {
            OR: [
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
            ],
          },
        },
        {
          studentLogin: {
            OR: [
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
            ],
          },
        },
      ],
    },
    select: {
      id: true,
      uid: true,
      email: true,
      role: true,
      profileImage: true,
      employeeDetails: {
        select: { firstName: true, lastName: true, displayName: true },
      },
      studentLogin: {
        select: { firstName: true, lastName: true },
      },
    },
    take: limit,
  });

  return users;
};

/**
 * Invalidate user permission cache
 */
const invalidateUserPermissionCache = async (userId) => {
  await Promise.all([
    cache.del(`chat:user-permission:${userId}`),
    cache.del(`chat:user-access:${userId}`),
  ]);
};

module.exports = {
  DEFAULT_USER_PERMISSIONS,
  getUserPermission,
  hasUserChatAccess,
  getAuthorizedUsers,
  addUser,
  addUserByUid,
  bulkAddUsers,
  updateUserPermissions,
  removeUser,
  toggleUserChat,
  getStats,
  searchUnaddedUsers,
  invalidateUserPermissionCache,
};
