/**
 * Presence Service
 * Manages online/offline status and last seen functionality
 */
const prisma = require('../../../shared/config/database');
const cache = require('../../../shared/config/redis');

const ONLINE_USERS_KEY = 'chat:online';
const USER_SOCKET_KEY = 'chat:socket:';

/**
 * Set user as online
 */
const setUserOnline = async (userId, socketId) => {
  await Promise.all([
    // Update database
    prisma.userChatStatus.upsert({
      where: { userId },
      update: {
        isOnline: true,
        socketId,
        lastSeenAt: new Date(),
      },
      create: {
        userId,
        isOnline: true,
        socketId,
        lastSeenAt: new Date(),
      },
    }),
    // Add to Redis set for fast online checks
    cache.sadd(ONLINE_USERS_KEY, userId),
    // Store socket -> user mapping
    cache.set(`${USER_SOCKET_KEY}${socketId}`, userId, 86400), // 24h TTL
  ]);

  return { userId, isOnline: true };
};

/**
 * Set user as offline
 */
const setUserOffline = async (userId, socketId = null) => {
  const now = new Date();

  await Promise.all([
    // Update database
    prisma.userChatStatus.upsert({
      where: { userId },
      update: {
        isOnline: false,
        socketId: null,
        lastSeenAt: now,
      },
      create: {
        userId,
        isOnline: false,
        socketId: null,
        lastSeenAt: now,
      },
    }),
    // Remove from Redis online set
    cache.srem(ONLINE_USERS_KEY, userId),
    // Remove socket mapping if provided
    socketId ? cache.del(`${USER_SOCKET_KEY}${socketId}`) : Promise.resolve(),
  ]);

  return { userId, isOnline: false, lastSeenAt: now };
};

/**
 * Update last seen (heartbeat)
 */
const updateLastSeen = async (userId) => {
  await prisma.userChatStatus.upsert({
    where: { userId },
    update: { lastSeenAt: new Date() },
    create: {
      userId,
      isOnline: true,
      lastSeenAt: new Date(),
    },
  });
};

/**
 * Get user status
 */
const getUserStatus = async (userId, requesterId = null) => {
  const status = await prisma.userChatStatus.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          uid: true,
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

  if (!status) {
    return {
      userId,
      isOnline: false,
      lastSeenAt: null,
      lastSeenVisible: false,
    };
  }

  // Check privacy settings
  let lastSeenVisible = true;
  if (status.lastSeenPrivacy === 'nobody') {
    lastSeenVisible = false;
  } else if (status.lastSeenPrivacy === 'contacts' && requesterId) {
    // For contacts-only, check if they have had any conversation
    const hasConversation = await prisma.directMessage.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: requesterId },
          { senderId: requesterId, receiverId: userId },
        ],
      },
      select: { id: true },
    });
    lastSeenVisible = !!hasConversation;
  }

  return {
    userId,
    isOnline: status.isOnline,
    lastSeenAt: lastSeenVisible ? status.lastSeenAt : null,
    lastSeenVisible,
    user: status.user,
  };
};

/**
 * Get online users from a list
 */
const getOnlineUsers = async (userIds) => {
  // Check Redis first for fast response
  const onlineSet = await cache.smembers(ONLINE_USERS_KEY);
  const onlineUserIds = userIds.filter((id) => onlineSet.includes(id));

  return onlineUserIds;
};

/**
 * Get online status for multiple users
 */
const getBulkUserStatus = async (userIds, requesterId = null) => {
  const statuses = await prisma.userChatStatus.findMany({
    where: { userId: { in: userIds } },
    select: {
      userId: true,
      isOnline: true,
      lastSeenAt: true,
      lastSeenPrivacy: true,
    },
  });

  const statusMap = new Map();
  statuses.forEach((s) => {
    let lastSeenVisible = true;
    if (s.lastSeenPrivacy === 'nobody') {
      lastSeenVisible = false;
    }
    // Note: For bulk operations, we simplify and skip the contacts check

    statusMap.set(s.userId, {
      isOnline: s.isOnline,
      lastSeenAt: lastSeenVisible ? s.lastSeenAt : null,
    });
  });

  // Fill in missing users as offline
  userIds.forEach((id) => {
    if (!statusMap.has(id)) {
      statusMap.set(id, { isOnline: false, lastSeenAt: null });
    }
  });

  return statusMap;
};

/**
 * Get online members for a group
 */
const getGroupOnlineMembers = async (groupId) => {
  const members = await prisma.chatGroupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });

  const userIds = members.map((m) => m.userId);
  const onlineUserIds = await getOnlineUsers(userIds);

  return onlineUserIds;
};

/**
 * Update last seen privacy setting
 */
const updateLastSeenPrivacy = async (userId, privacy) => {
  const validPrivacies = ['everyone', 'contacts', 'nobody'];
  if (!validPrivacies.includes(privacy)) {
    throw new Error('Invalid privacy setting');
  }

  await prisma.userChatStatus.upsert({
    where: { userId },
    update: { lastSeenPrivacy: privacy },
    create: {
      userId,
      lastSeenPrivacy: privacy,
    },
  });

  return { success: true, privacy };
};

/**
 * Get user ID from socket ID
 */
const getUserIdFromSocket = async (socketId) => {
  return await cache.get(`${USER_SOCKET_KEY}${socketId}`);
};

/**
 * Get socket ID for a user
 */
const getSocketIdForUser = async (userId) => {
  const status = await prisma.userChatStatus.findUnique({
    where: { userId },
    select: { socketId: true, isOnline: true },
  });

  return status?.isOnline ? status.socketId : null;
};

/**
 * Clean up stale online status
 * Call this periodically to handle crashed connections
 */
const cleanupStaleStatus = async (maxAgeMinutes = 5) => {
  const threshold = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

  const staleUsers = await prisma.userChatStatus.findMany({
    where: {
      isOnline: true,
      lastSeenAt: { lt: threshold },
    },
    select: { userId: true },
  });

  if (staleUsers.length > 0) {
    await prisma.userChatStatus.updateMany({
      where: {
        userId: { in: staleUsers.map((u) => u.userId) },
      },
      data: {
        isOnline: false,
        socketId: null,
      },
    });

    // Remove from Redis
    await Promise.all(
      staleUsers.map((u) => cache.srem(ONLINE_USERS_KEY, u.userId))
    );
  }

  return staleUsers.length;
};

module.exports = {
  setUserOnline,
  setUserOffline,
  updateLastSeen,
  getUserStatus,
  getOnlineUsers,
  getBulkUserStatus,
  getGroupOnlineMembers,
  updateLastSeenPrivacy,
  getUserIdFromSocket,
  getSocketIdForUser,
  cleanupStaleStatus,
};
