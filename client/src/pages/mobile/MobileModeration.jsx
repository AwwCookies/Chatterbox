import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { modActionsApi } from '../../services/api';
import { MobileModActionCard, MobileScrollableTabs, PullToRefresh } from '../../components/mobile';
import { Shield, Filter, Ban, Timer, Trash2, Eraser, ChevronDown, Loader2 } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useInView } from 'react-intersection-observer';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const actionTypes = [
  { id: 'all', label: 'All', icon: Shield },
  { id: 'ban', label: 'Bans', icon: Ban },
  { id: 'timeout', label: 'Timeouts', icon: Timer },
  { id: 'delete', label: 'Deletes', icon: Trash2 },
  { id: 'clear', label: 'Clears', icon: Eraser },
];

function MobileModeration() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeType, setActiveType] = useState(searchParams.get('type') || 'all');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    channel: searchParams.get('channel') || '',
    moderator: searchParams.get('moderator') || '',
    target: searchParams.get('target') || '',
  });
  const resultsPerPage = useSettingsStore(state => state.resultsPerPage);

  // Intersection observer for infinite scroll
  const { ref: loadMoreRef, inView } = useInView({ threshold: 0 });

  // Sync URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeType !== 'all') params.set('type', activeType);
    if (filters.channel) params.set('channel', filters.channel);
    if (filters.moderator) params.set('moderator', filters.moderator);
    if (filters.target) params.set('target', filters.target);
    setSearchParams(params, { replace: true });
  }, [activeType, filters, setSearchParams]);

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
    queryKey: ['mod-actions', 'mobile-infinite', filters, activeType],
    queryFn: async ({ pageParam = 0 }) => {
      const params = {
        ...filters,
        actionType: activeType !== 'all' ? activeType : undefined,
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

  // Load more when scrolling to bottom
  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Flatten all pages into a single actions array
  const actions = useMemo(() => {
    return data?.pages?.flatMap(page => page.actions || []) || [];
  }, [data]);

  const total = data?.pages?.[0]?.total || 0;

  const handleTypeChange = (type) => {
    setActiveType(type);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ channel: '', moderator: '', target: '' });
  };

  const hasActiveFilters = filters.channel || filters.moderator || filters.target;

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)]">
      {/* Header */}
      <div className="px-4 py-3 bg-twitch-gray border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-400" />
            <h1 className="text-lg font-bold text-white">Moderation</h1>
          </div>
          <span className="text-sm text-gray-400">
            {actions.length} of {total.toLocaleString()}
          </span>
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center justify-between w-full px-3 py-2 rounded-lg ${
            hasActiveFilters ? 'bg-twitch-purple/20 text-twitch-purple' : 'bg-gray-700/50 text-gray-400'
          }`}
        >
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <span className="text-sm">
              {hasActiveFilters ? 'Filters active' : 'Add filters'}
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>

        {/* Filters */}
        {showFilters && (
          <div className="mt-3 space-y-3 animate-slide-up">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Channel</label>
                <input
                  type="text"
                  placeholder="Filter by channel"
                  value={filters.channel}
                  onChange={(e) => handleFilterChange('channel', e.target.value)}
                  className="w-full px-3 py-2 bg-twitch-dark border border-gray-600 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:border-twitch-purple"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Moderator</label>
                  <input
                    type="text"
                    placeholder="Mod username"
                    value={filters.moderator}
                    onChange={(e) => handleFilterChange('moderator', e.target.value)}
                    className="w-full px-3 py-2 bg-twitch-dark border border-gray-600 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:border-twitch-purple"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Target</label>
                  <input
                    type="text"
                    placeholder="Target username"
                    value={filters.target}
                    onChange={(e) => handleFilterChange('target', e.target.value)}
                    className="w-full px-3 py-2 bg-twitch-dark border border-gray-600 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:border-twitch-purple"
                  />
                </div>
              </div>
            </div>
            
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-red-400"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Action type tabs */}
      <MobileScrollableTabs
        tabs={actionTypes}
        activeTab={activeType}
        onChange={handleTypeChange}
      />

      {/* Actions list */}
      <PullToRefresh onRefresh={handleRefresh} className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-400">
            <p>Error loading actions</p>
            <button onClick={() => refetch()} className="mt-2 text-twitch-purple">
              Try again
            </button>
          </div>
        ) : actions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Shield className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-center">No mod actions found</p>
            {(hasActiveFilters || activeType !== 'all') && (
              <button 
                onClick={() => {
                  clearFilters();
                  setActiveType('all');
                }} 
                className="mt-2 text-twitch-purple text-sm"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            {actions.map((action) => (
              <MobileModActionCard 
                key={action.id} 
                action={action}
                showChannel={!filters.channel}
              />
            ))}

            {/* Infinite scroll trigger */}
            <div ref={loadMoreRef} className="py-4">
              {isFetchingNextPage && (
                <div className="flex justify-center">
                  <Loader2 className="w-6 h-6 text-twitch-purple animate-spin" />
                </div>
              )}
              {!hasNextPage && actions.length > 0 && (
                <p className="text-center text-sm text-gray-500">No more actions</p>
              )}
            </div>
          </>
        )}

        {/* Loading indicator for background refresh */}
        {isFetching && !isLoading && !isFetchingNextPage && (
          <div className="flex justify-center py-2">
            <Loader2 className="w-5 h-5 text-twitch-purple animate-spin" />
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}

export default MobileModeration;
