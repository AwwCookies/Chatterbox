import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { modActionsApi } from '../services/api';
import { useModActionStats } from '../hooks/useModActions';
import ModActionList from '../components/moderation/ModActionList';
import InfiniteScroll from '../components/common/InfiniteScroll';
import { Shield, Filter, BarChart3, RefreshCw } from 'lucide-react';
import { formatNumber, capitalize } from '../utils/formatters';
import { ACTION_TYPES } from '../utils/constants';
import { useSettingsStore } from '../stores/settingsStore';
import { MobileModeration } from './mobile';

function Moderation({ isMobile }) {
  // Render mobile version if on mobile
  if (isMobile) {
    return <MobileModeration />;
  }

  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    type: searchParams.get('type') || '',
    channel: searchParams.get('channel') || '',
    moderator: searchParams.get('moderator') || '',
    target: searchParams.get('target') || '',
  });
  const resultsPerPage = useSettingsStore(state => state.resultsPerPage);

  // Sync URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.type) params.set('type', filters.type);
    if (filters.channel) params.set('channel', filters.channel);
    if (filters.moderator) params.set('moderator', filters.moderator);
    if (filters.target) params.set('target', filters.target);
    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['mod-actions', 'infinite', filters],
    queryFn: async ({ pageParam = 0 }) => {
      const params = {
        ...filters,
        limit: resultsPerPage,
        offset: pageParam,
      };
      const response = await modActionsApi.getAll(params);
      return { ...response.data, _offset: pageParam, _limit: resultsPerPage };
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.hasMore) {
        return lastPage._offset + lastPage._limit;
      }
      const nextOffset = lastPage._offset + (lastPage.actions?.length || 0);
      if (lastPage.total && nextOffset < lastPage.total) {
        return nextOffset;
      }
      return undefined;
    },
    initialPageParam: 0,
  });

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useModActionStats({ channel: filters.channel });

  // Flatten all pages into a single actions array
  const actions = useMemo(() => {
    return data?.pages?.flatMap(page => page.actions || []) || [];
  }, [data]);

  const total = data?.pages?.[0]?.total || 0;

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center">
          <Shield className="w-6 h-6 mr-2 text-red-400" />
          Moderation
        </h1>
        <p className="text-gray-400">View and analyze moderation actions</p>
      </div>

      {/* Stats */}
      {!statsLoading && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {stats.action_counts?.map(item => (
            <div 
              key={item.action_type}
              className="bg-twitch-gray rounded-lg p-4 border border-gray-700"
            >
              <p className="text-xl font-bold text-white">{formatNumber(item.count)}</p>
              <p className="text-xs text-gray-400">{capitalize(item.action_type)}s</p>
            </div>
          ))}
        </div>
      )}

      {/* Top Moderators */}
      {!statsLoading && stats?.top_moderators?.length > 0 && (
        <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center">
            <BarChart3 className="w-4 h-4 mr-2" />
            Most Active Moderators
          </h3>
          <div className="flex flex-wrap gap-2">
            {stats.top_moderators.map(mod => (
              <div 
                key={mod.username}
                className="px-3 py-1 bg-gray-700 rounded-full text-sm"
              >
                <span className="text-green-400">{mod.display_name || mod.username}</span>
                <span className="text-gray-400 ml-2">{formatNumber(mod.action_count)} actions</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Filters:</span>
          </div>

          <select
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="bg-twitch-dark border border-gray-600 rounded-md py-1.5 px-3 text-sm text-white focus:outline-none focus:border-twitch-purple"
          >
            <option value="">All types</option>
            {ACTION_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Channel"
            value={filters.channel}
            onChange={(e) => handleFilterChange('channel', e.target.value)}
            className="bg-twitch-dark border border-gray-600 rounded-md py-1.5 px-3 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-twitch-purple w-36"
          />

          <input
            type="text"
            placeholder="Moderator"
            value={filters.moderator}
            onChange={(e) => handleFilterChange('moderator', e.target.value)}
            className="bg-twitch-dark border border-gray-600 rounded-md py-1.5 px-3 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-twitch-purple w-36"
          />

          <input
            type="text"
            placeholder="Target user"
            value={filters.target}
            onChange={(e) => handleFilterChange('target', e.target.value)}
            className="bg-twitch-dark border border-gray-600 rounded-md py-1.5 px-3 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-twitch-purple w-36"
          />
        </div>
      </div>

      {/* Results Info */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {total > 0 ? `Showing ${actions.length} of ${total} actions` : 'No actions found'}
        </p>
        <button
          onClick={() => { refetch(); refetchStats(); }}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Action List with Infinite Scroll */}
      <div className="bg-twitch-gray rounded-lg border border-gray-700">
        <InfiniteScroll
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
          isLoading={isLoading}
        >
          <ModActionList 
            actions={actions}
            isLoading={isLoading}
            error={error}
          />
        </InfiniteScroll>
      </div>
    </div>
  );
}

export default Moderation;
