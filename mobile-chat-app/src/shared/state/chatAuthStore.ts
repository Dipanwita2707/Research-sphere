import { create } from 'zustand';
import { secureStorage, KEYS } from '../storage/secureStorage';
import chatApi from '../api/chatApi';
import type { ChatUser, ApiResponse } from '../../types/chat.types';
import { Platform } from 'react-native';

interface ChatAuthState {
  chatUser: ChatUser | null;
  chatAccessToken: string | null;
  chatRefreshToken: string | null;
  chatSessionId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  loginChat: (uid: string, password: string) => Promise<void>;
  refreshChatToken: () => Promise<string | null>;
  logoutChat: () => Promise<void>;
  getChatToken: () => string | null;
  bootstrap: () => Promise<void>;
  clearChat: () => void;
}

export const useChatAuthStore = create<ChatAuthState>()((set, get) => ({
  chatUser: null,
  chatAccessToken: null,
  chatRefreshToken: null,
  chatSessionId: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  loginChat: async (uid: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await chatApi.post<ApiResponse<{
        user: ChatUser;
        chatAccessToken: string;
        chatRefreshToken: string;
        sessionId: string;
      }>>('/chat-auth/login', {
        username: uid,
        password,
        platform: Platform.OS,
        deviceName: `${Platform.OS} ${Platform.Version}`,
      });

      const { user, chatAccessToken, chatRefreshToken, sessionId } = res.data.data!;

      await Promise.all([
        secureStorage.set(KEYS.ACCESS_TOKEN, chatAccessToken),
        secureStorage.set(KEYS.REFRESH_TOKEN, chatRefreshToken),
        secureStorage.set(KEYS.SESSION_ID, sessionId),
        secureStorage.set(KEYS.USER, JSON.stringify(user)),
      ]);

      set({
        chatUser: user,
        chatAccessToken,
        chatRefreshToken,
        chatSessionId: sessionId,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || 'Login failed';
      set({ isLoading: false, error: msg });
      throw new Error(msg);
    }
  },

  refreshChatToken: async () => {
    const refreshToken = get().chatRefreshToken || (await secureStorage.get(KEYS.REFRESH_TOKEN));
    if (!refreshToken) {
      get().clearChat();
      return null;
    }

    try {
      const res = await chatApi.post<ApiResponse<{
        chatAccessToken: string;
        chatRefreshToken: string;
      }>>('/chat-auth/refresh', { chatRefreshToken: refreshToken });

      const { chatAccessToken, chatRefreshToken: newRefresh } = res.data.data!;

      await Promise.all([
        secureStorage.set(KEYS.ACCESS_TOKEN, chatAccessToken),
        secureStorage.set(KEYS.REFRESH_TOKEN, newRefresh),
      ]);

      set({
        chatAccessToken,
        chatRefreshToken: newRefresh,
      });

      return chatAccessToken;
    } catch {
      get().clearChat();
      return null;
    }
  },

  logoutChat: async () => {
    try {
      await chatApi.post('/chat-auth/logout');
    } catch {
      // ignore — clear local state anyway
    }
    get().clearChat();
  },

  getChatToken: () => get().chatAccessToken,

  bootstrap: async () => {
    set({ isLoading: true });
    try {
      const [refreshToken, userJson] = await Promise.all([
        secureStorage.get(KEYS.REFRESH_TOKEN),
        secureStorage.get(KEYS.USER),
      ]);

      if (!refreshToken) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      // Restore user from storage while refreshing
      if (userJson) {
        try {
          set({ chatUser: JSON.parse(userJson) });
        } catch { /* ignore parse error */ }
      }

      set({ chatRefreshToken: refreshToken });
      const token = await get().refreshChatToken();

      if (token) {
        // Refresh user profile
        try {
          const res = await chatApi.get<ApiResponse<ChatUser>>('/chat-auth/me');
          const user = res.data.data!;
          await secureStorage.set(KEYS.USER, JSON.stringify(user));
          set({ chatUser: user, isAuthenticated: true, isLoading: false });
        } catch {
          set({ isAuthenticated: true, isLoading: false });
        }
      } else {
        set({ isLoading: false, isAuthenticated: false });
      }
    } catch {
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  clearChat: () => {
    secureStorage.clearAll();
    set({
      chatUser: null,
      chatAccessToken: null,
      chatRefreshToken: null,
      chatSessionId: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  },
}));
