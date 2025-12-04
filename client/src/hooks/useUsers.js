import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../services/api';

export const useUsers = (params = {}) => {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => usersApi.getAll(params).then(res => res.data),
    keepPreviousData: true,
  });
};

export const useUser = (username) => {
  return useQuery({
    queryKey: ['user', username],
    queryFn: () => usersApi.getByUsername(username).then(res => res.data),
    enabled: !!username,
  });
};

export const useUserMessages = (username, params = {}) => {
  return useQuery({
    queryKey: ['user', username, 'messages', params],
    queryFn: () => usersApi.getMessages(username, params).then(res => res.data),
    enabled: !!username,
    keepPreviousData: true,
  });
};

export const useUserModActions = (username, params = {}) => {
  return useQuery({
    queryKey: ['user', username, 'mod-actions', params],
    queryFn: () => usersApi.getModActions(username, params).then(res => res.data),
    enabled: !!username,
  });
};

export const useUserStats = (username) => {
  return useQuery({
    queryKey: ['user', username, 'stats'],
    queryFn: () => usersApi.getStats(username).then(res => res.data),
    enabled: !!username,
  });
};
