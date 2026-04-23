import chatApi, { API_URL } from '../api/chatApi';
import type {
  ApiResponse,
  ChatGroup,
  ChatMessage,
  ChatUser,
  ChatUserPermission,
  ChatPermissionStats,
  Conversation,
  DirectMessage,
  DirectMessagesResponse,
  FileUploadResult,
  BulkUserPermissionResult,
  UserChatAccess,
  GroupPermissions,
} from '../../types/chat.types';

const BASE = '/chat';

// Normalize a raw user object from the backend (which stores names in
// employeeDetails or studentLogin relations) into a flat ChatUser shape.
const normalizeUser = (raw: any): ChatUser => {
  if (!raw) return raw;
  const details = raw.employeeDetails || raw.studentLogin || {};
  return {
    ...raw,
    firstName: raw.firstName ?? details.firstName ?? '',
    lastName: raw.lastName ?? details.lastName ?? '',
  };
};

// ============ GROUP API ============
export const createGroup = async (data: {
  name: string;
  description?: string;
  type?: string;
  maxMembers?: number;
  memberIds?: string[];
}) => {
  const res = await chatApi.post<ApiResponse<ChatGroup>>(`${BASE}/groups`, data);
  return res.data.data!;
};

export const getMyGroups = async () => {
  const res = await chatApi.get<any>(`${BASE}/groups`);
  const groups: any[] = res.data.data || [];
  return groups.map((g: any) => ({
    ...g,
    memberCount: g._count?.members ?? g.memberCount ?? 0,
  })) as ChatGroup[];
};

const normalizeMember = (m: any) => ({
  ...m,
  role: m.memberRole || m.role || 'member',
  permissions: m.customPermissions || m.permissions || null,
  user: m.user
    ? {
        ...m.user,
        firstName:
          m.user.employeeDetails?.firstName ||
          m.user.studentLogin?.firstName ||
          m.user.firstName ||
          m.user.employeeDetails?.displayName?.split(' ')[0] ||
          m.user.uid ||
          m.user.email?.split('@')[0] ||
          '',
        lastName:
          m.user.employeeDetails?.lastName ||
          m.user.studentLogin?.lastName ||
          m.user.lastName ||
          (m.user.employeeDetails?.displayName?.split(' ').slice(1).join(' ')) ||
          '',
      }
    : m.user,
});

export const getGroup = async (groupId: string) => {
  const res = await chatApi.get<any>(`${BASE}/groups/${groupId}`);
  const g = res.data.data!;
  if (g && Array.isArray(g.members)) {
    g.members = g.members.map(normalizeMember);
  }
  if (g && g._count) {
    g.memberCount = g._count.members ?? g.memberCount ?? 0;
  }
  return g as ChatGroup;
};

export const updateGroup = async (groupId: string, data: Partial<ChatGroup>) => {
  const res = await chatApi.put<ApiResponse<ChatGroup>>(`${BASE}/groups/${groupId}`, data);
  return res.data.data!;
};

export const deleteGroup = async (groupId: string) => {
  await chatApi.delete(`${BASE}/groups/${groupId}`);
};

export const leaveGroup = async (groupId: string) => {
  await chatApi.post(`${BASE}/groups/${groupId}/leave`);
};

export const addMember = async (groupId: string, userId: string, role?: string) => {
  const res = await chatApi.post(`${BASE}/groups/${groupId}/members`, { userId, role });
  return res.data.data;
};

export const removeMember = async (groupId: string, userId: string) => {
  await chatApi.delete(`${BASE}/groups/${groupId}/members/${userId}`);
};

export const updateMemberRole = async (groupId: string, userId: string, role: string) => {
  const res = await chatApi.put(`${BASE}/groups/${groupId}/members/${userId}/role`, { role });
  return res.data.data;
};

export const updateMemberPermissions = async (groupId: string, userId: string, permissions: Record<string, boolean>) => {
  const res = await chatApi.put(`${BASE}/groups/${groupId}/members/${userId}/permissions`, { permissions });
  return res.data.data;
};

export const updateGroupPermissions = async (groupId: string, permissions: Partial<GroupPermissions>) => {
  const res = await chatApi.put(`${BASE}/groups/${groupId}/permissions`, permissions);
  return res.data.data;
};

export const searchGroupMembers = async (groupId: string, query: string) => {
  const res = await chatApi.get(`${BASE}/groups/${groupId}/members/search`, { params: { q: query } });
  return res.data.data || [];
};

export const searchUsersToAdd = async (groupId: string, query: string) => {
  const res = await chatApi.get<ApiResponse<ChatUser[]>>(`${BASE}/groups/${groupId}/search-users`, { params: { q: query } });
  return res.data.data || [];
};

export const muteMember = async (groupId: string, userId: string, duration?: string) => {
  await chatApi.post(`${BASE}/groups/${groupId}/members/${userId}/mute`, { duration });
};

