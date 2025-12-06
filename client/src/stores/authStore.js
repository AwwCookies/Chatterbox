import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const initialState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  requests: [], // User's data requests
};

export const useAuthStore = create(
  persist(
    (set, get) => ({
      ...initialState,

      // Set user after login
      setUser: (user, accessToken, refreshToken) => set({
        user,
        accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      }),

      // Update access token
      setAccessToken: (accessToken) => set({ accessToken }),

      // Set user requests
      setRequests: (requests) => set({ requests }),

      // Add a new request
      addRequest: (request) => set((state) => ({
        requests: [request, ...state.requests],
      })),

      // Update a request
      updateRequest: (requestId, updates) => set((state) => ({
        requests: state.requests.map((r) =>
          r.id === requestId ? { ...r, ...updates } : r
        ),
      })),

      // Remove a request
      removeRequest: (requestId) => set((state) => ({
        requests: state.requests.filter((r) => r.id !== requestId),
      })),

      // Set loading state
      setLoading: (isLoading) => set({ isLoading }),

      // Set error
      setError: (error) => set({ error, isLoading: false }),

      // Clear error
      clearError: () => set({ error: null }),

      // Logout
      logout: () => set({
        ...initialState,
      }),

      // Check if user is admin
      isAdmin: () => get().user?.is_admin || false,

      // Get authorization header
      getAuthHeader: () => {
        const token = get().accessToken;
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
    {
      name: 'chatterbox-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        requests: state.requests,
      }),
    }
  )
);
