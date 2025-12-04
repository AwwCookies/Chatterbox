import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use((config) => {
  console.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
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
  getByUsername: (username) => api.get(`/users/${username}`),
  getMessages: (username, params) => api.get(`/users/${username}/messages`, { params }),
  getModActions: (username, params) => api.get(`/users/${username}/mod-actions`, { params }),
  getStats: (username) => api.get(`/users/${username}/stats`),
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

export default api;