export const unmuteMember = async (groupId: string, userId: string) => {
  await chatApi.post(`${BASE}/groups/${groupId}/members/${userId}/unmute`);
};

// ============ MESSAGE API ============
export const getGroupMessages = async (groupId: string, params?: { cursor?: string; limit?: number }) => {
  const res = await chatApi.get<ApiResponse<{ messages: ChatMessage[]; hasMore: boolean; nextCursor?: string }>>(
    `${BASE}/messages/group/${groupId}`,
    { params },
  );
  return res.data.data!;
};

export const sendMessage = async (data: {
  groupId: string;
  content?: string;
  messageType?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;
  waveformData?: number[];
  replyToId?: string;
}) => {
  const res = await chatApi.post<ApiResponse<ChatMessage>>(`${BASE}/messages`, data);
  return res.data.data!;
};

export const editMessage = async (messageId: string, content: string) => {
  const res = await chatApi.put<ApiResponse<ChatMessage>>(`${BASE}/messages/${messageId}`, { content });
  return res.data.data!;
};

export const deleteMessage = async (messageId: string) => {
  await chatApi.delete(`${BASE}/messages/${messageId}`);
};

export const togglePinMessage = async (messageId: string) => {
  const res = await chatApi.patch<ApiResponse<ChatMessage>>(`${BASE}/messages/${messageId}/pin`);
  return res.data.data!;
};

export const getPinnedMessages = async (groupId: string) => {
  const res = await chatApi.get<ApiResponse<ChatMessage[]>>(`${BASE}/messages/group/${groupId}/pinned`);
  return res.data.data || [];
};

export const markMessagesAsRead = async (groupId: string) => {
  await chatApi.post(`${BASE}/messages/group/${groupId}/read`);
};

export const searchMessages = async (groupId: string, query: string, limit?: number) => {
  const res = await chatApi.get<ApiResponse<ChatMessage[]>>(`${BASE}/messages/group/${groupId}/search`, {
    params: { q: query, limit },
  });
  return res.data.data || [];
};

export const getUnreadCount = async (groupId: string) => {
  const res = await chatApi.get<ApiResponse<{ unreadCount: number }>>(`${BASE}/messages/group/${groupId}/unread-count`);
  return res.data.data?.unreadCount || 0;
};

// ============ DIRECT MESSAGE API ============
export const getConversations = async (params?: { page?: number; limit?: number }) => {
  const res = await chatApi.get<ApiResponse<Conversation[]>>(`${BASE}/direct/conversations`, { params });
  const data = res.data.data || [];
  return data.map((c) => ({ ...c, user: normalizeUser(c.user) }));
};

export const getDirectMessages = async (otherUserId: string, params?: { cursor?: string; limit?: number }) => {
  const res = await chatApi.get<ApiResponse<DirectMessagesResponse>>(`${BASE}/direct/${otherUserId}/messages`, { params });
  return res.data.data!;
};

export const sendDirectMessage = async (data: {
  receiverId: string;
  content?: string;
  messageType?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;
  waveformData?: number[];
  replyToId?: string;
}) => {
  const res = await chatApi.post<ApiResponse<DirectMessage>>(`${BASE}/direct`, data);
  return res.data.data!;
};

export const markDirectMessagesAsRead = async (otherUserId: string) => {
  await chatApi.post(`${BASE}/direct/${otherUserId}/read`);
};

export const editDirectMessage = async (messageId: string, content: string) => {
  const res = await chatApi.put<ApiResponse<DirectMessage>>(`${BASE}/direct/messages/${messageId}`, { content });
  return res.data.data!;
};

export const deleteDirectMessage = async (messageId: string) => {
  await chatApi.delete(`${BASE}/direct/messages/${messageId}`);
};

export const searchUsersForDM = async (query: string, limit?: number) => {
  const res = await chatApi.get<ApiResponse<ChatUser[]>>(`${BASE}/direct/users/search`, { params: { q: query, limit } });
  return (res.data.data || []).map(normalizeUser);
};

// ============ STATUS API ============
export const getUserStatus = async (userId: string) => {
  const res = await chatApi.get(`${BASE}/status/user/${userId}`);
  return res.data.data;
};

export const getBulkUserStatus = async (userIds: string[]) => {
  const res = await chatApi.post(`${BASE}/status/bulk`, { userIds });
  return res.data.data || {};
};

export const getGroupOnlineMembers = async (groupId: string) => {
  const res = await chatApi.get(`${BASE}/status/group/${groupId}/online`);
  return res.data.data;
};

export const getPrivacySettings = async () => {
  const res = await chatApi.get(`${BASE}/status/privacy`);
  return res.data.data;
};

export const updatePrivacySettings = async (lastSeenPrivacy: string) => {
  await chatApi.put(`${BASE}/status/privacy`, { lastSeenPrivacy });
};

