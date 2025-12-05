import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { channelsApi, usersApi, messagesApi } from '../../services/api';
import { 
  Search, 
  Command, 
  Hash, 
  User, 
  MessageSquare, 
  Home, 
  Radio,
  Shield,
  Settings,
  X,
  ArrowRight,
  Clock
} from 'lucide-react';

const staticCommands = [
  { id: 'home', type: 'page', icon: Home, label: 'Go to Dashboard', path: '/' },
  { id: 'live', type: 'page', icon: Radio, label: 'Go to Live Feed', path: '/live' },
  { id: 'messages', type: 'page', icon: MessageSquare, label: 'Search Messages', path: '/messages' },
  { id: 'moderation', type: 'page', icon: Shield, label: 'View Moderation', path: '/moderation' },
  { id: 'channels', type: 'page', icon: Hash, label: 'Browse Channels', path: '/channels' },
  { id: 'settings', type: 'page', icon: Settings, label: 'Open Settings', path: '/settings' },
];

function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();

  // Fetch data for search
  const { data: channelsData } = useQuery({
    queryKey: ['channels'],
    queryFn: () => channelsApi.getAll().then(res => res.data),
    staleTime: 60000,
    enabled: isOpen,
  });

  // Recent searches from localStorage
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('chatterbox-recent-searches') || '[]');
    } catch {
      return [];
    }
  });

  // Keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Build search results
  const results = useMemo(() => {
    const items = [];
    const q = query.toLowerCase().trim();

    // If no query, show recent and quick actions
    if (!q) {
      // Recent searches
      if (recentSearches.length > 0) {
        items.push({ type: 'header', label: 'Recent' });
        recentSearches.slice(0, 3).forEach(search => {
          items.push({
            id: `recent-${search.id}`,
            type: 'recent',
            icon: Clock,
            label: search.label,
            path: search.path,
          });
        });
      }

      items.push({ type: 'header', label: 'Quick Actions' });
      items.push(...staticCommands);

      // Active channels
      if (channelsData?.channels?.length > 0) {
        items.push({ type: 'header', label: 'Active Channels' });
        channelsData.channels.slice(0, 5).forEach(channel => {
          items.push({
            id: `channel-${channel.id}`,
            type: 'channel',
            icon: Hash,
            label: channel.display_name || channel.name,
            sublabel: channel.is_live ? 'Live' : undefined,
            path: `/channel/${channel.name}`,
          });
        });
      }
    } else {
      // Search static commands
      const matchingCommands = staticCommands.filter(cmd =>
        cmd.label.toLowerCase().includes(q)
      );
      if (matchingCommands.length > 0) {
        items.push({ type: 'header', label: 'Actions' });
        items.push(...matchingCommands);
      }

      // Search channels
      if (channelsData?.channels) {
        const matchingChannels = channelsData.channels.filter(channel =>
          channel.name.toLowerCase().includes(q) ||
          (channel.display_name && channel.display_name.toLowerCase().includes(q))
        );
        if (matchingChannels.length > 0) {
          items.push({ type: 'header', label: 'Channels' });
          matchingChannels.slice(0, 5).forEach(channel => {
            items.push({
              id: `channel-${channel.id}`,
              type: 'channel',
              icon: Hash,
              label: channel.display_name || channel.name,
              path: `/channel/${channel.name}`,
            });
          });
        }
      }

      // Search for user
      if (q.length >= 2) {
        items.push({ type: 'header', label: 'Search' });
        items.push({
          id: 'search-user',
          type: 'search',
          icon: User,
          label: `Search user "${query}"`,
          path: `/user/${query}`,
        });
        items.push({
          id: 'search-messages',
          type: 'search',
          icon: MessageSquare,
          label: `Search messages for "${query}"`,
          path: `/messages?search=${encodeURIComponent(query)}`,
        });
      }
    }

    return items;
  }, [query, channelsData, recentSearches]);

  // Filter out headers for navigation
  const selectableResults = results.filter(r => r.type !== 'header');

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < selectableResults.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : selectableResults.length - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = selectableResults[selectedIndex];
        if (selected) {
          handleSelect(selected);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, selectableResults]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const items = listRef.current.querySelectorAll('[data-selectable="true"]');
      items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleSelect = (item) => {
    // Save to recent searches
    const newRecent = [
      { id: item.id, label: item.label, path: item.path },
      ...recentSearches.filter(r => r.id !== item.id),
    ].slice(0, 10);
    setRecentSearches(newRecent);
    localStorage.setItem('chatterbox-recent-searches', JSON.stringify(newRecent));

    // Navigate
    navigate(item.path);
    setIsOpen(false);
  };

  if (!isOpen) return null;

  let selectableIndex = -1;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Modal */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl">
        <div className="bg-twitch-gray border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center px-4 py-3 border-b border-gray-700">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Search channels, users, or type a command..."
              className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 px-3 text-sm"
            />
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded">esc</kbd>
              <span>to close</span>
            </div>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-80 overflow-y-auto">
            {results.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No results found</p>
              </div>
            ) : (
              <div className="py-2">
                {results.map((item, index) => {
                  if (item.type === 'header') {
                    return (
                      <div 
                        key={`header-${index}`}
                        className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                      >
                        {item.label}
                      </div>
                    );
                  }

                  selectableIndex++;
                  const isSelected = selectableIndex === selectedIndex;
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      data-selectable="true"
                      onClick={() => handleSelect(item)}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                        isSelected 
                          ? 'bg-twitch-purple/20 text-white' 
                          : 'text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isSelected ? 'text-twitch-purple' : 'text-gray-500'}`} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.sublabel && (
                        <span className="text-xs text-green-400">{item.sublabel}</span>
                      )}
                      {isSelected && (
                        <ArrowRight className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-700 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-800 rounded">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-800 rounded">↵</kbd>
                select
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Command className="w-3 h-3" />
              <span>K to open</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
