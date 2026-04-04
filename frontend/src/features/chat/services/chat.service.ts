/**
 * Chat Service
 * API calls for chat functionality
 */
import api from '@/shared/api/api';
import type {
  ChatGroup,
  ChatGroupMember,
  ChatGroupPermission,
  ChatMessage,
  DirectMessage,
  Conversation,
  ChatUser,
  UserStatus,
  BulkUploadResult,
  FileUploadResult,
  MessagesResponse,
  DirectMessagesResponse,
  EffectivePermissions,
  ApiResponse,
  GroupPermissions,
  UserChatAccess,
  ChatPermissionStats,
  ChatUserPermission,
  BulkUserPermissionResult,
} from '../types';

const BASE_URL = '/chat';

// ============ GROUP API ====
/**
 * Create a new chat group
 */
export const createGroup = async (data: {
  name: string;
  description?: string;
  isEncrypted?: boolean;
  initialMembers?: string[];
  memberEmails?: string[];
  permissions?: GroupPermissions;
}): Promise<ChatGroup> => {
  const response = await api.post<ApiResponse<ChatGroup>>(`${BASE_URL}/groups`, data);
  return response.data.data!;
};

/**
 * Get user's groups
 */
export const getMyGroups = async (params?: {
  page?: number;
  limit?: number;
}): Promise<{ groups: ChatGroup[]; pagination: any }> => {
  const response = await api.get<ApiResponse<ChatGroup[]>>(`${BASE_URL}/groups`, { params });
  return {
    groups: response.data.data || [],
    pagination: response.data.pagination,
  };
};

/**
 * Get group by ID
 */
export const getGroup = async (groupId: string): Promise<ChatGroup & { myPermissions: EffectivePermissions }> => {
  const response = await api.get<ApiResponse<ChatGroup & { myPermissions: EffectivePermissions }>>(`${BASE_URL}/groups/${groupId}`);
  return response.data.data!;
};

/**
 * Update group
 */
export const updateGroup = async (
  groupId: string,
  data: { name?: string; description?: string; avatar?: string }
): Promise<ChatGroup> => {
  const response = await api.put<ApiResponse<ChatGroup>>(`${BASE_URL}/groups/${groupId}`, data);
  return response.data.data!;
};

/**
 * Delete group
 */
export const deleteGroup = async (groupId: string): Promise<void> => {
  await api.delete(`${BASE_URL}/groups/${groupId}`);
};

/**
 * Leave group
 */
export const leaveGroup = async (groupId: string): Promise<void> => {
  await api.post(`${BASE_URL}/groups/${groupId}/leave`);
};

/**
 * Add member to group
 */
export const addMember = async (
  groupId: string,
  data: { userId: string; role?: string }
): Promise<ChatGroupMember> => {
  const response = await api.post<ApiResponse<ChatGroupMember>>(`${BASE_URL}/groups/${groupId}/members`, data);
  return response.data.data!;
};

/**
 * Bulk add members from CSV
 */
export const bulkAddMembers = async (groupId: string, file: File): Promise<BulkUploadResult> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post<ApiResponse<BulkUploadResult>>(`${BASE_URL}/groups/${groupId}/members/bulk`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data!;
};

/**
 * Remove member from group
 */
export const removeMember = async (groupId: string, userId: string): Promise<void> => {
  await api.delete(`${BASE_URL}/groups/${groupId}/members/${userId}`);
};

/**
 * Update member role
 */
export const updateMemberRole = async (
  groupId: string,
  userId: string,
  role: string
): Promise<ChatGroupMember> => {
  const response = await api.put<ApiResponse<ChatGroupMember>>(`${BASE_URL}/groups/${groupId}/members/${userId}/role`, { role });
  return response.data.data!;
};

/**
 * Update member permissions
 */
export const updateMemberPermissions = async (
  groupId: string,
  userId: string,
  permissions: Partial<EffectivePermissions>
): Promise<ChatGroupMember> => {
  const response = await api.put<ApiResponse<ChatGroupMember>>(`${BASE_URL}/groups/${groupId}/members/${userId}/permissions`, { permissions });
  return response.data.data!;
};

/**
 * Update group permissions
 */
export const updateGroupPermissions = async (
  groupId: string,
  permissions: Partial<ChatGroupPermission>
): Promise<ChatGroupPermission> => {
  const response = await api.put<ApiResponse<ChatGroupPermission>>(`${BASE_URL}/groups/${groupId}/permissions`, { permissions });
  return response.data.data!;
};

