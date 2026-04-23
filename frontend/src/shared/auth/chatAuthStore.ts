import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { logger } from '@/shared/utils/logger';

interface ChatUser {
  id: string;
  uid: string;
  email: string | null;
  role: string;
  status: string;
  profileImage: string | null;
  employeeDetails?: { firstName: string; lastName: string; displayName?: string } | null;
  studentLogin?: { firstName: string; lastName: string } | null;
}

interface ChatAuthState {
  chatUser: ChatUser | null;
  chatAccessToken: string | null;
  chatRefreshToken: string | null;
  chatSessionId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  loginChat: (username: string, password: string, meta?: { deviceId?: string; platform?: string; deviceName?: string }) => Promise<void>;
  exchangeForChatToken: (umsToken: string) => Promise<void>;
  refreshChatToken: () => Promise<boolean>;
  logoutChat: () => Promise<void>;
  getChatToken: () => string | null;
  bootstrap: () => Promise<void>;
  clearChat: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

export const useChatAuthStore = create<ChatAuthState>()(
  persist(
    (set, get) => ({
      chatUser: null,
      chatAccessToken: null,
      chatRefreshToken: null,
      chatSessionId: null,
      isAuthenticated: false,
      isLoading: false,

      getChatToken: () => get().chatAccessToken,

      loginChat: async (username, password, meta = {}) => {
        logger.debug('ChatAuthStore - loginChat started');
        set({ isLoading: true });
        try {
          const res = await fetch(`${API_URL}/chat-auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              username,
              password,
              platform: meta.platform || 'web',
              deviceId: meta.deviceId,
              deviceName: meta.deviceName,
            }),
          });

          if (!res.ok) {
            const body = await res.json().catch(() => ({ message: 'Login failed' }));
            throw new Error(body.message || 'Chat login failed');
          }

          const { data } = await res.json();

          set({
            chatUser: data.user,
            chatAccessToken: data.chatAccessToken,
            chatRefreshToken: data.chatRefreshToken,
            chatSessionId: data.sessionId,
            isAuthenticated: true,
            isLoading: false,
          });
          logger.debug('ChatAuthStore - loginChat success');
        } catch (error) {
          logger.error('ChatAuthStore - loginChat error:', error);
          set({ chatUser: null, chatAccessToken: null, chatRefreshToken: null, chatSessionId: null, isAuthenticated: false, isLoading: false });
          throw error;
        }
      },

      exchangeForChatToken: async (umsToken: string) => {
        logger.debug('ChatAuthStore - exchangeForChatToken started');
        set({ isLoading: true });
        try {
          const res = await fetch(`${API_URL}/chat-auth/exchange`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${umsToken}`,
            },
            credentials: 'include',
          });

          if (!res.ok) {
            const body = await res.json().catch(() => ({ message: 'Exchange failed' }));
            throw new Error(body.message || 'Chat token exchange failed');
          }

          const { data } = await res.json();

          set({
            chatUser: data.user,
            chatAccessToken: data.chatAccessToken,
            chatRefreshToken: data.chatRefreshToken,
            chatSessionId: data.sessionId,
            isAuthenticated: true,
            isLoading: false,
          });
          logger.debug('ChatAuthStore - exchangeForChatToken success');
        } catch (error) {
          logger.error('ChatAuthStore - exchangeForChatToken error:', error);
          set({ isLoading: false });
          throw error;
        }
      },

      refreshChatToken: async () => {
        const { chatRefreshToken } = get();
        if (!chatRefreshToken) {
          logger.debug('ChatAuthStore - no refresh token available');
          return false;
        }

        try {
          const res = await fetch(`${API_URL}/chat-auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ chatRefreshToken }),
          });

          if (!res.ok) {
            set({ chatUser: null, chatAccessToken: null, chatRefreshToken: null, chatSessionId: null, isAuthenticated: false, isLoading: false });
            return false;
          }

          const { data } = await res.json();

          set({
            chatAccessToken: data.chatAccessToken,
            chatRefreshToken: data.chatRefreshToken,
            chatSessionId: data.sessionId,
          });
          logger.debug('ChatAuthStore - refreshChatToken success');
          return true;
        } catch (error) {
          logger.error('ChatAuthStore - refreshChatToken error:', error);
          set({ chatUser: null, chatAccessToken: null, chatRefreshToken: null, chatSessionId: null, isAuthenticated: false, isLoading: false });
          return false;
        }
      },

      logoutChat: async () => {
        const { chatAccessToken } = get();
        try {
          if (chatAccessToken) {
            await fetch(`${API_URL}/chat-auth/logout`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${chatAccessToken}`,
              },
              credentials: 'include',
            });
          }
        } catch (error) {
          logger.error('ChatAuthStore - logoutChat error:', error);
        } finally {
          set({ chatUser: null, chatAccessToken: null, chatRefreshToken: null, chatSessionId: null, isAuthenticated: false, isLoading: false });
        }
      },

      bootstrap: async () => {
        const state = get();
        // If we have a refresh token but no access token, try refreshing
        if (state.chatRefreshToken && !state.chatAccessToken) {
          logger.debug('ChatAuthStore - bootstrap: refreshing expired access token');
          await get().refreshChatToken();
        }
        // If we have user + access token from persisted state, trust it
        if (state.chatUser && state.chatAccessToken && state.isAuthenticated) {
          logger.debug('ChatAuthStore - bootstrap: using persisted chat auth');
          return;
        }
      },

      clearChat: () => {
        set({ chatUser: null, chatAccessToken: null, chatRefreshToken: null, chatSessionId: null, isAuthenticated: false, isLoading: false });
      },
    }),
    {
      name: 'chat-auth-storage',
      partialize: (state) => ({
        chatUser: state.chatUser,
        chatAccessToken: state.chatAccessToken,
        chatRefreshToken: state.chatRefreshToken,
        chatSessionId: state.chatSessionId,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
