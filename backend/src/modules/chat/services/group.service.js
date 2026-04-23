/**
 * Group Service
 * Business logic for chat group management
 */
const prisma = require('../../../shared/config/database');
const { DEFAULT_PERMISSIONS, invalidatePermissionCache, isGroupAdmin, getEffectivePermissions } = require('../utils/permissions');
const cache = require('../../../shared/config/redis');

/**
 * Create a new chat group
 */
const createGroup = async ({ name, description, createdById, isEncrypted = false, initialMembers = [], permissions = {} }) => {
  const group = await prisma.$transaction(async (tx) => {
    // Create the group
    const newGroup = await tx.chatGroup.create({
      data: {
        name,
        description,
        createdById,
        isEncrypted,
      },
    });

    // Create permissions with defaults merged with custom permissions
    // Filter out any keys that aren't valid permission fields
    const validPermissionKeys = Object.keys(DEFAULT_PERMISSIONS);
    const filteredPermissions = {};
    for (const key of Object.keys(permissions)) {
      if (validPermissionKeys.includes(key)) {
        filteredPermissions[key] = permissions[key];
      }
    }

    await tx.chatGroupPermission.create({
      data: {
        groupId: newGroup.id,
        ...DEFAULT_PERMISSIONS,
        ...filteredPermissions,
      },
    });

    // Add creator as owner
    await tx.chatGroupMember.create({
      data: {
        groupId: newGroup.id,
        userId: createdById,
        memberRole: 'owner',
      },
    });

    // Add initial members if provided (initialMembers can be UIDs, empIds, or emails)
    if (initialMembers.length > 0) {
      // Resolve by uid OR empId (via employeeDetails) OR email — gracefully skip any not found
      const users = await tx.userLogin.findMany({
        where: {
          OR: [
            { uid: { in: initialMembers } },
            { employeeDetails: { empId: { in: initialMembers } } },
            { email: { in: initialMembers.map((id) => id.toLowerCase()) } },
          ],
        },
        select: {
          id: true,
          uid: true,
        },
      });

      const memberData = users
        .filter((user) => user.id !== createdById)
        .map((user) => ({
          groupId: newGroup.id,
          userId: user.id,
          memberRole: 'member',
        }));

      if (memberData.length > 0) {
        await tx.chatGroupMember.createMany({
          data: memberData,
          skipDuplicates: true,
        });
      }
    }

    return newGroup;
  });

  return getGroupById(group.id);
};

/**
 * Get group by ID with members and permissions
 */
const getGroupById = async (groupId, includeMembers = true) => {
  const group = await prisma.chatGroup.findUnique({
    where: { id: groupId },
    include: {
      createdBy: {
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
      permissions: true,
      members: includeMembers
        ? {
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
                  chatStatus: {
                    select: { isOnline: true, lastSeenAt: true, lastSeenPrivacy: true },
                  },
                },
              },
            },
            orderBy: [
              { memberRole: 'asc' },
              { joinedAt: 'asc' },
            ],
          }
        : false,
      _count: {
        select: { messages: true, members: true },
      },
    },
  });

  return group;
};

/**
 * Get user's groups with unread counts
 */