/**
 * Search group members
 */
export const searchGroupMembers = async (
  groupId: string,
  query: string,
  limit?: number
): Promise<ChatGroupMember[]> => {
  const response = await api.get<ApiResponse<ChatGroupMember[]>>(`${BASE_URL}/groups/${groupId}/members/search`, {
    params: { q: query, limit },
  });
  return response.data.data || [];
};

/**
 * Search all users that can be added to a group (excludes existing members)
 */
export const searchUsersToAdd = async (
  groupId: string,
  query: string,
  limit?: number
): Promise<ChatUser[]> => {
  const response = await api.get<ApiResponse<ChatUser[]>>(`${BASE_URL}/groups/${groupId}/members/search-users`, {
    params: { q: query, limit },
  });
  return response.data.data || [];
};

/**
 * Mute member
 */
export const muteMember = async (
  groupId: string,
  userId: string,
  duration?: number
): Promise<void> => {
  await api.post(`${BASE_URL}/groups/${groupId}/members/${userId}/mute`, { duration });
};

/**
 * Unmute member
 */
export const unmuteMember = async (groupId: string, userId: string): Promise<void> => {
  await api.post(`${BASE_URL}/groups/${groupId}/members/${userId}/unmute`);
};

// ============ MESSAGE API ====
/**
 * Get messages for a group
 */
export const getGroupMessages = async (
  groupId: string,
  params?: { cursor?: string; limit?: number }
): Promise<MessagesResponse> => {
  const response = await api.get<ApiResponse<MessagesResponse>>(`${BASE_URL}/messages/group/${groupId}`, { params });
  return response.data.data!;
};

/**
 * Send message (REST fallback)
 */
export const sendMessage = async (data: {
  groupId: string;
  content?: string;
  encryptedContent?: string;
  messageType?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;
  waveformData?: number[];
  replyToId?: string;
  mentions?: string[];
}): Promise<ChatMessage> => {
  const response = await api.post<ApiResponse<ChatMessage>>(`${BASE_URL}/messages`, data);
  return response.data.data!;
};

/**
 * Edit message
 */
export const editMessage = async (messageId: string, content: string): Promise<ChatMessage> => {
  const response = await api.put<ApiResponse<ChatMessage>>(`${BASE_URL}/messages/${messageId}`, { content });
  return response.data.data!;
};

/**
 * Delete message
 */
export const deleteMessage = async (messageId: string): Promise<void> => {
  await api.delete(`${BASE_URL}/messages/${messageId}`);
};

/**
 * Toggle pin message
 */
export const togglePinMessage = async (messageId: string): Promise<ChatMessage> => {
  const response = await api.post<ApiResponse<ChatMessage>>(`${BASE_URL}/messages/${messageId}/pin`);
  return response.data.data!;
};

/**
 * Get pinned messages
 */
export const getPinnedMessages = async (groupId: string): Promise<ChatMessage[]> => {
  const response = await api.get<ApiResponse<ChatMessage[]>>(`${BASE_URL}/messages/group/${groupId}/pinned`);
  return response.data.data || [];
};

/**
 * Mark messages as read
 */
export const markMessagesAsRead = async (groupId: string, messageIds: string[]): Promise<void> => {
  await api.post(`${BASE_URL}/messages/group/${groupId}/read`, { messageIds });
};

/**
 * Search messages
 */
export const searchMessages = async (
  groupId: string,
  query: string,
  limit?: number
): Promise<ChatMessage[]> => {
  const response = await api.get<ApiResponse<ChatMessage[]>>(`${BASE_URL}/messages/group/${groupId}/search`, {
    params: { q: query, limit },
  });
  return response.data.data || [];
};

/**
 * Get unread count
 */
export const getUnreadCount = async (groupId: string): Promise<number> => {
  const response = await api.get<ApiResponse<{ unreadCount: number }>>(`${BASE_URL}/messages/group/${groupId}/unread-count`);
  return response.data.data?.unreadCount || 0;
};

// ============ DIRECT MESSAGE API ====
/**
 * Get conversations list
 */
export const getConversations = async (params?: {
  page?: number;
  limit?: number;
}): Promise<Conversation[]> => {
  const response = await api.get<ApiResponse<Conversation[]>>(`${BASE_URL}/direct/conversations`, { params });
  return response.data.data || [];
};

/**
 * Get direct messages with a user
 */
