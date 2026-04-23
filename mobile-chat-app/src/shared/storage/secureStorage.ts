import * as SecureStore from 'expo-secure-store';

const KEYS = {
  ACCESS_TOKEN: 'chat-access-token',
  REFRESH_TOKEN: 'chat-refresh-token',
  SESSION_ID: 'chat-session-id',
  USER: 'chat-user',
} as const;

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      console.warn('SecureStorage set failed:', key, e);
    }
  },

  async remove(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore
    }
  },

  async clearAll(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN).catch(() => {}),
      SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN).catch(() => {}),
      SecureStore.deleteItemAsync(KEYS.SESSION_ID).catch(() => {}),
      SecureStore.deleteItemAsync(KEYS.USER).catch(() => {}),
    ]);
  },
};

export { KEYS };
