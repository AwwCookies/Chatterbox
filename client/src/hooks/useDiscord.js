import { useState, useEffect, useCallback } from 'react';
import { discordApi } from '../services/api';
import { useToastStore } from '../stores/toastStore';

/**
 * Hook for managing Discord OAuth integration
 * Uses Discord bot for channel fetching and webhook creation
 */
export function useDiscord() {
  const [status, setStatus] = useState(null);
  const [guilds, setGuilds] = useState([]);
  const [channels, setChannels] = useState({});
  const [loading, setLoading] = useState(true);
  const [guildsLoading, setGuildsLoading] = useState(false);
  const [channelsLoading, setChannelsLoading] = useState({});
  const addToast = useToastStore(state => state.addToast);

  // Fetch Discord connection status
  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const response = await discordApi.getStatus();
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch Discord status:', error);
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch guilds where user has webhook permission
  const fetchGuilds = useCallback(async (refresh = false) => {
    if (!status?.connected) return [];
    
    try {
      setGuildsLoading(true);
      const response = await discordApi.getGuilds(refresh);
      setGuilds(response.data.guilds || []);
      return response.data.guilds;
    } catch (error) {
      console.error('Failed to fetch Discord guilds:', error);
      
      if (error.response?.data?.code === 'DISCORD_EXPIRED') {
        setStatus({ connected: false, expired: true });
        addToast('Discord session expired - please reconnect', 'warning');
      } else {
        addToast('Failed to fetch Discord servers', 'error');
      }
      return [];
    } finally {
      setGuildsLoading(false);
    }
  }, [status?.connected, addToast]);

  // Fetch channels for a specific guild
  const fetchChannels = useCallback(async (guildId, refresh = false) => {
    if (!status?.connected) return null;
    
    try {
      setChannelsLoading(prev => ({ ...prev, [guildId]: true }));
      const response = await discordApi.getChannels(guildId, refresh);
      const channelData = {
        channels: response.data.channels || [],
        categorized: response.data.categorized || [],
        uncategorized: response.data.uncategorized || [],
      };
      setChannels(prev => ({ ...prev, [guildId]: channelData }));
      return channelData;
    } catch (error) {
      console.error('Failed to fetch Discord channels:', error);
      
      if (error.response?.data?.code === 'DISCORD_EXPIRED') {
        setStatus({ connected: false, expired: true });
        addToast('Discord session expired - please reconnect', 'warning');
      } else if (error.response?.status === 403) {
        addToast('Bot does not have access to this server - please invite the bot first', 'error');
      } else if (error.response?.status === 503) {
        addToast('Discord bot is not configured on this server', 'error');
      } else {
        addToast('Failed to fetch Discord channels', 'error');
      }
      return null;
    } finally {
      setChannelsLoading(prev => ({ ...prev, [guildId]: false }));
    }
  }, [status?.connected, addToast]);

  // Connect Discord account (redirects to Discord OAuth)
  const connect = useCallback(async () => {
    const returnUrl = window.location.pathname + window.location.search;
    
    try {
      const response = await discordApi.getAuthUrl(returnUrl);
      
      if (response.data?.url) {
        window.location.href = response.data.url;
      } else {
        addToast('Failed to get Discord authorization URL', 'error');
      }
    } catch (error) {
      console.error('Failed to initiate Discord connection:', error);
      if (error.response?.status === 503) {
        addToast('Discord OAuth is not configured on this server', 'error');
      } else if (error.response?.status === 401) {
        addToast('Please log in first', 'error');
      } else {
        addToast('Failed to connect to Discord', 'error');
      }
    }
  }, [addToast]);

  // Disconnect Discord account
  const disconnect = useCallback(async (deleteWebhooks = false) => {
    try {
      await discordApi.disconnect(deleteWebhooks);
      setStatus({ connected: false });
      setGuilds([]);
      setChannels({});
      addToast('Discord disconnected', 'success');
    } catch (error) {
      console.error('Failed to disconnect Discord:', error);
      addToast('Failed to disconnect Discord', 'error');
    }
  }, [addToast]);

  // Create webhook in Discord channel
  const createWebhook = useCallback(async (guildId, channelId, data) => {
    if (!status?.connected) {
      throw new Error('Discord not connected');
    }
    
    try {
      const response = await discordApi.createWebhook(guildId, channelId, data);
      addToast('Webhook created successfully', 'success');
      return response.data;
    } catch (error) {
      console.error('Failed to create Discord webhook:', error);
      
      if (error.response?.data?.code === 'DISCORD_EXPIRED') {
        setStatus({ connected: false, expired: true });
        throw new Error('Discord session expired - please reconnect');
      }
      
      if (error.response?.status === 503) {
        throw new Error('Discord bot is not configured on this server');
      }
      
      if (error.response?.status === 403) {
        throw new Error('Bot does not have permission to create webhooks in this channel');
      }
      
      throw new Error(error.response?.data?.error || 'Failed to create webhook');
    }
  }, [status?.connected, addToast]);

  // Refresh Discord guilds
  const refreshGuilds = useCallback(async () => {
    if (!status?.connected) return;
    
    try {
      await fetchGuilds(true);
      addToast('Discord servers refreshed', 'success');
    } catch (error) {
      console.error('Failed to refresh Discord:', error);
      addToast('Failed to refresh Discord servers', 'error');
    }
  }, [status?.connected, fetchGuilds, addToast]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Fetch guilds when connected
  useEffect(() => {
    if (status?.connected && guilds.length === 0) {
      fetchGuilds();
    }
  }, [status?.connected, guilds.length, fetchGuilds]);

  // Check for Discord connection result from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const discordResult = params.get('discord');
    const webhookCreated = params.get('webhook_created');
    const error = params.get('error');
    
    if (discordResult === 'connected') {
      addToast('Discord connected successfully!', 'success');
      fetchStatus();
      params.delete('discord');
    } else if (webhookCreated) {
      addToast('Webhook created successfully!', 'success');
      params.delete('webhook_created');
    } else if (error) {
      addToast(`Discord error: ${error.replace(/_/g, ' ')}`, 'error');
      params.delete('error');
    }

    // Clean URL if any params were handled
    if (discordResult || webhookCreated || error) {
      const newUrl = params.toString() 
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [fetchStatus, addToast]);

  return {
    // Status
    status,
    loading,
    connected: status?.connected || false,
    expired: status?.expired || false,
    discordUser: status?.user || null,
    
    // Guilds
    guilds,
    guildsLoading,
    
    // Channels (keyed by guildId)
    channels,
    channelsLoading,
    
    // Actions
    connect,
    disconnect,
    fetchGuilds,
    fetchChannels,
    refreshGuilds,
    createWebhook,
  };
}

export default useDiscord;
