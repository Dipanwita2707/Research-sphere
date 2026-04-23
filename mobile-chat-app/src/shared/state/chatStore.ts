import { create } from 'zustand';
import type {
  ChatGroup,
  ChatMessage,
  DirectMessage,
  Conversation,
  ChatUser,
  ChatGroupMember,
  TypingUser,
} from '../../types/chat.types';

interface ChatState {
  groups: ChatGroup[];
  currentGroupId: string | null;
  currentGroup: ChatGroup | null;
  messagesByGroup: Record<string, ChatMessage[]>;
  hasMoreMessages: Record<string, boolean>;
  messageCursors: Record<string, string | undefined>;
  directMessagesByUser: Record<string, DirectMessage[]>;
  hasMoreDMs: Record<string, boolean>;
  dmCursors: Record<string, string | undefined>;
  conversations: Conversation[];
  currentDMUserId: string | null;
  currentDMUser: ChatUser | null;
  typingByGroup: Record<string, TypingUser[]>;
  typingDM: Record<string, TypingUser | null>;
  onlineUsers: Set<string>;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  replyingTo: ChatMessage | DirectMessage | null;

  // Group actions
  setGroups: (groups: ChatGroup[]) => void;
  addGroup: (group: ChatGroup) => void;
  updateGroup: (groupId: string, updates: Partial<ChatGroup>) => void;
  removeGroup: (groupId: string) => void;
  updateGroupMember: (groupId: string, userId: string, updates: Partial<ChatGroupMember>) => void;
  setCurrentGroup: (groupId: string | null, group?: ChatGroup | null) => void;

  // Message actions
  setMessages: (groupId: string, messages: ChatMessage[], hasMore: boolean, cursor?: string) => void;
  addMessage: (groupId: string, message: ChatMessage) => void;
  prependMessages: (groupId: string, messages: ChatMessage[], hasMore: boolean, cursor?: string) => void;
  updateMessage: (groupId: string, message: ChatMessage) => void;
  removeMessage: (groupId: string, messageId: string) => void;
  updateReadReceipts: (groupId: string, userId: string, messageIds: string[], readAt: string) => void;

  // DM actions
  setDirectMessages: (userId: string, messages: DirectMessage[], hasMore: boolean, cursor?: string) => void;
  addDirectMessage: (userId: string, message: DirectMessage) => void;
  prependDirectMessages: (userId: string, messages: DirectMessage[], hasMore: boolean, cursor?: string) => void;
  updateDirectMessage: (userId: string, message: DirectMessage) => void;
  removeDirectMessage: (userId: string, messageId: string) => void;
  updateDirectMessageRead: (userId: string, readAt: string) => void;

  // Conversation actions
  setConversations: (conversations: Conversation[]) => void;
  setCurrentDMUser: (userId: string | null, user?: ChatUser | null) => void;

  // Typing actions
  setTypingUsers: (groupId: string, user: TypingUser) => void;
  removeTypingUser: (groupId: string, userId: string) => void;
  setDMTypingUser: (userId: string, user: TypingUser) => void;
  removeDMTypingUser: (userId: string) => void;

  // Online status
  setOnlineUsers: (userIds: string[]) => void;
  addOnlineUser: (userId: string) => void;
  removeOnlineUser: (userId: string) => void;

  // UI
  setLoading: (loading: boolean) => void;
  setSending: (sending: boolean) => void;
  setError: (error: string | null) => void;
  setReplyingTo: (message: ChatMessage | DirectMessage | null) => void;

  clearChat: () => void;
}

const initialState = {
  groups: [] as ChatGroup[],
  currentGroupId: null as string | null,
  currentGroup: null as ChatGroup | null,
  messagesByGroup: {} as Record<string, ChatMessage[]>,
  hasMoreMessages: {} as Record<string, boolean>,
  messageCursors: {} as Record<string, string | undefined>,
  directMessagesByUser: {} as Record<string, DirectMessage[]>,
  hasMoreDMs: {} as Record<string, boolean>,
  dmCursors: {} as Record<string, string | undefined>,
  conversations: [] as Conversation[],
  currentDMUserId: null as string | null,
  currentDMUser: null as ChatUser | null,
  typingByGroup: {} as Record<string, TypingUser[]>,
  typingDM: {} as Record<string, TypingUser | null>,
  onlineUsers: new Set<string>(),
  isLoading: false,
  isSending: false,
  error: null as string | null,
  replyingTo: null as ChatMessage | DirectMessage | null,
};

