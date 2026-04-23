// Chat type definitions — mirrors backend models

export interface ChatUser {
  id: string;
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  profileImage?: string | null;
  department?: string | null;
}

export interface ChatGroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: 'owner' | 'admin' | 'moderator' | 'member';
  joinedAt: string;
  isMuted: boolean;
  mutedUntil?: string | null;
  permissions?: MemberPermissions | null;
  user: ChatUser;
}

export interface MemberPermissions {
  canSendMessages: boolean;
  canSendMedia: boolean;
  canAddMembers: boolean;
  canRemoveMembers: boolean;
  canEditGroupInfo: boolean;
  canPinMessages: boolean;
  canDeleteMessages: boolean;
}

export interface ChatGroup {
  id: string;
  name: string;
  description?: string | null;
  type: 'public' | 'private' | 'restricted';
  createdBy: string;
  maxMembers: number;
  memberCount: number;
  avatar?: string | null;
  lastMessageAt?: string | null;
  lastMessage?: ChatMessage | null;
  createdAt: string;
  updatedAt: string;
  members?: ChatGroupMember[];
  permissions?: GroupPermissions;
}

export interface GroupPermissions {
  // Messaging
  canSendMessage: boolean;
  canEditMessage: boolean;
  canDeleteMessage: boolean;
  canPinMessage: boolean;
  adminOnlyMessaging: boolean;
  readOnlyMode: boolean;
  // Media
  canUploadFiles: boolean;
  canSendVoice: boolean;
  canSendVideo: boolean;
  canSendEmoji: boolean;
  // Group management
  canAddMembers: boolean;
  canRemoveMembers: boolean;
  canMentionAll: boolean;
  privateDMAllowed: boolean;
  searchMembers: boolean;
}

export interface ChatMessage {
  id: string;
  groupId: string;
  senderId: string;
  content?: string | null;
  encryptedContent?: string | null;
  messageType: 'text' | 'image' | 'file' | 'voice' | 'video' | 'system';
  filePath?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  duration?: number | null;
  waveformData?: number[] | null;
  replyToId?: string | null;
  replyTo?: ChatMessage | null;
  isPinned: boolean;
  isEdited: boolean;
  editedAt?: string | null;
  createdAt: string;
  sender: ChatUser;
  readBy?: ReadReceipt[];
}

export interface ReadReceipt {
  userId: string;
  readAt: string;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content?: string | null;
  encryptedContent?: string | null;
  messageType: 'text' | 'image' | 'file' | 'voice' | 'video';
  filePath?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  duration?: number | null;
  waveformData?: number[] | null;
  replyToId?: string | null;
  replyTo?: DirectMessage | null;
  isEdited: boolean;
  editedAt?: string | null;
  readAt?: string | null;
  createdAt: string;
  sender: ChatUser;
}

export interface Conversation {
  user: ChatUser;
  lastMessage: DirectMessage | null;
  unreadCount: number;
}

export interface TypingUser {
  userId: string;
  userName: string;
}

export interface UserStatus {
  userId: string;
  isOnline: boolean;
  lastSeenAt?: string;
}

export interface ChatUserPermission {
  id: string;
  userId: string;
  chatEnabled: boolean;
  canPrivateMessage: boolean;
  canCreateGroup: boolean;
  canUploadProfilePhoto: boolean;
  canSetLastSeen: boolean;
  canSetOnlineStatus: boolean;
  canSetProfilePrivacy: boolean;
  canSetAboutPrivacy: boolean;
  canSetStatusPrivacy: boolean;
  canSetReadReceipts: boolean;
  canSetMessageTimer: boolean;
  canSetGroupsPrivacy: boolean;
  canBlockContacts: boolean;
  canChangeTheme: boolean;
  canChangeWallpaper: boolean;
  canToggleNotifications: boolean;
  user?: ChatUser;
}

export interface ChatPermissionStats {
  totalUsers: number;
  enabledUsers: number;
  disabledUsers: number;
}

export interface FileUploadResult {
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  duration?: number;
  waveformData?: number[];
}

export interface BulkUserPermissionResult {
  added: number;
  skipped: number;
  failed: number;
  errors?: string[];
}

export interface EffectivePermissions {
  canSendMessages: boolean;
  canSendMedia: boolean;
  canAddMembers: boolean;
  canRemoveMembers: boolean;
  canEditGroupInfo: boolean;
  canPinMessages: boolean;
  canDeleteMessages: boolean;
}

export interface UserChatAccess {
  chatEnabled: boolean;
  canPrivateMessage: boolean;
  canCreateGroup: boolean;
  canUploadProfilePhoto: boolean;
  canSetLastSeen: boolean;
}

export interface DirectMessagesResponse {
  messages: DirectMessage[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  pagination?: {
    total: number;
    totalPages: number;
    page: number;
    limit: number;
  };
}

// Navigation param types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
};

export type ChatsStackParamList = {
  ChatList: undefined;
  GroupConversation: { groupId: string; groupName: string };
  DMConversation: { userId: string; userName: string };
  GroupInfo: { groupId: string };
  GroupSettings: { groupId: string; groupName: string };
  MemberPermissions: { groupId: string; userId: string; userName: string; currentRole: string };
  MessageSearch: { groupId: string; groupName: string };
  NewChat: undefined;
  NewGroup: undefined;
};

export type AdminStackParamList = {
  AdminDashboard: undefined;
  UserPermissions: undefined;
  UserPermissionDetail: { userId: string; userName: string };
  GroupManagement: undefined;
  GroupDetailAdmin: { groupId: string; groupName: string };
};

export type ProfileStackParamList = {
  Profile: undefined;
  Sessions: undefined;
};
