/**
 * Chat Type Definitions
 */

// User type for chat
export interface ChatUser {
  id: string;
  uid: string;
  email?: string;
  role?: string;
  profileImage?: string;
  employeeDetails?: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
  };
  studentLogin?: {
    firstName?: string;
    lastName?: string;
  };
  chatStatus?: {
    isOnline?: boolean;
    lastSeenAt?: string;
    lastSeenPrivacy?: 'everyone' | 'contacts' | 'nobody';
  };
}

// Message types
export type MessageType = 'text' | 'file' | 'image' | 'voice' | 'video' | 'document';

// Member role types
export type MemberRole = 'owner' | 'admin' | 'moderator' | 'member';

// Chat message
export interface ChatMessage {
  id: string;
  groupId: string;
  senderId: string;
  messageType: MessageType;
  content?: string;
  encryptedContent?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;
  waveformData?: number[];
  replyToId?: string;
  mentions?: string[];
  isPinned: boolean;
  isEdited: boolean;
  readBy: ReadReceipt[];
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  sender?: ChatUser;
  replyTo?: {
    id: string;
    content?: string;
    messageType: MessageType;
    sender?: ChatUser;
  };
}

// Read receipt
export interface ReadReceipt {
  userId: string;
  readAt: string;
}

// Direct message
export interface DirectMessage {
  id: string;
  senderId: string;
  receiverId: string;
  messageType: MessageType;
  content?: string;
  encryptedContent?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;
  waveformData?: number[];
  replyToId?: string;
  isEdited: boolean;
  isDeleted: boolean;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
  sender?: ChatUser;
  replyTo?: {
    id: string;
    content?: string;
    messageType: MessageType;
  };
}

// Chat group
export interface ChatGroup {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  createdById: string;
  isEncrypted: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: ChatUser;
  members?: ChatGroupMember[];
  permissions?: ChatGroupPermission;
  _count?: {
    messages: number;
    members: number;
  };
  onlineMemberCount?: number;
  lastMessage?: ChatMessage;
  myRole?: MemberRole;
  isMuted?: boolean;
  myPermissions?: EffectivePermissions;
}

// Group member
export interface ChatGroupMember {
  id: string;
  groupId: string;
  userId: string;
  memberRole: MemberRole;
  customPermissions?: Partial<EffectivePermissions>;
  isMuted: boolean;
  mutedUntil?: string;
  joinedAt: string;
  user?: ChatUser;
}

// Group permissions
export interface ChatGroupPermission {
  id: string;
  groupId: string;
  canSendMessage: boolean;
  canUploadFiles: boolean;
  canSendVoice: boolean;
  canSendVideo: boolean;
  canSendEmoji: boolean;
  canEditMessage: boolean;
  canDeleteMessage: boolean;
  canPinMessage: boolean;
  canMentionAll: boolean;
  canAddMembers: boolean;
  canRemoveMembers: boolean;
  adminOnlyMessaging: boolean;
  readOnlyMode: boolean;
  privateDMAllowed: boolean;
  searchMembers: boolean;
  maxFileSize: number;
}

// Effective permissions (after applying role and overrides) - GROUP LEVEL
export interface EffectivePermissions {
  canSendMessage: boolean;
  canUploadFiles: boolean;
  canSendVoice: boolean;
  canSendVideo: boolean;
  canSendEmoji: boolean;
  canEditMessage: boolean;
  canDeleteMessage: boolean;
  canPinMessage: boolean;
  canMentionAll: boolean;
  canAddMembers: boolean;
  canRemoveMembers: boolean;
  adminOnlyMessaging: boolean;
  readOnlyMode: boolean;
  privateDMAllowed: boolean;
  searchMembers: boolean;
  maxFileSize: number;
}

// User-level chat permissions (individual user access + features)
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
  addedBy?: string;
  createdAt: string;
  updatedAt: string;
  user?: ChatUser;
}