export const getDirectMessages = async (
  otherUserId: string,
  params?: { cursor?: string; limit?: number }
): Promise<DirectMessagesResponse> => {
  const response = await api.get<ApiResponse<DirectMessagesResponse>>(`${BASE_URL}/direct/${otherUserId}/messages`, { params });
  return response.data.data!;
};

/**
 * Send direct message (REST fallback)
 */
export const sendDirectMessage = async (data: {
  receiverId: string;
  content?: string;
  encryptedContent?: string;
  messageType?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;
  waveformData?: number[];
  replyToId?: string;
}): Promise<DirectMessage> => {
  const response = await api.post<ApiResponse<DirectMessage>>(`${BASE_URL}/direct`, data);
  return response.data.data!;
};

/**
 * Mark direct messages as read
 */
export const markDirectMessagesAsRead = async (otherUserId: string): Promise<void> => {
  await api.post(`${BASE_URL}/direct/${otherUserId}/read`);
};

/**
 * Edit direct message
 */
export const editDirectMessage = async (messageId: string, content: string): Promise<DirectMessage> => {
  const response = await api.put<ApiResponse<DirectMessage>>(`${BASE_URL}/direct/messages/${messageId}`, { content });
  return response.data.data!;
};

/**
 * Delete direct message
 */
export const deleteDirectMessage = async (messageId: string): Promise<void> => {
  await api.delete(`${BASE_URL}/direct/messages/${messageId}`);
};

/**
 * Search users for DM
 */
export const searchUsersForDM = async (query: string, limit?: number): Promise<ChatUser[]> => {
  const response = await api.get<ApiResponse<ChatUser[]>>(`${BASE_URL}/direct/users/search`, {
    params: { q: query, limit },
  });
  return response.data.data || [];
};

// ============ STATUS API ====
/**
 * Get user status
 */
export const getUserStatus = async (userId: string): Promise<UserStatus> => {
  const response = await api.get<ApiResponse<UserStatus>>(`${BASE_URL}/status/user/${userId}`);
  return response.data.data!;
};

/**
 * Get bulk user status
 */
export const getBulkUserStatus = async (userIds: string[]): Promise<Record<string, { isOnline: boolean; lastSeenAt?: string }>> => {
  const response = await api.post<ApiResponse<Record<string, { isOnline: boolean; lastSeenAt?: string }>>>(`${BASE_URL}/status/bulk`, { userIds });
  return response.data.data || {};
};

/**
 * Get group online members
 */
export const getGroupOnlineMembers = async (groupId: string): Promise<{ groupId: string; onlineUserIds: string[]; count: number }> => {
  const response = await api.get<ApiResponse<{ groupId: string; onlineUserIds: string[]; count: number }>>(`${BASE_URL}/status/group/${groupId}/online`);
  return response.data.data!;
};

/**
 * Get privacy settings
 */
export const getPrivacySettings = async (): Promise<{ lastSeenPrivacy: string }> => {
  const response = await api.get<ApiResponse<{ lastSeenPrivacy: string }>>(`${BASE_URL}/status/privacy`);
  return response.data.data!;
};

/**
 * Update privacy settings
 */
export const updatePrivacySettings = async (lastSeenPrivacy: string): Promise<void> => {
  await api.put(`${BASE_URL}/status/privacy`, { lastSeenPrivacy });
};

// ============ UPLOAD API ====
/**
 * Upload file for group chat
 */
export const uploadGroupFile = async (groupId: string, file: File): Promise<FileUploadResult> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post<ApiResponse<FileUploadResult>>(`${BASE_URL}/upload/group/${groupId}/file`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data!;
};

/**
 * Upload file for direct message
 */
export const uploadDirectFile = async (receiverId: string, file: File): Promise<FileUploadResult> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post<ApiResponse<FileUploadResult>>(`${BASE_URL}/upload/direct/${receiverId}/file`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data!;
};

/**
 * Upload voice message for group chat
 */
