import { useInfiniteQuery } from '@tanstack/react-query';
import { channelsApi, messagesApi, modActionsApi, usersApi } from '../services/api';

const DEFAULT_PAGE_SIZE = 50;

/**
 * Infinite scroll hook for channel messages
 */
export function useInfiniteChannelMessages(channelName, options = {}) {
  const pageSize = options.limit || DEFAULT_PAGE_SIZE;
  
  return useInfiniteQuery({
    queryKey: ['messages', 'infinite', { channel: channelName, ...options }],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await messagesApi.getAll({ 
        channel: channelName, 
        limit: pageSize,
        offset: pageParam,
        ...options 
      });
      return res.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, page) => sum + (page.messages?.length || 0), 0);
      if (totalFetched < lastPage.total) {
        return totalFetched;
      }
      return undefined;
    },
    enabled: !!channelName,
  });
}

/**
 * Infinite scroll hook for channel mod actions
 */
export function useInfiniteChannelModActions(channelName, options = {}) {
  const pageSize = options.limit || DEFAULT_PAGE_SIZE;
  
  return useInfiniteQuery({
    queryKey: ['mod-actions', 'infinite', { channel: channelName, ...options }],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await modActionsApi.getAll({ 
        channel: channelName, 
        limit: pageSize,
        offset: pageParam,
        ...options 
      });
      return res.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, page) => sum + (page.actions?.length || 0), 0);
      if (totalFetched < lastPage.total) {
        return totalFetched;
      }
      return undefined;
    },
    enabled: !!channelName,
  });
}

/**
 * Infinite scroll hook for channel links
 */
export function useInfiniteChannelLinks(channelName, options = {}) {
  const pageSize = options.limit || DEFAULT_PAGE_SIZE;
  
  return useInfiniteQuery({
    queryKey: ['channel', channelName, 'links', 'infinite', options],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await channelsApi.getLinks(channelName, { 
        limit: pageSize,
        offset: pageParam,
        ...options 
      });
      return res.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, page) => sum + (page.messages?.length || 0), 0);
      if (totalFetched < lastPage.total) {
        return totalFetched;
      }
      return undefined;
    },
    enabled: !!channelName,
  });
}

/**
 * Infinite scroll hook for user messages
 */
export function useInfiniteUserMessages(username, options = {}) {
  const pageSize = options.limit || DEFAULT_PAGE_SIZE;
  
  return useInfiniteQuery({
    queryKey: ['user', username, 'messages', 'infinite', options],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await usersApi.getMessages(username, { 
        limit: pageSize,
        offset: pageParam,
        ...options 
      });
      return res.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, page) => sum + (page.messages?.length || 0), 0);
      if (totalFetched < lastPage.total) {
        return totalFetched;
      }
      return undefined;
    },
    enabled: !!username,
  });
}

/**
 * Infinite scroll hook for user mod actions
 */
export function useInfiniteUserModActions(username, options = {}) {
  const pageSize = options.limit || DEFAULT_PAGE_SIZE;
  
  return useInfiniteQuery({
    queryKey: ['user', username, 'mod-actions', 'infinite', options],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await usersApi.getModActions(username, { 
        limit: pageSize,
        offset: pageParam,
        ...options 
      });
      return res.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, page) => sum + (page.actions?.length || 0), 0);
      if (totalFetched < lastPage.total) {
        return totalFetched;
      }
      return undefined;
    },
    enabled: !!username,
  });
}

/**
 * Infinite scroll hook for global messages search
 */
export function useInfiniteMessages(options = {}) {
  const pageSize = options.limit || DEFAULT_PAGE_SIZE;
  
  return useInfiniteQuery({
    queryKey: ['messages', 'infinite', options],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await messagesApi.getAll({ 
        limit: pageSize,
        offset: pageParam,
        ...options 
      });
      return res.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, page) => sum + (page.messages?.length || 0), 0);
      if (totalFetched < lastPage.total) {
        return totalFetched;
      }
      return undefined;
    },
  });
}

/**
 * Infinite scroll hook for global mod actions
 */
export function useInfiniteModActions(options = {}) {
  const pageSize = options.limit || DEFAULT_PAGE_SIZE;
  
  return useInfiniteQuery({
    queryKey: ['mod-actions', 'infinite', options],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await modActionsApi.getAll({ 
        limit: pageSize,
        offset: pageParam,
        ...options 
      });
      return res.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, page) => sum + (page.actions?.length || 0), 0);
      if (totalFetched < lastPage.total) {
        return totalFetched;
      }
      return undefined;
    },
  });
}