// User chat access response
export interface UserChatAccess {
  hasAccess: boolean;
  permissions: ChatUserPermission | null;
}

// Conversation (for DM list)
export interface Conversation {
  user: ChatUser;
  lastMessage?: {
    id: string;
    content?: string;
    messageType: MessageType;
    senderId: string;
    readAt?: string;
    createdAt: string;
  };
  unreadCount: number;
}

// User status
export interface UserStatus {
  userId: string;
  isOnline: boolean;
  lastSeenAt?: string;
  lastSeenVisible: boolean;
  user?: ChatUser;
}

// Group permissions for creation (group-level only)
export interface GroupPermissions {
  canSendMessage: boolean;
  canUploadFiles: boolean;
  canSendVoice: boolean;
  canSendVideo: boolean;
  canSendEmoji: boolean;
  canEditMessage: boolean;
  canDeleteMessage: boolean;
  canPinMessage: boolean;
  canMentionAll: boolean;
  canAddMembers: boolean;
  canRemoveMembers: boolean;
  canDeleteGroup: boolean;
  adminOnlyMessaging: boolean;
  readOnlyMode: boolean;
  privateDMAllowed: boolean;
  searchMembers: boolean;
  maxFileSize: number;
}

// Individual member permission overrides
export interface MemberPermissionOverride {
  memberId: string;
  userId: string;
  userName?: string;
  permissions: Partial<GroupPermissions>;
}

// Typing indicator
export interface TypingUser {
  userId: string;
  user?: {
    id: string;
    firstName?: string;
  };
}

// Bulk upload result
export interface BulkUploadResult {
  success: Array<{ identifier: string; userId: string }>;
  failed: Array<{ identifier: string; reason: string }>;
  duplicates: Array<{ identifier: string; userId: string }>;
}

// Bulk user permission upload result
export interface BulkUserPermissionResult {
  success: Array<{ identifier: string; userId: string; uid: string }>;
  failed: Array<{ identifier: string; reason: string }>;
  duplicates: Array<{ identifier: string; userId: string; uid: string }>;
}

// User permission stats
export interface ChatPermissionStats {
  total: number;
  enabled: number;
  disabled: number;
}

// File upload result
export interface FileUploadResult {
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: string;
  url: string;
  duration?: number;
  waveformData?: number[];
  messageType?: MessageType;
}

// Socket events
export interface SocketEvents {
  // Connection
  connect: () => void;
  disconnect: () => void;
  connect_error: (error: Error) => void;

  // Group messages
  newMessage: (data: { groupId: string; message: ChatMessage }) => void;
  messageEdited: (data: { groupId: string; message: ChatMessage }) => void;
  messageDeleted: (data: { groupId: string; messageId: string }) => void;
  messagesRead: (data: { groupId: string; userId: string; messageIds: string[]; readAt: string }) => void;

  // Direct messages
  newDirectMessage: (data: { message: DirectMessage }) => void;
  dmRead: (data: { readBy: string; readAt: string }) => void;

  // Typing
  userTyping: (data: { groupId: string; userId: string; user: { id: string; firstName?: string } }) => void;
  userStoppedTyping: (data: { groupId: string; userId: string }) => void;
  userTypingDM: (data: { userId: string; user: { id: string; firstName?: string } }) => void;
  userStoppedTypingDM: (data: { userId: string }) => void;

  // Presence
  userOnline: (data: { userId: string; user: ChatUser }) => void;
  userOffline: (data: { userId: string; lastSeenAt: string }) => void;

  // Group management
  joinedGroup: (data: { groupId: string }) => void;
  leftGroup: (data: { groupId: string }) => void;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MessagesResponse {
  messages: ChatMessage[];
  hasMore: boolean;
  nextCursor?: string;
  isEncrypted: boolean;
}

export interface DirectMessagesResponse {
  messages: DirectMessage[];
  hasMore: boolean;
  nextCursor?: string;
  otherUser: ChatUser;
}