export const useChatStore = create<ChatState>()((set, get) => ({
  ...initialState,

  // Groups
  setGroups: (groups) => set({ groups }),
  addGroup: (group) => set((s) => ({ groups: [group, ...s.groups] })),
  updateGroup: (groupId, updates) =>
    set((s) => ({
      groups: s.groups.map((g) => (g.id === groupId ? { ...g, ...updates } : g)),
      currentGroup: s.currentGroup?.id === groupId ? { ...s.currentGroup, ...updates } : s.currentGroup,
    })),
  removeGroup: (groupId) =>
    set((s) => ({
      groups: s.groups.filter((g) => g.id !== groupId),
      currentGroupId: s.currentGroupId === groupId ? null : s.currentGroupId,
      currentGroup: s.currentGroup?.id === groupId ? null : s.currentGroup,
    })),
  updateGroupMember: (groupId, userId, updates) =>
    set((s) => {
      const upd = (m?: ChatGroupMember[]) =>
        m?.map((x) => (x.userId === userId ? { ...x, ...updates } : x));
      return {
        groups: s.groups.map((g) => (g.id === groupId ? { ...g, members: upd(g.members) } : g)),
        currentGroup:
          s.currentGroup?.id === groupId
            ? { ...s.currentGroup, members: upd(s.currentGroup.members) }
            : s.currentGroup,
      };
    }),
  setCurrentGroup: (groupId, group) =>
    set({ currentGroupId: groupId, currentGroup: group ?? null, currentDMUserId: null }),

  // Messages
  setMessages: (groupId, messages, hasMore, cursor) =>
    set((s) => ({
      messagesByGroup: { ...s.messagesByGroup, [groupId]: [...messages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) },
      hasMoreMessages: { ...s.hasMoreMessages, [groupId]: hasMore },
      messageCursors: { ...s.messageCursors, [groupId]: cursor },
    })),
  addMessage: (groupId, message) =>
    set((s) => {
      const existing = s.messagesByGroup[groupId] || [];
      if (existing.some((m) => m.id === message.id)) return s;
      return { messagesByGroup: { ...s.messagesByGroup, [groupId]: [message, ...existing] } };
    }),
  prependMessages: (groupId, messages, hasMore, cursor) =>
    set((s) => {
      const existing = s.messagesByGroup[groupId] || [];
      const ids = new Set(existing.map((m) => m.id));
      const fresh = messages.filter((m) => !ids.has(m.id));
      return {
        messagesByGroup: { ...s.messagesByGroup, [groupId]: [...existing, ...fresh] },
        hasMoreMessages: { ...s.hasMoreMessages, [groupId]: hasMore },
        messageCursors: { ...s.messageCursors, [groupId]: cursor },
      };
    }),
  updateMessage: (groupId, message) =>
    set((s) => ({
      messagesByGroup: {
        ...s.messagesByGroup,
        [groupId]: (s.messagesByGroup[groupId] || []).map((m) => (m.id === message.id ? message : m)),
      },
    })),
  removeMessage: (groupId, messageId) =>
    set((s) => ({
      messagesByGroup: {
        ...s.messagesByGroup,
        [groupId]: (s.messagesByGroup[groupId] || []).filter((m) => m.id !== messageId),
      },
    })),
  updateReadReceipts: (groupId, userId, messageIds, readAt) =>
    set((s) => ({
      messagesByGroup: {
        ...s.messagesByGroup,
        [groupId]: (s.messagesByGroup[groupId] || []).map((m) => {
          if (!messageIds.includes(m.id)) return m;
          const existing = m.readBy || [];
          if (existing.some((r) => r.userId === userId)) return m;
          return { ...m, readBy: [...existing, { userId, readAt }] };
        }),
      },
    })),

  // DMs
  setDirectMessages: (userId, messages, hasMore, cursor) =>
    set((s) => ({
      directMessagesByUser: { ...s.directMessagesByUser, [userId]: [...messages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) },
      hasMoreDMs: { ...s.hasMoreDMs, [userId]: hasMore },
      dmCursors: { ...s.dmCursors, [userId]: cursor },
    })),
  addDirectMessage: (userId, message) =>
    set((s) => {
      const existing = s.directMessagesByUser[userId] || [];
      if (existing.some((m) => m.id === message.id)) return s;
      return { directMessagesByUser: { ...s.directMessagesByUser, [userId]: [message, ...existing] } };
    }),
  prependDirectMessages: (userId, messages, hasMore, cursor) =>
    set((s) => {
      const existing = s.directMessagesByUser[userId] || [];
      const ids = new Set(existing.map((m) => m.id));
      const fresh = messages.filter((m) => !ids.has(m.id));
      return {
        directMessagesByUser: { ...s.directMessagesByUser, [userId]: [...existing, ...fresh] },
        hasMoreDMs: { ...s.hasMoreDMs, [userId]: hasMore },
        dmCursors: { ...s.dmCursors, [userId]: cursor },
      };
    }),
  updateDirectMessage: (userId, message) =>
    set((s) => ({
      directMessagesByUser: {
        ...s.directMessagesByUser,
        [userId]: (s.directMessagesByUser[userId] || []).map((m) => (m.id === message.id ? message : m)),
      },
    })),
  removeDirectMessage: (userId, messageId) =>
    set((s) => ({
      directMessagesByUser: {
        ...s.directMessagesByUser,
        [userId]: (s.directMessagesByUser[userId] || []).filter((m) => m.id !== messageId),
      },
    })),
  updateDirectMessageRead: (userId, readAt) =>
    set((s) => {
      const myId = useChatAuthStore_getId();
      return {
        directMessagesByUser: {
          ...s.directMessagesByUser,
          [userId]: (s.directMessagesByUser[userId] || []).map((m) =>
            myId && m.senderId === myId && !m.readAt ? { ...m, readAt } : m,
          ),
        },
      };
    }),

  // Conversations
  setConversations: (conversations) => set({ conversations }),
  setCurrentDMUser: (userId, user) =>
    set((s) => {
      let dmUser = user ?? null;
      if (userId && !dmUser) {
        const conv = s.conversations.find((c) => c.user.id === userId);
        if (conv) dmUser = conv.user;
      }
      return { currentDMUserId: userId, currentDMUser: dmUser, currentGroupId: null, currentGroup: null };
    }),

  // Typing
  setTypingUsers: (groupId, user) =>
    set((s) => {
      const existing = s.typingByGroup[groupId] || [];
      if (existing.some((u) => u.userId === user.userId)) return s;
      return { typingByGroup: { ...s.typingByGroup, [groupId]: [...existing, user] } };
    }),
  removeTypingUser: (groupId, userId) =>
    set((s) => ({
      typingByGroup: {
        ...s.typingByGroup,
        [groupId]: (s.typingByGroup[groupId] || []).filter((u) => u.userId !== userId),
      },
    })),
  setDMTypingUser: (userId, user) =>
    set((s) => ({ typingDM: { ...s.typingDM, [userId]: user } })),
  removeDMTypingUser: (userId) =>
    set((s) => ({ typingDM: { ...s.typingDM, [userId]: null } })),

  // Online
  setOnlineUsers: (userIds) => set({ onlineUsers: new Set(userIds) }),
  addOnlineUser: (userId) =>
    set((s) => {
      const n = new Set(s.onlineUsers);
      n.add(userId);
      return { onlineUsers: n };
    }),
  removeOnlineUser: (userId) =>
    set((s) => {
      const n = new Set(s.onlineUsers);
      n.delete(userId);
      return { onlineUsers: n };
    }),

  // UI
  setLoading: (loading) => set({ isLoading: loading }),
  setSending: (sending) => set({ isSending: sending }),
  setError: (error) => set({ error }),
  setReplyingTo: (message) => set({ replyingTo: message }),

  clearChat: () => set({ ...initialState, onlineUsers: new Set<string>() }),
}));

// Helper to avoid circular imports
function useChatAuthStore_getId(): string | null {
  try {
    const { useChatAuthStore } = require('../state/chatAuthStore');
    return useChatAuthStore.getState().chatUser?.id ?? null;
  } catch {
    return null;
  }
}

// Selector hooks
export const useGroups = () => useChatStore((s) => s.groups);
export const useCurrentGroup = () => useChatStore((s) => s.currentGroup);
export const useMessages = (groupId: string) => useChatStore((s) => s.messagesByGroup[groupId] || []);
export const useDirectMessages = (userId: string) => useChatStore((s) => s.directMessagesByUser[userId] || []);
export const useConversations = () => useChatStore((s) => s.conversations);
export const useTypingUsers = (groupId: string) => useChatStore((s) => s.typingByGroup[groupId] || []);
export const useDMTyping = (userId: string) => useChatStore((s) => s.typingDM[userId]);
export const useIsOnline = (userId: string) => useChatStore((s) => s.onlineUsers.has(userId));
