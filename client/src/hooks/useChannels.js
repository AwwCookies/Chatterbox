import { useQuery } from '@tanstack/react-query';
import { channelsApi, messagesApi, modActionsApi } from '../services/api';

/**
 * Fetch all channels
 */
export function useChannels(options = {}) {
  return useQuery({
    queryKey: ['channels', options],
    queryFn: () => channelsApi.getAll(options).then(res => res.data),
  });
}

/**
 * Fetch a single channel by name
 */
export function useChannel(name) {
  return useQuery({
    queryKey: ['channel', name],
    queryFn: () => channelsApi.getByName(name).then(res => res.data),
    enabled: !!name,
  });
}

/**
 * Fetch channel statistics
 */
export function useChannelStats(name, options = {}) {
  return useQuery({
    queryKey: ['channel', name, 'stats', options],
    queryFn: () => channelsApi.getStats(name, options).then(res => res.data),
    enabled: !!name,
  });
}

/**
 * Fetch messages for a specific channel
 */
export function useChannelMessages(channelName, options = {}) {
  return useQuery({
    queryKey: ['messages', { channel: channelName, ...options }],
    queryFn: () => messagesApi.getAll({ channel: channelName, ...options }).then(res => res.data),
    enabled: !!channelName,
  });
}

/**
 * Fetch mod actions for a specific channel
 */
export function useChannelModActions(channelName, options = {}) {
  return useQuery({
    queryKey: ['mod-actions', { channel: channelName, ...options }],
    queryFn: () => modActionsApi.getAll({ channel: channelName, ...options }).then(res => res.data),
    enabled: !!channelName,
  });
}

/**
 * Fetch top users for a specific channel
 */
export function useChannelTopUsers(channelName, options = {}) {
  return useQuery({
    queryKey: ['channel', channelName, 'top-users', options],
    queryFn: () => channelsApi.getTopUsers(channelName, options).then(res => res.data),
    enabled: !!channelName,
  });
}

/**
 * Fetch messages with links for a specific channel
 */
export function useChannelLinks(channelName, options = {}) {
  return useQuery({
    queryKey: ['channel', channelName, 'links', options],
    queryFn: () => channelsApi.getLinks(channelName, options).then(res => res.data),
    enabled: !!channelName,
  });
}