export const uploadGroupVoice = async (groupId: string, audioBlob: Blob): Promise<FileUploadResult> => {
  const formData = new FormData();
  formData.append('voice', audioBlob, 'voice.webm');
  const response = await api.post<ApiResponse<FileUploadResult>>(`${BASE_URL}/upload/group/${groupId}/voice`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data!;
};

/**
 * Upload voice message for direct message
 */
export const uploadDirectVoice = async (receiverId: string, audioBlob: Blob): Promise<FileUploadResult> => {
  const formData = new FormData();
  formData.append('voice', audioBlob, 'voice.webm');
  const response = await api.post<ApiResponse<FileUploadResult>>(`${BASE_URL}/upload/direct/${receiverId}/voice`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data!;
};

/**
 * Get file URL
 */
export const getChatFileUrl = (filePath: string): string => {
  if (!filePath) return '';
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';
  return `${baseUrl}/chat/upload/files/${encodeURIComponent(filePath)}`;
};

// ============ USER PERMISSIONS API ====
/**
 * Get my chat permissions (user-level access)
 */
export const getMyPermissions = async (): Promise<UserChatAccess> => {
  const response = await api.get<ApiResponse<UserChatAccess>>(`${BASE_URL}/user-permissions/me`);
  return response.data.data!;
};

// ============ UTILITY FUNCTIONS ====
/**
 * Get profile image URL - resolves relative backend paths to full URLs
 * Handles: full URLs, /uploads/... paths, and bare filenames
 */
export const getProfileImageUrl = (imagePath: string | null | undefined): string | null => {
  if (!imagePath) return null;

  // Already a full URL
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  // Derive backend host from NEXT_PUBLIC_API_URL (strip /api/v1 suffix)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';
  const backendHost = apiUrl.replace(/\/api\/v\d+$/, '');

  // Relative path like /uploads/profiles/filename.jpeg
  if (imagePath.startsWith('/uploads')) {
    return `${backendHost}${imagePath}`;
  }

  // Bare filename like 1771319953331-b7aed9be.jpeg
  return `${backendHost}/uploads/profiles/${imagePath}`;
};

// ============ USER MANAGEMENT (Admin) ====

/**
 * Get all users authorized to use chat, with optional pagination and search
 */
export const getAuthorizedUsers = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<{ users: ChatUserPermission[]; pagination: { totalPages: number; total: number } }> => {
  const response = await api.get<ApiResponse<ChatUserPermission[]>>(`${BASE_URL}/user-permissions`, { params });
  return {
    users: response.data.data || [],
    pagination: (response.data as any).pagination || { totalPages: 1, total: 0 },
  };
};

/**
 * Get aggregate stats about chat permissions
 */
export const getChatPermissionStats = async (): Promise<ChatPermissionStats> => {
  const response = await api.get<ApiResponse<ChatPermissionStats>>(`${BASE_URL}/user-permissions/stats`);
  return response.data.data!;
};

/**
 * Search users who have NOT yet been added to the chat system
 */
export const searchUnaddedUsers = async (query: string, limit = 10): Promise<ChatUser[]> => {
  const response = await api.get<ApiResponse<ChatUser[]>>(`${BASE_URL}/user-permissions/search-unadded`, {
    params: { query, limit },
  });
  return response.data.data || [];
};

/**
 * Add a single user to the chat system with permissions
 */
export const addChatUser = async (data: {
  uid: string;
  permissions?: Partial<ChatUserPermission>;
}): Promise<ChatUser> => {
  const response = await api.post<ApiResponse<ChatUser>>(`${BASE_URL}/user-permissions`, data);
  return response.data.data!;
};

/**
 * Bulk-add users to the chat system — accepts either a list of UIDs or a CSV FormData
 */
export const bulkAddChatUsers = async (
  data: FormData | { identifiers: string[]; permissions?: Partial<ChatUserPermission> }
): Promise<BulkUserPermissionResult> => {
  const response = await api.post<ApiResponse<BulkUserPermissionResult>>(
    `${BASE_URL}/user-permissions/bulk`,
    data,
    data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined
  );
  return response.data.data!;
};

/**
 * Enable or disable chat access for a user
 */
export const toggleChatUser = async (userId: string, enabled: boolean): Promise<void> => {
  await api.patch(`${BASE_URL}/user-permissions/${userId}/toggle`, { chatEnabled: enabled });
};

/**
 * Update per-user chat permissions
 */
export const updateChatUserPermissions = async (
  userId: string,
  permissions: Partial<ChatUserPermission>
): Promise<ChatUser> => {
  const response = await api.patch<ApiResponse<ChatUser>>(`${BASE_URL}/user-permissions/${userId}`, permissions);
  return response.data.data!;
};

/**
 * Remove a user from the chat system entirely
 */
export const removeChatUser = async (userId: string): Promise<void> => {
  await api.delete(`${BASE_URL}/user-permissions/${userId}`);
};
