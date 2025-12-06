import axios from 'axios';
import { useSettingsStore } from '../stores/settingsStore';

// Dynamically determine API URL based on current location
// Use env var if set, otherwise use current origin (works on any IP/hostname)
const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // In production, API is on port 3000 of the same host
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:3000`;
};

const API_URL = getApiUrl();

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging and adding authentication
api.interceptors.request.use((config) => {
  console.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
  
  // Add API key header for admin requests 
  // POST, PATCH, PUT, DELETE always include it
  // GET requests include it if config.requiresAuth is set
  const method = config.method?.toUpperCase();
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) || config.requiresAuth) {
    const apiKey = useSettingsStore.getState().apiKey;
    if (apiKey) {
      config.headers['X-API-Key'] = apiKey;
    }
  }
  
  // Add Bearer token for OAuth endpoints (user auth)
  // Import auth store dynamically to avoid circular deps
  const needsBearerAuth = (
    (config.url?.startsWith('/oauth/') && !config.url?.includes('/login') && !config.url?.includes('/callback') && !config.url?.includes('/refresh')) ||
    config.url?.startsWith('/chat/') ||
    config.url?.startsWith('/webhooks') ||
    config.url?.startsWith('/admin/oauth-users') ||
    config.url?.startsWith('/admin/tiers') ||
    config.url?.startsWith('/admin/users/') ||
    config.url?.startsWith('/admin/usage') ||
    config.url?.startsWith('/me/')
  );
  
  if (needsBearerAuth) {
    const authState = JSON.parse(localStorage.getItem('chatterbox-auth') || '{}');
    const accessToken = authState?.state?.accessToken;
    if (accessToken) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }
  }
  
  return config;
});

// Response interceptor for error handling and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    console.error('API Error:', error.response?.data || error.message);
    
    // Handle token expiration
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED') {
      const authState = JSON.parse(localStorage.getItem('chatterbox-auth') || '{}');
      const refreshToken = authState?.state?.refreshToken;
      
      if (refreshToken && !error.config._retry) {
        error.config._retry = true;
        
        try {
          const refreshResponse = await api.post('/oauth/refresh', { refreshToken });
          const newAccessToken = refreshResponse.data.accessToken;
          
          // Update stored token
          authState.state.accessToken = newAccessToken;
          localStorage.setItem('chatterbox-auth', JSON.stringify(authState));
          
          // Retry original request
          error.config.headers['Authorization'] = `Bearer ${newAccessToken}`;
          return api.request(error.config);
        } catch (refreshError) {
          // Refresh failed, clear auth state
          localStorage.removeItem('chatterbox-auth');
          window.location.href = '/login?error=session_expired';
          return Promise.reject(refreshError);
        }
      }
    }
    
    return Promise.reject(error);
  }
);

// Messages API
export const messagesApi = {
  getAll: (params) => api.get('/messages', { params }),
  search: (params) => api.get('/messages/search', { params }),
  getById: (id) => api.get(`/messages/${id}`),
};

// Users API
export const usersApi = {
  getAll: (params) => api.get('/users', { params }),
  getTop: (params) => api.get('/users/top', { params }),
  getBlocked: (params) => api.get('/users/blocked', { params, requiresAuth: true }),
  getByUsername: (username) => api.get(`/users/${username}`),
  getMessages: (username, params) => api.get(`/users/${username}/messages`, { params }),
  getModActions: (username, params) => api.get(`/users/${username}/mod-actions`, { params }),
  getStats: (username) => api.get(`/users/${username}/stats`),
  exportData: (username) => api.get(`/users/${username}/export`, { requiresAuth: true }),
  block: (username, reason) => api.post(`/users/${username}/block`, { reason }),
  unblock: (username) => api.post(`/users/${username}/unblock`),
  updateNotes: (username, notes) => api.patch(`/users/${username}/notes`, { notes }),
  deleteMessages: (username) => api.delete(`/users/${username}/messages`),
  deleteUser: (username) => api.delete(`/users/${username}`),
  // Analytics
  getActivityAnalytics: (username, params) => api.get(`/users/${username}/analytics/activity`, { params }),
  getChannelAnalytics: (username, params) => api.get(`/users/${username}/analytics/channels`, { params }),
  getEmoteAnalytics: (username, params) => api.get(`/users/${username}/analytics/emotes`, { params }),
  getSummaryAnalytics: (username, params) => api.get(`/users/${username}/analytics/summary`, { params }),
};

// Mod Actions API
export const modActionsApi = {
  getAll: (params) => api.get('/mod-actions', { params }),
  getRecent: (limit = 100) => api.get('/mod-actions/recent', { params: { limit } }),
  getStats: (params) => api.get('/mod-actions/stats', { params }),
};

// Channels API
export const channelsApi = {
  getAll: (params) => api.get('/channels', { params }),
  getByName: (name) => api.get(`/channels/${name}`),
  getStats: (name, params) => api.get(`/channels/${name}/stats`, { params }),
  getTopUsers: (name, params) => api.get(`/channels/${name}/top-users`, { params }),
  getLinks: (name, params) => api.get(`/channels/${name}/links`, { params }),
  create: (name) => api.post('/channels', { name }),
  update: (name, data) => api.patch(`/channels/${name}`, data),
  delete: (name) => api.delete(`/channels/${name}`),
  rejoin: (name) => api.post(`/channels/${name}/rejoin`),
};

// Stats API
export const statsApi = {
  getOverview: () => api.get('/stats'),
  getHealth: () => api.get('/health'),
};

// Auth/OAuth API
export const authApi = {
  getMe: () => api.get('/oauth/me'),
  refresh: (refreshToken) => api.post('/oauth/refresh', { refreshToken }),
  logout: (refreshToken) => api.post('/oauth/logout', { refreshToken }),
  logoutAll: () => api.post('/oauth/logout-all'),
  getFollowedStreams: () => api.get('/oauth/followed-streams'),
  createRequest: (type, reason) => api.post('/oauth/requests', { type, reason }),
  cancelRequest: (id) => api.delete(`/oauth/requests/${id}`),
};

// Chat API (sending messages via Twitch)
export const chatApi = {
  sendMessage: (channelName, message, replyParentMessageId = null) => 
    api.post('/chat/send', { channelName, message, replyParentMessageId }),
  getPermissions: (channel) => api.get(`/chat/permissions/${channel}`),
};

// Webhooks API
export const webhooksApi = {
  // User webhooks
  getAll: () => api.get('/webhooks'),
  create: (data) => api.post('/webhooks', data),
  update: (id, data) => api.put(`/webhooks/${id}`, data),
  delete: (id) => api.delete(`/webhooks/${id}`),
  test: (id) => api.post(`/webhooks/${id}/test`),
  
  // Saved URL bank
  getSavedUrls: () => api.get('/webhooks/urls'),
  saveUrl: (data) => api.post('/webhooks/urls', data),
  updateSavedUrl: (id, data) => api.put(`/webhooks/urls/${id}`, data),
  deleteSavedUrl: (id) => api.delete(`/webhooks/urls/${id}`),
  
  // Admin webhooks
  getAdminWebhooks: () => api.get('/webhooks/admin'),
  createAdminWebhook: (data) => api.post('/webhooks/admin', data),
  updateAdminWebhook: (id, data) => api.put(`/webhooks/admin/${id}`, data),
  deleteAdminWebhook: (id) => api.delete(`/webhooks/admin/${id}`),
  testAdminWebhook: (id) => api.post(`/webhooks/admin/${id}/test`),
  
  // Aliases for AdminWebhooksTab compatibility
  adminGetAll: () => api.get('/webhooks/admin'),
  adminCreate: (data) => api.post('/webhooks/admin', data),
  adminUpdate: (id, data) => api.put(`/webhooks/admin/${id}`, data),
  adminDelete: (id) => api.delete(`/webhooks/admin/${id}`),
  adminTest: (id) => api.post(`/webhooks/admin/${id}/test`),
};

// Tiers API (Admin)
export const tiersApi = {
  // Tier management
  getAll: () => api.get('/admin/tiers'),
  getById: (id) => api.get(`/admin/tiers/${id}`),
  create: (data) => api.post('/admin/tiers', data),
  update: (id, data) => api.patch(`/admin/tiers/${id}`, data),
  delete: (id) => api.delete(`/admin/tiers/${id}`),
  getTierUsers: (id, params) => api.get(`/admin/tiers/${id}/users`, { params }),
  
  // User tier management
  getUserTier: (username) => api.get(`/admin/users/${username}/tier`),
  assignUserTier: (username, data) => api.put(`/admin/users/${username}/tier`, data),
  removeUserTier: (username) => api.delete(`/admin/users/${username}/tier`),
  
  // User usage stats
  getUserUsage: (username, params) => api.get(`/admin/users/${username}/usage`, { params }),
  
  // System usage analytics
  getSystemUsage: (params) => api.get('/admin/usage', { params }),
  triggerAggregation: (date) => api.post('/admin/usage/aggregate', { date }),
  triggerCleanup: (days) => api.post('/admin/usage/cleanup', { days }),
};

// User self-service API
export const meApi = {
  getTier: () => api.get('/me/tier'),
  getUsage: (params) => api.get('/me/usage', { params }),
  getUsageSummary: () => api.get('/me/usage/summary'),
};

// Admin API
export const adminApi = {
  // System
  getSystem: () => api.get('/admin/system', { requiresAuth: true }),
  getDatabase: () => api.get('/admin/database', { requiresAuth: true }),
  
  // User requests
  getUserRequests: (params) => api.get('/admin/user-requests', { params, requiresAuth: true }),
  getPendingRequests: (params) => api.get('/admin/user-requests/pending', { params, requiresAuth: true }),
  getRequest: (id) => api.get(`/admin/user-requests/${id}`, { requiresAuth: true }),
  approveRequest: (id, adminNotes) => api.post(`/admin/user-requests/${id}/approve`, { adminNotes }),
  denyRequest: (id, adminNotes) => api.post(`/admin/user-requests/${id}/deny`, { adminNotes }),
  
  // OAuth users
  getOAuthUsers: (params) => api.get('/admin/oauth-users', { params, requiresAuth: true }),
  setUserAdmin: (id, isAdmin) => api.post(`/admin/oauth-users/${id}/admin`, { isAdmin }),
  deleteOAuthUser: (id) => api.delete(`/admin/oauth-users/${id}`),
  
  // Server settings (rate limits, etc.)
  getSettings: () => api.get('/admin/settings', { requiresAuth: true }),
  updateSetting: (key, value, description) => api.put(`/admin/settings/${key}`, { value, description }),
  updateSettingsBulk: (configs) => api.post('/admin/settings/bulk', { configs }),
  resetSettingKey: (key) => api.delete(`/admin/settings/${key}`),
  
  // Server configuration (system info - port, env, etc.)
  getConfig: () => api.get('/admin/config', { requiresAuth: true }),
  
  // Traffic analytics
  getTrafficStats: (timeRange = 'day') => api.get('/admin/traffic', { params: { timeRange }, requiresAuth: true }),
  cleanupTrafficLogs: (olderThanDays) => api.delete('/admin/traffic/cleanup', { data: { olderThanDays } }),
  
  // IP management
  getIpRules: () => api.get('/admin/ip-rules', { requiresAuth: true }),
  getIpStatus: (ip) => api.get(`/admin/ip-rules/${encodeURIComponent(ip)}/status`, { requiresAuth: true }),
  blockIp: (ip, reason, expiresAt) => api.post('/admin/ip-rules/block', { ip, reason, expiresAt }),
  unblockIp: (ip) => api.post('/admin/ip-rules/unblock', { ip }),
  setIpRateLimit: (ip, limit, expiresAt) => api.post('/admin/ip-rules/rate-limit', { ip, limit, expiresAt }),
  deleteIpRule: (id) => api.delete(`/admin/ip-rules/${id}`),
};

export default api;
