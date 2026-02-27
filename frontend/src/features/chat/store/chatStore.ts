'use client';

/**
 * Chat Store using Zustand
 * Centralized state management for chat functionality
 */
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { useAuthStore } from '@/shared/auth/authStore';
import type {
  ChatGroup,
  ChatMessage,
  DirectMessage,
  Conversation,
  ChatUser,
  TypingUser,
  EffectivePermissions,
  ChatGroupMember,
} from '../types';

interface ChatState {
  // Groups
  groups: ChatGroup[];
  currentGroupId: string | null;
  currentGroup: ChatGroup | null;

  // Messages (grouped by groupId)
  messagesByGroup: Record<string, ChatMessage[]>;
  hasMoreMessages: Record<string, boolean>;
  messageCursors: Record<string, string | undefined>;

  // Direct Messages (grouped by otherUserId)
  directMessagesByUser: Record<string, DirectMessage[]>;
  hasMoreDMs: Record<string, boolean>;
  dmCursors: Record<string, string | undefined>;

  // Conversations
  conversations: Conversation[];
  currentDMUserId: string | null;
  currentDMUser: ChatUser | null;

  // Typing indicators
  typingByGroup: Record<string, TypingUser[]>;
  typingDM: Record<string, TypingUser | null>;

  // Online status
  onlineUsers: Set<string>;

  // UI State
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  showGroupSettings: boolean;
  showMemberList: boolean;
  replyingTo: ChatMessage | DirectMessage | null;

  // Actions
  setGroups: (groups: ChatGroup[]) => void;
  addGroup: (group: ChatGroup) => void;
  updateGroup: (groupId: string, updates: Partial<ChatGroup>) => void;
  removeGroup: (groupId: string) => void;
  updateGroupMember: (groupId: string, userId: string, updates: Partial<ChatGroupMember>) => void;
  setCurrentGroup: (groupId: string | null, group?: ChatGroup | null) => void;

  setMessages: (groupId: string, messages: ChatMessage[], hasMore: boolean, cursor?: string) => void;
  addMessage: (groupId: string, message: ChatMessage) => void;
  prependMessages: (groupId: string, messages: ChatMessage[], hasMore: boolean, cursor?: string) => void;
  updateMessage: (groupId: string, message: ChatMessage) => void;
  removeMessage: (groupId: string, messageId: string) => void;
  updateReadReceipts: (groupId: string, userId: string, messageIds: string[], readAt: string) => void;

  setDirectMessages: (userId: string, messages: DirectMessage[], hasMore: boolean, cursor?: string) => void;
  addDirectMessage: (userId: string, message: DirectMessage) => void;
  prependDirectMessages: (userId: string, messages: DirectMessage[], hasMore: boolean, cursor?: string) => void;
  updateDirectMessage: (userId: string, message: DirectMessage) => void;
  removeDirectMessage: (userId: string, messageId: string) => void;
  updateDirectMessageRead: (userId: string, readAt: string) => void;

  setConversations: (conversations: Conversation[]) => void;
  setCurrentDMUser: (userId: string | null, user?: ChatUser | null) => void;

  setTypingUsers: (groupId: string, user: TypingUser) => void;
  removeTypingUser: (groupId: string, userId: string) => void;
  setDMTypingUser: (userId: string, user: TypingUser) => void;
  removeDMTypingUser: (userId: string) => void;

  setOnlineUsers: (userIds: string[]) => void;
  addOnlineUser: (userId: string) => void;
  removeOnlineUser: (userId: string) => void;

  setLoading: (loading: boolean) => void;
  setSending: (sending: boolean) => void;
  setError: (error: string | null) => void;
  setShowGroupSettings: (show: boolean) => void;
  setShowMemberList: (show: boolean) => void;
  setReplyingTo: (message: ChatMessage | DirectMessage | null) => void;

  clearChat: () => void;
}

