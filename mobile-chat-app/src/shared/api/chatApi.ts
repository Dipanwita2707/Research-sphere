import axios from 'axios';

// Lazy getter breaks the circular dependency with chatAuthStore
const getAuthStore = () =>
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('../state/chatAuthStore').useChatAuthStore as typeof import('../state/chatAuthStore').useChatAuthStore;

// Dynamic base URL — updated at startup from AsyncStorage via serverConfig.setServerUrl()
let API_URL = 'http://localhost:5001/api/v1';

const chatApi = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

/** Called by serverConfig when URL changes — updates axios instance immediately */
export function updateBaseUrl(newUrl: string) {
  API_URL = newUrl;
  chatApi.defaults.baseURL = newUrl;
}

// Attach chat access token
chatApi.interceptors.request.use((config) => {
  const token = getAuthStore().getState().chatAccessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
let refreshPromise: Promise<string | null> | null = null;

const isAuthRefreshRequest = (url?: string) => {
  if (!url) return false;
  return url.includes('/chat-auth/refresh') || url.includes('/chat-auth/login') || url.includes('/chat-auth/exchange');
};

chatApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !isAuthRefreshRequest(original?.url)) {
      original._retry = true;

      if (!refreshPromise) {
        refreshPromise = getAuthStore()
          .getState()
          .refreshChatToken()
          .then((token) => {
            refreshPromise = null;
            return token;
          })
          .catch(() => {
            refreshPromise = null;
            getAuthStore().getState().clearChat();
            return null;
          });
      }

      const newToken = await refreshPromise;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return chatApi(original);
      }
    }
    return Promise.reject(error);
  },
);

export default chatApi;
export { API_URL };
