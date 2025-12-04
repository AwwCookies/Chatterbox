import { useQuery } from '@tanstack/react-query';
import { modActionsApi } from '../services/api';

export const useModActions = (params = {}) => {
  return useQuery({
    queryKey: ['mod-actions', params],
    queryFn: () => modActionsApi.getAll(params).then(res => res.data),
    keepPreviousData: true,
  });
};

export const useRecentModActions = (limit = 100) => {
  return useQuery({
    queryKey: ['mod-actions', 'recent', limit],
    queryFn: () => modActionsApi.getRecent(limit).then(res => res.data),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

export const useModActionStats = (params = {}) => {
  return useQuery({
    queryKey: ['mod-actions', 'stats', params],
    queryFn: () => modActionsApi.getStats(params).then(res => res.data),
  });
};