export const useChatStore = create<ChatState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        groups: [],
        currentGroupId: null,
        currentGroup: null,
        messagesByGroup: {},
        hasMoreMessages: {},
        messageCursors: {},
        directMessagesByUser: {},
        hasMoreDMs: {},
        dmCursors: {},
        conversations: [],
        currentDMUserId: null,
        currentDMUser: null,
        typingByGroup: {},
        typingDM: {},
        onlineUsers: new Set(),
        isLoading: false,
        isSending: false,
        error: null,
        showGroupSettings: false,
        showMemberList: false,
        replyingTo: null,

        // Group actions
        setGroups: (groups) => set({ groups }),
        
        addGroup: (group) => set((state) => ({
          groups: [group, ...state.groups],
        })),
        
        updateGroup: (groupId, updates) => set((state) => ({
          groups: state.groups.map((g) => 
            g.id === groupId ? { ...g, ...updates } : g
          ),
          currentGroup: state.currentGroup?.id === groupId 
            ? { ...state.currentGroup, ...updates } 
            : state.currentGroup,
        })),
        
        removeGroup: (groupId) => set((state) => ({
          groups: state.groups.filter((g) => g.id !== groupId),
          currentGroupId: state.currentGroupId === groupId ? null : state.currentGroupId,
          currentGroup: state.currentGroup?.id === groupId ? null : state.currentGroup,
        })),
        
        updateGroupMember: (groupId, userId, updates) => set((state) => {
          const updateMembers = (members?: ChatGroupMember[]) => {
            if (!members) return members;
            return members.map((m) => 
              m.userId === userId ? { ...m, ...updates } : m
            );
          };
          
          return {
            groups: state.groups.map((g) => 
              g.id === groupId 
                ? { ...g, members: updateMembers(g.members) }
                : g
            ),
            currentGroup: state.currentGroup?.id === groupId
              ? { ...state.currentGroup, members: updateMembers(state.currentGroup.members) }
              : state.currentGroup,
          };
        }),
        
        setCurrentGroup: (groupId, group) => set({
          currentGroupId: groupId,
          currentGroup: group ?? null,
          currentDMUserId: null, // Clear DM when switching to group
        }),

        // Message actions
        setMessages: (groupId, messages, hasMore, cursor) => set((state) => ({
          messagesByGroup: { ...state.messagesByGroup, [groupId]: messages },
          hasMoreMessages: { ...state.hasMoreMessages, [groupId]: hasMore },
          messageCursors: { ...state.messageCursors, [groupId]: cursor },
        })),
        
        addMessage: (groupId, message) => set((state) => {
          const existing = state.messagesByGroup[groupId] || [];
          // Check for duplicate
          if (existing.some((m) => m.id === message.id)) {
            return state;
          }
          return {
            messagesByGroup: {
              ...state.messagesByGroup,
              [groupId]: [...existing, message],
            },
          };
        }),
        
        prependMessages: (groupId, messages, hasMore, cursor) => set((state) => {
          const existing = state.messagesByGroup[groupId] || [];
          const existingIds = new Set(existing.map((m) => m.id));
          const newMessages = messages.filter((m) => !existingIds.has(m.id));
          return {
            messagesByGroup: {
              ...state.messagesByGroup,
              [groupId]: [...newMessages, ...existing],
            },
            hasMoreMessages: { ...state.hasMoreMessages, [groupId]: hasMore },
            messageCursors: { ...state.messageCursors, [groupId]: cursor },
          };
        }),
        
        updateMessage: (groupId, message) => set((state) => ({
          messagesByGroup: {
            ...state.messagesByGroup,
            [groupId]: (state.messagesByGroup[groupId] || []).map((m) =>
              m.id === message.id ? message : m
            ),
          },
        })),
        
        removeMessage: (groupId, messageId) => set((state) => ({
          messagesByGroup: {
            ...state.messagesByGroup,
            [groupId]: (state.messagesByGroup[groupId] || []).filter((m) => m.id !== messageId),
          },
        })),
        
        updateReadReceipts: (groupId, userId, messageIds, readAt) => set((state) => ({
          messagesByGroup: {
            ...state.messagesByGroup,
            [groupId]: (state.messagesByGroup[groupId] || []).map((m) => {
              if (messageIds.includes(m.id)) {
                const existingReceipts = m.readBy || [];
                if (!existingReceipts.some((r) => r.userId === userId)) {
                  return {
                    ...m,
                    readBy: [...existingReceipts, { userId, readAt }],
                  };
                }
              }
              return m;
            }),
          },
        })),

        // Direct message actions
        setDirectMessages: (userId, messages, hasMore, cursor) => set((state) => ({
          directMessagesByUser: { ...state.directMessagesByUser, [userId]: messages },
          hasMoreDMs: { ...state.hasMoreDMs, [userId]: hasMore },
          dmCursors: { ...state.dmCursors, [userId]: cursor },
        })),
        
        addDirectMessage: (userId, message) => set((state) => {
          const existing = state.directMessagesByUser[userId] || [];
          if (existing.some((m) => m.id === message.id)) {
            return state;
          }
          return {
            directMessagesByUser: {
              ...state.directMessagesByUser,
              [userId]: [...existing, message],
            },
          };
        }),
        
        prependDirectMessages: (userId, messages, hasMore, cursor) => set((state) => {
          const existing = state.directMessagesByUser[userId] || [];
          const existingIds = new Set(existing.map((m) => m.id));
          const newMessages = messages.filter((m) => !existingIds.has(m.id));
          return {
            directMessagesByUser: {
              ...state.directMessagesByUser,
              [userId]: [...newMessages, ...existing],
            },
            hasMoreDMs: { ...state.hasMoreDMs, [userId]: hasMore },
            dmCursors: { ...state.dmCursors, [userId]: cursor },
          };
        }),
        
        updateDirectMessage: (userId, message) => set((state) => ({
          directMessagesByUser: {
            ...state.directMessagesByUser,
            [userId]: (state.directMessagesByUser[userId] || []).map((m) =>
              m.id === message.id ? message : m
            ),
          },
        })),
        
        removeDirectMessage: (userId, messageId) => set((state) => ({
          directMessagesByUser: {
            ...state.directMessagesByUser,
            [userId]: (state.directMessagesByUser[userId] || []).filter((m) => m.id !== messageId),
          },
        })),
        
        updateDirectMessageRead: (userId, readAt) => set((state) => {
          // Get current user id to only mark messages I sent as read
          const currentUserId = useAuthStore.getState().user?.id ?? null;
          
          return {
            directMessagesByUser: {
              ...state.directMessagesByUser,
              [userId]: (state.directMessagesByUser[userId] || []).map((m) => {
                // Only mark messages sent by me as read (other user read them)
                if (currentUserId && m.senderId === currentUserId && !m.readAt) {
                  return { ...m, readAt };
                }
                return m;
              }),
            },
          };
        }),

        // Conversation actions
        setConversations: (conversations) => set({ conversations }),
        setCurrentDMUser: (userId, user) => set((state) => {
          // Try to find user info from conversations if not provided
          let dmUser = user ?? null;
          if (userId && !dmUser) {
            const conv = state.conversations.find(c => c.user.id === userId);
            if (conv) {
              dmUser = conv.user;
            }
          }
          return {
            currentDMUserId: userId,
            currentDMUser: dmUser,
            currentGroupId: null, // Clear group when switching to DM
            currentGroup: null,
          };
        }),

        // Typing actions
        setTypingUsers: (groupId, user) => set((state) => {
          const existing = state.typingByGroup[groupId] || [];
          if (existing.some((u) => u.userId === user.userId)) {
            return state;
          }
          return {
            typingByGroup: {
              ...state.typingByGroup,
              [groupId]: [...existing, user],
            },
          };
        }),
        
        removeTypingUser: (groupId, userId) => set((state) => ({
          typingByGroup: {
            ...state.typingByGroup,
            [groupId]: (state.typingByGroup[groupId] || []).filter((u) => u.userId !== userId),
          },
        })),
        
        setDMTypingUser: (userId, user) => set((state) => ({
          typingDM: { ...state.typingDM, [userId]: user },
        })),
        
        removeDMTypingUser: (userId) => set((state) => ({
          typingDM: { ...state.typingDM, [userId]: null },
        })),

        // Online status actions
        setOnlineUsers: (userIds) => set({ onlineUsers: new Set(userIds) }),
        
        addOnlineUser: (userId) => set((state) => {
          const newSet = new Set(state.onlineUsers);
          newSet.add(userId);
          return { onlineUsers: newSet };
        }),
        
        removeOnlineUser: (userId) => set((state) => {
          const newSet = new Set(state.onlineUsers);
          newSet.delete(userId);
          return { onlineUsers: newSet };
        }),

        // UI actions
        setLoading: (loading) => set({ isLoading: loading }),
        setSending: (sending) => set({ isSending: sending }),
        setError: (error) => set({ error }),
        setShowGroupSettings: (show) => set({ showGroupSettings: show }),
        setShowMemberList: (show) => set({ showMemberList: show }),
        setReplyingTo: (message) => set({ replyingTo: message }),

        // Clear all chat data
        clearChat: () => set({
          groups: [],
          currentGroupId: null,
          currentGroup: null,
          messagesByGroup: {},
          hasMoreMessages: {},
          messageCursors: {},
          directMessagesByUser: {},
          hasMoreDMs: {},
          dmCursors: {},
          conversations: [],
          currentDMUserId: null,
          currentDMUser: null,
          typingByGroup: {},
          typingDM: {},
          onlineUsers: new Set(),
          isLoading: false,
          isSending: false,
          error: null,
          showGroupSettings: false,
          showMemberList: false,
          replyingTo: null,
        }),
      }),
      {
        name: 'chat-store',
        partialize: (state) => ({
          // Only persist essential data
          currentGroupId: state.currentGroupId,
          currentDMUserId: state.currentDMUserId,
        }),
        // Handle Set serialization
        storage: {
          getItem: (name) => {
            const str = localStorage.getItem(name);
            if (!str) return null;
            return JSON.parse(str);
          },
          setItem: (name, value) => {
            localStorage.setItem(name, JSON.stringify(value));
          },
          removeItem: (name) => localStorage.removeItem(name),
        },
      }
    ),
    { name: 'ChatStore' }
  )
);

// Selector hooks for performance
export const useCurrentGroup = () => useChatStore((state) => state.currentGroup);
export const useCurrentDMUser = () => useChatStore((state) => state.currentDMUser);
export const useGroups = () => useChatStore((state) => state.groups);
export const useMessages = (groupId: string) => useChatStore((state) => state.messagesByGroup[groupId] || []);
export const useDirectMessages = (userId: string) => useChatStore((state) => state.directMessagesByUser[userId] || []);
export const useConversations = () => useChatStore((state) => state.conversations);
export const useTypingUsers = (groupId: string) => useChatStore((state) => state.typingByGroup[groupId] || []);
export const useDMTyping = (userId: string) => useChatStore((state) => state.typingDM[userId]);
export const useIsOnline = (userId: string) => useChatStore((state) => state.onlineUsers.has(userId));
export const useChatLoading = () => useChatStore((state) => state.isLoading);
export const useChatError = () => useChatStore((state) => state.error);
