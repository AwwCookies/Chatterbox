import { useState } from 'react';
import { useMessages, useMessageSearch } from '../hooks/useMessages';
import MessageList from '../components/chat/MessageList';
import SearchBar from '../components/common/SearchBar';
import Pagination from '../components/common/Pagination';
import { MessageSquare, Filter } from 'lucide-react';

function Messages() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    channel: '',
    user: '',
    includeDeleted: false,
  });
  const [page, setPage] = useState(1);
  const limit = 50;

  const params = {
    ...filters,
    limit,
    offset: (page - 1) * limit,
    search: searchQuery || undefined,
  };

  const { data, isLoading, error } = searchQuery
    ? useMessageSearch(searchQuery, params)
    : useMessages(params);

  const messages = data?.messages || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

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
