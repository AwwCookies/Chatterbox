import { useState, useRef, useEffect } from 'react';
import { Search, X, Clock, TrendingUp, User, Hash, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function MobileSearch({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState([]);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('chatterbox-recent-searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse recent searches');
      }
    }
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const saveRecentSearch = (search) => {
    const updated = [search, ...recentSearches.filter(s => s.query !== search.query)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('chatterbox-recent-searches', JSON.stringify(updated));
  };

  const handleSearch = (e) => {
    e?.preventDefault();
    if (!query.trim()) return;

    // Detect search type
    let searchType = 'messages';
    let searchQuery = query.trim();

    if (query.startsWith('@')) {
      searchType = 'user';
      searchQuery = query.slice(1);
    } else if (query.startsWith('#')) {
      searchType = 'channel';
      searchQuery = query.slice(1);
    }

    // Save to recent
    saveRecentSearch({ query: query.trim(), type: searchType, timestamp: Date.now() });

    // Navigate
    if (searchType === 'user') {
      navigate(`/user/${searchQuery}`);
    } else if (searchType === 'channel') {
      navigate(`/channel/${searchQuery}`);
    } else {
      navigate(`/messages?search=${encodeURIComponent(searchQuery)}`);
    }

    setQuery('');
    onClose();
  };

  const handleRecentClick = (recent) => {
    setQuery(recent.query);
    
    if (recent.type === 'user') {
      navigate(`/user/${recent.query.replace('@', '')}`);
    } else if (recent.type === 'channel') {
      navigate(`/channel/${recent.query.replace('#', '')}`);
    } else {
      navigate(`/messages?search=${encodeURIComponent(recent.query)}`);
    }

    onClose();
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('chatterbox-recent-searches');
  };

  const quickActions = [
    { icon: User, label: 'Search user', prefix: '@', description: 'Find a user\'s messages' },
    { icon: Hash, label: 'Search channel', prefix: '#', description: 'Browse channel history' },
    { icon: TrendingUp, label: 'Recent activity', action: () => { navigate('/live'); onClose(); } },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-twitch-dark safe-area-top safe-area-bottom">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-gray-700 bg-twitch-gray">
        <form onSubmit={handleSearch} className="flex-1 flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search messages, @user, or #channel"
              className="w-full pl-10 pr-4 py-3 bg-twitch-dark border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-twitch-purple text-base"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
        <button
          onClick={onClose}
          className="px-4 py-2 text-twitch-purple font-medium"
        >
          Cancel
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Search hint */}
        {!query && (
          <div className="p-4 text-sm text-gray-400 bg-gray-800/50">
            <p>💡 Tip: Use <span className="text-twitch-purple">@username</span> to search users or <span className="text-twitch-purple">#channel</span> to browse channels</p>
          </div>
        )}

        {/* Quick Actions */}
        {!query && (
          <div className="p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Quick Actions
            </h3>
            <div className="space-y-2">
              {quickActions.map(({ icon: Icon, label, prefix, description, action }) => (
                <button
                  key={label}
                  onClick={() => {
                    if (action) {
                      action();
                    } else if (prefix) {
                      setQuery(prefix);
                      inputRef.current?.focus();
                    }
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-twitch-gray hover:bg-gray-700 active:bg-gray-600 transition-colors"
                >
                  <div className="p-2 rounded-lg bg-gray-700">
                    <Icon className="w-5 h-5 text-twitch-purple" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-white">{label}</p>
                    <p className="text-xs text-gray-400">{description}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-500" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent Searches */}
        {!query && recentSearches.length > 0 && (
          <div className="p-4 border-t border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Recent Searches
              </h3>
              <button
                onClick={clearRecentSearches}
                className="text-xs text-gray-400 hover:text-white"
              >
                Clear all
              </button>
            </div>
            <div className="space-y-1">
              {recentSearches.map((recent, index) => (
                <button
                  key={index}
                  onClick={() => handleRecentClick(recent)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-twitch-gray active:bg-gray-700 transition-colors"
                >
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="flex-1 text-left text-white">{recent.query}</span>
                  <span className="text-xs text-gray-500">
                    {recent.type === 'user' ? 'User' : recent.type === 'channel' ? 'Channel' : 'Search'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search results preview */}
        {query && (
          <div className="p-4">
            <button
              onClick={handleSearch}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-twitch-gray hover:bg-gray-700 active:bg-gray-600 transition-colors"
            >
              <Search className="w-5 h-5 text-twitch-purple" />
              <span className="flex-1 text-left">
                <span className="text-white">Search for </span>
                <span className="text-twitch-purple font-medium">"{query}"</span>
              </span>
              <ArrowRight className="w-4 h-4 text-gray-500" />
            </button>

            {/* Quick user/channel lookup */}
            {!query.startsWith('@') && !query.startsWith('#') && (
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => { 
                    navigate(`/user/${query}`); 
                    onClose(); 
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-twitch-gray active:bg-gray-700 transition-colors"
                >
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-300">View user: <span className="text-white">{query}</span></span>
                </button>
                <button
                  onClick={() => { 
                    navigate(`/channel/${query}`); 
                    onClose(); 
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-twitch-gray active:bg-gray-700 transition-colors"
                >
                  <Hash className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-300">View channel: <span className="text-white">#{query}</span></span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MobileSearch;
