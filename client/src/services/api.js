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

// Request interceptor for logging and adding API key
api.interceptors.request.use((config) => {
  console.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
  
  // Add API key header for authenticated requests (POST, PATCH, PUT, DELETE)
  const method = config.method?.toUpperCase();
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    const apiKey = useSettingsStore.getState().apiKey;
    if (apiKey) {
      config.headers['X-API-Key'] = apiKey;
    }
  }
  
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

export default api;
