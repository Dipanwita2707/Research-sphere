import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVER_URL_KEY = 'sgt_server_url';

const DEFAULT_URL = 'http://10.20.61.210:5001';

export const serverConfig = {
  /** Returns saved server URL, or null if not yet configured */
  async getServerUrl(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(SERVER_URL_KEY);
    } catch {
      return null;
    }
  },

  /** Returns saved server URL or fallback default */
  async getServerUrlOrDefault(): Promise<string> {
    const saved = await this.getServerUrl();
    return saved || DEFAULT_URL;
  },

  /** Save server URL (strips trailing slash) */
  async setServerUrl(url: string): Promise<void> {
    const cleaned = url.trim().replace(/\/$/, '');
    await AsyncStorage.setItem(SERVER_URL_KEY, cleaned);
    // Update chatApi base URL immediately
    const { updateBaseUrl } = require('../api/chatApi');
    updateBaseUrl(cleaned + '/api/v1');
    // Update socket URL immediately
    const { updateSocketUrl } = require('../socket/useSocket');
    updateSocketUrl(cleaned);
  },

  /** True if the user has saved a server URL */
  async isConfigured(): Promise<boolean> {
    const url = await this.getServerUrl();
    return !!url;
  },

  /** Clear saved URL (for resetting) */
  async clear(): Promise<void> {
    await AsyncStorage.removeItem(SERVER_URL_KEY);
  },
};
