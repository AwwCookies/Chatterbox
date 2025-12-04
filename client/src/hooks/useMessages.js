import { useQuery } from '@tanstack/react-query';
import { messagesApi } from '../services/api';

export const useMessages = (params = {}) => {
  return useQuery({
    queryKey: ['messages', params],
    queryFn: () => messagesApi.getAll(params).then(res => res.data),
    keepPreviousData: true,
  });
};

export const useMessageSearch = (query, params = {}) => {
  return useQuery({
    queryKey: ['messages', 'search', query, params],
    queryFn: () => messagesApi.search({ q: query, ...params }).then(res => res.data),
    enabled: query?.length >= 2,
  });
};

export const useMessage = (id) => {
  return useQuery({
    queryKey: ['message', id],
    queryFn: () => messagesApi.getById(id).then(res => res.data),
    enabled: !!id,
  });
};
