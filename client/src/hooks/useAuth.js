import { useCallback, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../services/api';
import { useToast } from '../stores/toastStore';

/**
 * Hook for authentication operations
 */
export function useAuth() {
  const {
    user,
    accessToken,
    refreshToken,
    isAuthenticated,
    isLoading,
    error,
    requests,
    setUser,
    setAccessToken,
    setRequests,
    addRequest,
    updateRequest,
    removeRequest,
    setLoading,
    setError,
    clearError,
    logout: storeLogout,
    isAdmin,
    getAuthHeader,
  } = useAuthStore();

  const { showToast } = useToast();

  // Handle OAuth callback (called from AuthCallback page)
  const handleAuthCallback = useCallback(async (accessToken, refreshToken, returnUrl) => {
    setLoading(true);
    try {
      // Store tokens
      useAuthStore.setState({ accessToken, refreshToken });

      // Fetch user profile
      const response = await authApi.getMe();
      setUser(response.data.user, accessToken, refreshToken);
      setRequests(response.data.requests || []);
      
      showToast(`Welcome, ${response.data.user.display_name || response.data.user.username}!`, 'success');
      return returnUrl || '/';
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
      showToast('Authentication failed', 'error');
      return '/login?error=auth_failed';
    }
  }, [setLoading, setUser, setRequests, setError, showToast]);

  // Refresh access token
  const refreshAccessToken = useCallback(async () => {
    if (!refreshToken) return false;

    try {
      const response = await authApi.refresh(refreshToken);
      setAccessToken(response.data.accessToken);
      return true;
    } catch (err) {
      // Refresh token invalid, logout
      storeLogout();
      return false;
    }
  }, [refreshToken, setAccessToken, storeLogout]);

  // Logout
  const logout = useCallback(async () => {
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch (err) {
      // Ignore logout errors
    }
    storeLogout();
    showToast('Logged out successfully', 'info');
  }, [refreshToken, storeLogout, showToast]);

  // Logout from all devices
  const logoutAll = useCallback(async () => {
    setLoading(true);
    try {
      await authApi.logoutAll();
      storeLogout();
      showToast('Logged out from all devices', 'info');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to logout');
      showToast('Failed to logout from all devices', 'error');
    }
  }, [setLoading, storeLogout, setError, showToast]);

  // Create data request
  const createRequest = useCallback(async (type, reason) => {
    setLoading(true);
    try {
      const response = await authApi.createRequest(type, reason);
      addRequest(response.data.request);
      showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} request submitted`, 'success');
      return response.data.request;
    } catch (err) {
      const message = err.response?.data?.error || `Failed to create ${type} request`;
      setError(message);
      showToast(message, 'error');
      throw err;
    }
  }, [setLoading, addRequest, setError, showToast]);

  // Cancel data request
  const cancelRequest = useCallback(async (requestId) => {
    setLoading(true);
    try {
      await authApi.cancelRequest(requestId);
      removeRequest(requestId);
      showToast('Request cancelled', 'success');
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to cancel request';
      setError(message);
      showToast(message, 'error');
    }
  }, [setLoading, removeRequest, setError, showToast]);

  // Refresh user profile
  const refreshProfile = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const response = await authApi.getMe();
      setUser(response.data.user, accessToken, refreshToken);
      setRequests(response.data.requests || []);
    } catch (err) {
      if (err.response?.status === 401) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          await refreshProfile();
        }
      }
    }
  }, [isAuthenticated, accessToken, refreshToken, setUser, setRequests, refreshAccessToken]);

  // Get login URL
  const getLoginUrl = useCallback((returnUrl = '/') => {
    const apiUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;
    return `${apiUrl}/api/oauth/login?returnUrl=${encodeURIComponent(returnUrl)}`;
  }, []);

  return {
    user,
    accessToken,
    refreshToken,
    isAuthenticated,
    isLoading,
    error,
    requests,
    isAdmin: isAdmin(),
    handleAuthCallback,
    refreshAccessToken,
    logout,
    logoutAll,
    createRequest,
    cancelRequest,
    refreshProfile,
    clearError,
    getLoginUrl,
    getAuthHeader,
  };
}

/**
 * Hook to automatically refresh token when needed
 */
export function useAuthRefresh() {
  const { accessToken, refreshToken, refreshAccessToken, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    // Check token expiration every minute
    const interval = setInterval(() => {
      // Parse JWT to check expiration
      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        const expiresIn = payload.exp * 1000 - Date.now();
        
        // Refresh if expires in less than 2 minutes
        if (expiresIn < 2 * 60 * 1000) {
          refreshAccessToken();
        }
      } catch (err) {
        // Invalid token format
        console.error('Invalid token format');
      }
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [accessToken, isAuthenticated, refreshAccessToken]);
}