// ============ UPLOAD API ============
export const uploadGroupFile = async (groupId: string, uri: string, name: string, type: string) => {
  const formData = new FormData();
  formData.append('file', { uri, name, type } as any);
  const res = await chatApi.post<ApiResponse<FileUploadResult>>(`${BASE}/upload/group/${groupId}/file`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data!;
};

export const uploadDirectFile = async (receiverId: string, uri: string, name: string, type: string) => {
  const formData = new FormData();
  formData.append('file', { uri, name, type } as any);
  const res = await chatApi.post<ApiResponse<FileUploadResult>>(`${BASE}/upload/direct/${receiverId}/file`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data!;
};

export const uploadGroupVoice = async (groupId: string, uri: string) => {
  const formData = new FormData();
  formData.append('voice', { uri, name: 'voice.m4a', type: 'audio/m4a' } as any);
  const res = await chatApi.post<ApiResponse<FileUploadResult>>(`${BASE}/upload/group/${groupId}/voice`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data!;
};

export const uploadDirectVoice = async (receiverId: string, uri: string) => {
  const formData = new FormData();
  formData.append('voice', { uri, name: 'voice.m4a', type: 'audio/m4a' } as any);
  const res = await chatApi.post<ApiResponse<FileUploadResult>>(`${BASE}/upload/direct/${receiverId}/voice`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data!;
};

export const getChatFileUrl = (filePath: string): string => {
  if (!filePath) return '';
  const baseUrl = API_URL;
  return `${baseUrl}/chat/upload/files/${encodeURIComponent(filePath)}`;
};

// ============ USER PERMISSIONS API (Admin) ============
export const getMyPermissions = async () => {
  const res = await chatApi.get<ApiResponse<UserChatAccess>>(`${BASE}/user-permissions/me`);
  return res.data.data!;
};

export const getAuthorizedUsers = async (params?: { page?: number; limit?: number; search?: string }) => {
  const res = await chatApi.get<ApiResponse<ChatUserPermission[]>>(`${BASE}/user-permissions/users`, { params });
  const users = (res.data.data || []).map((p: any) => ({ ...p, user: p.user ? normalizeUser(p.user) : p.user }));
  return {
    users,
    pagination: (res.data as any).pagination || { totalPages: 1, total: 0 },
  };
};

export const getChatPermissionStats = async () => {
  const res = await chatApi.get<ApiResponse<ChatPermissionStats>>(`${BASE}/user-permissions/stats`);
  return res.data.data!;
};

export const searchUnaddedUsers = async (query: string, limit = 10) => {
  const res = await chatApi.get<ApiResponse<ChatUser[]>>(`${BASE}/user-permissions/users/search-unadded`, { params: { query, limit } });
  return (res.data.data || []).map(normalizeUser);
};

export const addChatUser = async (data: { uid: string; permissions?: Partial<ChatUserPermission> }) => {
  const res = await chatApi.post<ApiResponse<ChatUser>>(`${BASE}/user-permissions/users`, data);
  return res.data.data!;
};

export const bulkAddChatUsers = async (data: FormData | { identifiers: string[]; permissions?: Partial<ChatUserPermission> }) => {
  const res = await chatApi.post<ApiResponse<BulkUserPermissionResult>>(
    `${BASE}/user-permissions/bulk`,
    data,
    data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined,
  );
  return res.data.data!;
};

export const toggleChatUser = async (userId: string, enabled: boolean) => {
  await chatApi.patch(`${BASE}/user-permissions/users/${userId}/toggle`, { chatEnabled: enabled });
};

export const updateChatUserPermissions = async (userId: string, permissions: Partial<ChatUserPermission>) => {
  const res = await chatApi.put<ApiResponse<ChatUser>>(`${BASE}/user-permissions/users/${userId}`, permissions);
  return res.data.data!;
};

export const removeChatUser = async (userId: string) => {
  await chatApi.delete(`${BASE}/user-permissions/users/${userId}`);
};

// ============ PROFILE IMAGE URL ============
export const getProfileImageUrl = (imagePath: string | null | undefined): string | null => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  const backendHost = API_URL.replace(/\/api\/v\d+$/, '');
  if (imagePath.startsWith('/uploads')) return `${backendHost}${imagePath}`;
  return `${backendHost}/uploads/profiles/${imagePath}`;
};

export const uploadProfileImage = async (uri: string, fileName: string, mimeType: string) => {
  const formData = new FormData();
  formData.append('file', {
    uri,
    name: fileName,
    type: mimeType,
  } as any);

  const res = await chatApi.post<ApiResponse<{ filePath: string }>>(`${BASE}/profile/photo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data!;
};

// ============ SESSIONS API ============
export const getChatSessions = async () => {
  const res = await chatApi.get('/chat-auth/sessions');
  return res.data.data || [];
};

export const logoutAllSessions = async () => {
  await chatApi.post('/chat-auth/logout-all');
};
