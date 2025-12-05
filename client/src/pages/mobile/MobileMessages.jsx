import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { messagesApi } from '../../services/api';
import { MobileMessageItem, PullToRefresh } from '../../components/mobile';
import { MessageSquare, Filter, Search, X, ChevronDown, Loader2 } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useInView } from 'react-intersection-observer';
import LoadingSpinner from '../../components/common/LoadingSpinner';

function MobileMessages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    channel: searchParams.get('channel') || '',
    user: searchParams.get('user') || '',
    includeDeleted: searchParams.get('includeDeleted') === 'true',
  });
  const resultsPerPage = useSettingsStore(state => state.resultsPerPage);

  // Intersection observer for infinite scroll
  const { ref: loadMoreRef, inView } = useInView({ threshold: 0 });

  // Sync URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (filters.channel) params.set('channel', filters.channel);
    if (filters.user) params.set('user', filters.user);
    if (filters.includeDeleted) params.set('includeDeleted', 'true');
    setSearchParams(params, { replace: true });
  }, [searchQuery, filters, setSearchParams]);

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
    queryKey: ['messages', 'mobile-infinite', filters, searchQuery],
    queryFn: async ({ pageParam = 0 }) => {
      const params = {
        ...filters,
        limit: resultsPerPage,
        offset: pageParam,
      };
      const response = searchQuery
        ? await messagesApi.search({ q: searchQuery, ...params })
        : await messagesApi.getAll(params);
      return { ...response.data, _offset: pageParam, _limit: resultsPerPage };
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.hasMore) {
        return lastPage._offset + lastPage._limit;
      }
      const nextOffset = lastPage._offset + (lastPage.messages?.length || 0);
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

  // Flatten all pages into a single messages array
  const messages = useMemo(() => {
    return data?.pages?.flatMap(page => page.messages || []) || [];
  }, [data]);

  const total = data?.pages?.[0]?.total || 0;

  const handleSearch = (e) => {
    e?.preventDefault();
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ channel: '', user: '', includeDeleted: false });
    setSearchQuery('');
  };

  const hasActiveFilters = filters.channel || filters.user || filters.includeDeleted || searchQuery;

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)]">
      {/* Header */}
      <div className="px-4 py-3 bg-twitch-gray border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-twitch-purple" />
            <h1 className="text-lg font-bold text-white">Messages</h1>
          </div>
          <span className="text-sm text-gray-400">
            {messages.length} of {total.toLocaleString()}
          </span>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            className="w-full pl-10 pr-10 py-3 bg-twitch-dark border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-twitch-purple"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center justify-between w-full mt-3 px-3 py-2 rounded-lg ${
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
            <div className="grid grid-cols-2 gap-3">
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
              <div>
                <label className="text-xs text-gray-500 mb-1 block">User</label>
                <input
                  type="text"
                  placeholder="Filter by user"
                  value={filters.user}
                  onChange={(e) => handleFilterChange('user', e.target.value)}
                  className="w-full px-3 py-2 bg-twitch-dark border border-gray-600 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:border-twitch-purple"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={filters.includeDeleted}
                  onChange={(e) => handleFilterChange('includeDeleted', e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-twitch-dark text-twitch-purple focus:ring-twitch-purple"
                />
                Include deleted
              </label>
              
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-red-400"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Messages list */}
      <PullToRefresh onRefresh={handleRefresh} className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-400">
            <p>Error loading messages</p>
            <button onClick={() => refetch()} className="mt-2 text-twitch-purple">
              Try again
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-center">No messages found</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-2 text-twitch-purple text-sm">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MobileMessageItem 
                key={message.id} 
                message={message}
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
              {!hasNextPage && messages.length > 0 && (
                <p className="text-center text-sm text-gray-500">No more messages</p>
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

export default MobileMessages;