const getUserGroups = async (userId, { page = 1, limit = 50 } = {}) => {
  const skip = (page - 1) * limit;

  const [groups, total] = await Promise.all([
    prisma.chatGroup.findMany({
      where: {
        isActive: true,
        members: {
          some: { userId },
        },
      },
      include: {
        permissions: {
          select: { adminOnlyMessaging: true, readOnlyMode: true },
        },
        members: {
          where: { userId },
          select: { memberRole: true, isMuted: true },
        },
        _count: {
          select: { members: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            messageType: true,
            createdAt: true,
            sender: {
              select: {
                id: true,
                employeeDetails: { select: { firstName: true } },
                studentLogin: { select: { firstName: true } },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.chatGroup.count({
      where: {
        isActive: true,
        members: { some: { userId } },
      },
    }),
  ]);

  // Get online member counts, myRole, and myPermissions for each group
  const groupsWithOnlineCount = await Promise.all(
    groups.map(async (group) => {
      const onlineCount = await getGroupOnlineMemberCount(group.id);
      const myPermissions = await getEffectivePermissions(group.id, userId);
      return {
        ...group,
        onlineMemberCount: onlineCount,
        lastMessage: group.messages[0] || null,
        myRole: group.members[0]?.memberRole || 'member',
        myPermissions: myPermissions,
        isMuted: group.members[0]?.isMuted || false,
      };
    })
  );

  return {
    groups: groupsWithOnlineCount,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Update group details
 */
const updateGroup = async (groupId, userId, { name, description, avatar }) => {
  const isAdmin = await isGroupAdmin(groupId, userId);
  if (!isAdmin) {
    throw new Error('Only admins can update group details');
  }

  const group = await prisma.chatGroup.update({
    where: { id: groupId },
    data: {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(avatar !== undefined && { avatar }),
    },
  });

  return getGroupById(group.id);
};

/**
 * Delete/deactivate group
 * Permission: System admin can delete any group, group admin can delete if allowed
 */
const deleteGroup = async (groupId, userId, userType) => {
  // System admin (platform level) can delete any group
  if (userType === 'admin' || userType === 'superadmin') {
    await prisma.chatGroup.update({
      where: { id: groupId },
      data: { isActive: false },
    });
    return { success: true };
  }

  // For non-system admins, check group membership and role
  const member = await prisma.chatGroupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { memberRole: true, customPermissions: true },
  });

  if (!member) {
    throw new Error('You are not a member of this group');
  }

  // Group admin can delete if they have canDeleteGroup permission in customPermissions
  if (member.memberRole === 'admin') {
    const canDelete = member.customPermissions?.canDeleteGroup === true;
    if (!canDelete) {
      throw new Error('You do not have permission to delete this group. Contact the system admin.');
    }

    await prisma.chatGroup.update({
      where: { id: groupId },
      data: { isActive: false },
    });
    return { success: true };
  }

  throw new Error('Only system admins or authorized group admins can delete groups');
};

/**
 * Add member to group
 */
const addMember = async (groupId, userId, addedBy, role = 'member') => {
  const isAdmin = await isGroupAdmin(groupId, addedBy);
  if (!isAdmin) {
    throw new Error('Only admins can add members');
  }

  // Check if user exists
  const user = await prisma.userLogin.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const member = await prisma.chatGroupMember.create({
    data: {
      groupId,
      userId,
      memberRole: role,
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

  // Update group timestamp
  await prisma.chatGroup.update({
    where: { id: groupId },
    data: { updatedAt: new Date() },
  });

  return member;
};

/**
 * Remove member from group
 */
const removeMember = async (groupId, userId, removedBy) => {
  const [removerMember, targetMember] = await Promise.all([
    prisma.chatGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId: removedBy } },
      select: { memberRole: true },
    }),
    prisma.chatGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { memberRole: true },
    }),
  ]);

  // Check permissions
  if (!removerMember) {
    throw new Error('You are not a member of this group');
  }

  if (!targetMember) {
    throw new Error('Target user is not a member of this group');
  }

  // Only owner can remove admins, admins can remove moderators and members
  const roleHierarchy = { owner: 4, admin: 3, moderator: 2, member: 1 };
  if (roleHierarchy[removerMember.memberRole] <= roleHierarchy[targetMember.memberRole]) {
    if (userId !== removedBy) {
      throw new Error('Insufficient permissions to remove this member');
    }
  }

  // Owner cannot be removed (must transfer ownership first)
  if (targetMember.memberRole === 'owner' && userId !== removedBy) {
    throw new Error('Cannot remove the group owner');
  }

  await prisma.chatGroupMember.delete({
    where: { groupId_userId: { groupId, userId } },
  });

  await invalidatePermissionCache(groupId, userId);

  return { success: true };
};

/**
 * Update member role
 * System admin (userType = 'admin') can change roles in any group
 */
const updateMemberRole = async (groupId, userId, newRole, updatedBy, updaterUserType) => {
  // System admin bypass
  if (updaterUserType !== 'admin' && updaterUserType !== 'superadmin') {
    const updaterMember = await prisma.chatGroupMember.findUnique({
      where: { groupId_userId: { groupId, userId: updatedBy } },
      select: { memberRole: true },
    });

    if (!updaterMember || updaterMember.memberRole !== 'owner') {
      throw new Error('Only the owner or system admin can change member roles');
    }
  }

  // Cannot change owner role directly
  if (newRole === 'owner') {
    throw new Error('Use transferOwnership to transfer ownership');
  }

  const member = await prisma.chatGroupMember.update({
    where: { groupId_userId: { groupId, userId } },
    data: { memberRole: newRole },
    include: {
      user: {
        select: {
          id: true,
          uid: true,
          email: true,
          employeeDetails: { select: { firstName: true, lastName: true } },
          studentLogin: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  await invalidatePermissionCache(groupId, userId);

  return member;
};

/**
 * Update member custom permissions
 * System admin (userType = 'admin') can update permissions in any group
 */
const updateMemberPermissions = async (groupId, userId, customPermissions, updatedBy, updaterUserType) => {
  if (updaterUserType !== 'admin' && updaterUserType !== 'superadmin') {
    const isAdmin = await isGroupAdmin(groupId, updatedBy);
    if (!isAdmin) {
      throw new Error('Only admins or system admin can update member permissions');
    }
  }

  const member = await prisma.chatGroupMember.update({
    where: { groupId_userId: { groupId, userId } },
    data: { customPermissions },
  });

  await invalidatePermissionCache(groupId, userId);

  return member;
};

/**
 * Update group permissions
 * System admin (userType = 'admin') can update group permissions for any group
 */
const updateGroupPermissions = async (groupId, permissions, updatedBy, updaterUserType) => {
  if (updaterUserType !== 'admin' && updaterUserType !== 'superadmin') {
    const isAdmin = await isGroupAdmin(groupId, updatedBy);
    if (!isAdmin) {
      throw new Error('Only admins or system admin can update group permissions');
    }
  }

  // Filter out any keys that aren't valid permission fields
  const validPermissionKeys = Object.keys(DEFAULT_PERMISSIONS);
  const filteredPermissions = {};
  for (const key of Object.keys(permissions)) {
    if (validPermissionKeys.includes(key)) {
      filteredPermissions[key] = permissions[key];
    }
  }

  const groupPermission = await prisma.chatGroupPermission.upsert({
    where: { groupId },
    update: filteredPermissions,
    create: {
      groupId,
      ...DEFAULT_PERMISSIONS,
      ...filteredPermissions,
    },
  });

  // Invalidate all members' permission cache
  await invalidatePermissionCache(groupId);

  return groupPermission;
};

/**
 * Bulk add members from CSV data
 */
const bulkAddMembers = async (groupId, userIdentifiers, addedBy) => {
  const isAdmin = await isGroupAdmin(groupId, addedBy);
  if (!isAdmin) {
    throw new Error('Only admins can bulk add members');
  }

  const results = {
    success: [],
    failed: [],
    duplicates: [],
  };

  // Find users by uid, empId (via employeeDetails), or email
  const users = await prisma.userLogin.findMany({
    where: {
      OR: [
        { uid: { in: userIdentifiers } },
        { employeeDetails: { empId: { in: userIdentifiers } } },
        { email: { in: userIdentifiers.map((id) => id.toLowerCase()) } },
      ],
    },
    select: { id: true, uid: true, email: true, employeeDetails: { select: { empId: true } } },
  });

  const userMap = new Map();
  users.forEach((user) => {
    userMap.set(user.uid, user);
    if (user.employeeDetails?.empId) {
      userMap.set(user.employeeDetails.empId, user);
    }
    if (user.email) {
      userMap.set(user.email.toLowerCase(), user);
    }
  });

  // Get existing members
  const existingMembers = await prisma.chatGroupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });
  const existingUserIds = new Set(existingMembers.map((m) => m.userId));

  // Process each identifier
  const toCreate = [];
  for (const identifier of userIdentifiers) {
    const user = userMap.get(identifier) || userMap.get(identifier.toLowerCase());
    
    if (!user) {
      results.failed.push({ identifier, reason: 'User not found' });
      continue;
    }

    if (existingUserIds.has(user.id)) {
      results.duplicates.push({ identifier, userId: user.id });
      continue;
    }

    toCreate.push({
      groupId,
      userId: user.id,
      memberRole: 'member',
    });
    existingUserIds.add(user.id); // Prevent duplicates in same batch
    results.success.push({ identifier, userId: user.id });
  }

  // Bulk create
  if (toCreate.length > 0) {
    await prisma.chatGroupMember.createMany({
      data: toCreate,
      skipDuplicates: true,
    });
  }

  // Update group timestamp
  await prisma.chatGroup.update({
    where: { id: groupId },
    data: { updatedAt: new Date() },
  });

  return results;
};

/**
 * Search all users that can be added to a group (excludes existing members)
 */
const searchUsersToAdd = async (groupId, query, limit = 20) => {
  // Get IDs of existing group members to exclude them
  const existingMembers = await prisma.chatGroupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });
  const existingUserIds = existingMembers.map((m) => m.userId);

  const users = await prisma.userLogin.findMany({
    where: {
      id: { notIn: existingUserIds },
      OR: [
        { uid: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        {
          employeeDetails: {
            OR: [
              { empId: { contains: query, mode: 'insensitive' } },
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
              { displayName: { contains: query, mode: 'insensitive' } },
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
      chatStatus: {
        select: { isOnline: true, lastSeenAt: true },
      },
    },
    take: limit,
  });

  return users;
};

/**
 * Search group members
 */
const searchGroupMembers = async (groupId, query, limit = 20) => {
  const members = await prisma.chatGroupMember.findMany({
    where: {
      groupId,
      user: {
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
          chatStatus: {
            select: { isOnline: true, lastSeenAt: true },
          },
        },
      },
    },
    take: limit,
  });

  return members;
};

/**
 * Get online member count for a group
 */
const getGroupOnlineMemberCount = async (groupId) => {
  const count = await prisma.chatGroupMember.count({
    where: {
      groupId,
      user: {
        chatStatus: { isOnline: true },
      },
    },
  });
  return count;
};

/**
 * Mute a member
 */
const muteMember = async (groupId, userId, mutedUntil, mutedBy) => {
  const isAdmin = await isGroupAdmin(groupId, mutedBy);
  if (!isAdmin) {
    throw new Error('Only admins can mute members');
  }

  const member = await prisma.chatGroupMember.update({
    where: { groupId_userId: { groupId, userId } },
    data: {
      isMuted: true,
      mutedUntil: mutedUntil || null,
    },
  });

  await invalidatePermissionCache(groupId, userId);

  return member;
};

/**
 * Unmute a member
 */
const unmuteMember = async (groupId, userId, unmutedBy) => {
  const isAdmin = await isGroupAdmin(groupId, unmutedBy);
  if (!isAdmin) {
    throw new Error('Only admins can unmute members');
  }

  const member = await prisma.chatGroupMember.update({
    where: { groupId_userId: { groupId, userId } },
    data: {
      isMuted: false,
      mutedUntil: null,
    },
  });

  await invalidatePermissionCache(groupId, userId);

  return member;
};

module.exports = {
  createGroup,
  getGroupById,
  getUserGroups,
  updateGroup,
  deleteGroup,
  addMember,
  removeMember,
  updateMemberRole,
  updateMemberPermissions,
  updateGroupPermissions,
  bulkAddMembers,
  searchUsersToAdd,
  searchGroupMembers,
  getGroupOnlineMemberCount,
  muteMember,
  unmuteMember,
};
