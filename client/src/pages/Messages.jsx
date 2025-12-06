import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { messagesApi } from '../services/api';
import MessageList from '../components/chat/MessageList';
import SearchBar from '../components/common/SearchBar';
import InfiniteScroll from '../components/common/InfiniteScroll';
import { MessageSquare, Filter, RefreshCw } from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';
import { useThreadCardStore } from '../stores/threadCardStore';
import { MobileMessages } from './mobile';

function Messages({ isMobile }) {
  // Render mobile version if on mobile
  if (isMobile) {
    return <MobileMessages />;
  }

  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [filters, setFilters] = useState({
    channel: searchParams.get('channel') || '',
    user: searchParams.get('user') || '',
    includeDeleted: searchParams.get('includeDeleted') === 'true',
  });
  const openThreadCard = useThreadCardStore(state => state.openCard);
  const resultsPerPage = useSettingsStore(state => state.resultsPerPage);

  // Sync URL params when filters change
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
    queryKey: ['messages', 'infinite', filters, searchQuery],
    queryFn: async ({ pageParam = 0 }) => {
      const params = {
        ...filters,
        limit: resultsPerPage,
        offset: pageParam,
      };
      const response = searchQuery
        ? await messagesApi.search({ q: searchQuery, ...params })
        : await messagesApi.getAll(params);
      // Include offset in returned data for pagination calculation
      return { ...response.data, _offset: pageParam, _limit: resultsPerPage };
    },
    getNextPageParam: (lastPage) => {
      // Use hasMore from API if available
      if (lastPage.hasMore) {
        return lastPage._offset + lastPage._limit;
      }
      // Fallback: calculate based on total
      const nextOffset = lastPage._offset + (lastPage.messages?.length || 0);
      if (lastPage.total && nextOffset < lastPage.total) {
        return nextOffset;
      }
      return undefined;
    },
    initialPageParam: 0,
  });

  // Flatten all pages into a single messages array
  const messages = useMemo(() => {
    return data?.pages?.flatMap(page => page.messages || []) || [];
  }, [data]);

  const total = data?.pages?.[0]?.total || 0;

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center">
          <MessageSquare className="w-6 h-6 mr-2 text-twitch-purple" />
          Messages
        </h1>
        <p className="text-gray-400">Search and browse archived messages</p>
      </div>

      {/* Search & Filters */}
      <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700 space-y-4">
        <SearchBar 
          placeholder="Search messages..." 
          onSearch={handleSearch}
          defaultValue={searchQuery}
        />

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Filters:</span>
          </div>

          <input
            type="text"
            placeholder="Channel"
            value={filters.channel}
            onChange={(e) => handleFilterChange('channel', e.target.value)}
            className="bg-twitch-dark border border-gray-600 rounded-md py-1.5 px-3 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-twitch-purple w-36"
          />

          <input
            type="text"
            placeholder="Username"
            value={filters.user}
            onChange={(e) => handleFilterChange('user', e.target.value)}
            className="bg-twitch-dark border border-gray-600 rounded-md py-1.5 px-3 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-twitch-purple w-36"
          />

          <label className="flex items-center space-x-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={filters.includeDeleted}
              onChange={(e) => handleFilterChange('includeDeleted', e.target.checked)}
              className="rounded border-gray-600 bg-twitch-dark text-twitch-purple focus:ring-twitch-purple"
            />
            <span>Include deleted</span>
          </label>
        </div>
      </div>

      {/* Results Info */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {total > 0 ? `Showing ${messages.length} of ${total} messages` : 'No messages found'}
        </p>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Message List with Infinite Scroll */}
      <div className="bg-twitch-gray rounded-lg border border-gray-700">
        <InfiniteScroll
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
          isLoading={isLoading}
        >
          <MessageList 
            messages={messages}
            isLoading={isLoading}
            error={error}
            showChannel={!filters.channel}
            onMessageClick={(messageId) => openThreadCard(messageId, filters.channel || null)}
          />
        </InfiniteScroll>
      </div>
    </div>
  );
}

export default Messages;
