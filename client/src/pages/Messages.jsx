import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMessages, useMessageSearch } from '../hooks/useMessages';
import MessageList from '../components/chat/MessageList';
import SearchBar from '../components/common/SearchBar';
import Pagination from '../components/common/Pagination';
import { MessageSquare, Filter, RefreshCw } from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';

function Messages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [filters, setFilters] = useState({
    channel: searchParams.get('channel') || '',
    user: searchParams.get('user') || '',
    includeDeleted: searchParams.get('includeDeleted') === 'true',
  });
  const [page, setPage] = useState(1);
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

  const params = {
    ...filters,
    limit: resultsPerPage,
    offset: (page - 1) * resultsPerPage,
    search: searchQuery || undefined,
  };

  const messagesQuery = useMessages(params);
  const searchQueryResult = useMessageSearch(searchQuery, params);
  
  const { data, isLoading, error, refetch, isFetching } = searchQuery
    ? searchQueryResult
    : messagesQuery;

  const messages = data?.messages || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / resultsPerPage);

  const handleSearch = (query) => {
    setSearchQuery(query);
    setPage(1);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
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

      {/* Message List */}
      <div className="bg-twitch-gray rounded-lg border border-gray-700">
        <MessageList 
          messages={messages}
          isLoading={isLoading}
          error={error}
          showChannel={!filters.channel}
        />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination 
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}

export default Messages;
