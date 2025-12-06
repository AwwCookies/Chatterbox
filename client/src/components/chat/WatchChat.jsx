import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useEmotes, parseMessageWithEmotes } from '../../hooks/useEmotes';
import { useProfileCardStore } from '../../stores/profileCardStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { chatApi } from '../../services/api';
import { formatRelative } from '../../utils/formatters';
import { 
  Send, 
  Pause, 
  Play, 
  MessageSquare, 
  AlertCircle,
  LogIn,
  Loader2,
  Shield,
  Clock,
  Trash2,
  Ban,
  AlertTriangle,
  Smile,
  X,
  Search
} from 'lucide-react';

// Mod action type info
const MOD_ACTION_CONFIG = {
  timeout: { icon: Clock, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
  ban: { icon: Ban, color: 'text-red-500', bgColor: 'bg-red-500/10' },
  delete: { icon: Trash2, color: 'text-orange-400', bgColor: 'bg-orange-400/10' },
  unban: { icon: Shield, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  untimeout: { icon: Clock, color: 'text-green-500', bgColor: 'bg-green-500/10' },
};

// Badge emoji mapping
const BADGE_EMOJI = {
  broadcaster: '📺',
  moderator: '⚔️',
  vip: '💎',
  subscriber: '⭐',
  turbo: '⚡',
  premium: '👑',
  partner: '✓',
  staff: '🔧',
  admin: '🛡️',
  'bits-leader': '💰',
  'sub-gifter': '🎁',
};

// Get badge emoji
function getBadgeEmoji(badgeType) {
  const type = badgeType?.toLowerCase();
  // Check for exact match first
  if (BADGE_EMOJI[type]) return BADGE_EMOJI[type];
  // Check for partial matches (e.g., 'subscriber' in 'subscriber/12')
  for (const [key, emoji] of Object.entries(BADGE_EMOJI)) {
    if (type?.includes(key)) return emoji;
  }
  return null;
}

// Message component
function ChatMessage({ message, channelId, onUsernameClick }) {
  const showTimestamps = useSettingsStore(state => state.showTimestamps);
  const showBadges = useSettingsStore(state => state.showBadges);
  const showEmotes = useSettingsStore(state => state.showEmotes);
  const timestampFormat = useSettingsStore(state => state.timestampFormat);

  const badges = message.badges || [];
  
  // Parse emotes
  const messageParts = showEmotes 
    ? parseMessageWithEmotes(
        message.messageText || message.message_text,
        message.emotes || [],
        channelId
      )
    : [{ type: 'text', content: message.messageText || message.message_text }];

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    if (timestampFormat === '24h') {
      return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const handleUsernameClick = (e) => {
    e.preventDefault();
    onUsernameClick?.(message.username || message.displayName, e);
  };

  // Get emoji badges (filter to only ones we have emojis for)
  const emojiBadges = badges
    .map(badge => ({ type: badge.type, emoji: getBadgeEmoji(badge.type) }))
    .filter(b => b.emoji)
    .slice(0, 3);

  return (
    <div className="px-3 py-0.5 hover:bg-gray-800/30 leading-relaxed">
      {/* Timestamp */}
      {showTimestamps && (
        <span className="text-[11px] text-gray-500 mr-1.5">
          {formatTimestamp(message.timestamp || message.created_at)}
        </span>
      )}
      
      {/* Emoji Badges */}
      {showBadges && emojiBadges.length > 0 && (
        <span className="mr-1">
          {emojiBadges.map((badge, i) => (
            <span
              key={i}
              className="text-sm"
              title={badge.type}
            >
              {badge.emoji}
            </span>
          ))}
        </span>
      )}
      
      {/* Username */}
      <button
        onClick={handleUsernameClick}
        className="font-semibold hover:underline cursor-pointer"
        style={{ color: message.color || message.userColor || '#9147ff' }}
      >
        {message.displayName || message.user_display_name || message.username}
      </button>
      <span className="text-gray-400">: </span>
      
      {/* Message */}
      <span className="text-gray-100">
        {messageParts.map((part, i) => {
          if (part.type === 'emote') {
            return (
              <img
                key={i}
                src={part.emote?.url}
                alt={part.content}
                className="inline-block align-middle mx-0.5"
                style={{ height: '1.25em', width: 'auto' }}
                title={part.content}
              />
            );
          }
          return <span key={i}>{part.content}</span>;
        })}
      </span>
    </div>
  );
}

// Mod action item component
function ModActionItem({ action, onUsernameClick }) {
  const config = MOD_ACTION_CONFIG[action.action_type] || MOD_ACTION_CONFIG.timeout;
  const Icon = config.icon || AlertTriangle;
  
  const formatDuration = (seconds) => {
    if (!seconds) return '';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const handleTargetClick = (e) => {
    e.preventDefault();
    onUsernameClick?.(action.target_username || action.targetUsername, e);
  };

  // Get the last message content
  const lastMessage = action.message_text || action.messageText || action.last_message;

  return (
    <div className={`px-3 py-2 ${config.bgColor} border-l-2 ${config.color.replace('text-', 'border-')}`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 flex-shrink-0 ${config.color}`} />
        <div className="flex-1 min-w-0 text-sm">
          <span className="text-gray-400">{action.moderator_username || action.moderatorUsername || 'Mod'}</span>
          <span className="text-gray-500 mx-1">{action.action_type}</span>
          <button 
            onClick={handleTargetClick}
            className="text-white hover:underline"
          >
            {action.target_username || action.targetUsername}
          </button>
          {action.duration && (
            <span className="text-gray-400 ml-1">
              ({formatDuration(action.duration)})
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500 flex-shrink-0">
          {formatRelative(action.timestamp || action.created_at)}
        </span>
      </div>
      {action.reason && (
        <div className="text-xs text-gray-400 mt-1 pl-6">
          <span className="text-gray-500">Reason:</span> {action.reason}
        </div>
      )}
      {lastMessage && (
        <div className="text-xs text-gray-300 mt-1.5 pl-6 py-1.5 bg-gray-800/50 rounded border-l border-gray-600">
          <span className="text-gray-500 mr-1">💬</span>
          <span className="italic">"{lastMessage}"</span>
        </div>
      )}
    </div>
  );
}

// Autocomplete dropdown component
function AutocompleteDropdown({ items, selectedIndex, onSelect, type }) {
  const listRef = useRef(null);

  useEffect(() => {
    // Scroll selected item into view
    if (listRef.current && selectedIndex >= 0) {
      const item = listRef.current.children[selectedIndex];
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (items.length === 0) return null;

  return (
    <div 
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-1 bg-twitch-dark border border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50"
    >
      {items.map((item, index) => (
        <button
          key={item.code || item.username || index}
          onClick={() => onSelect(item)}
          className={`w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-gray-700 ${
            index === selectedIndex ? 'bg-gray-700' : ''
          }`}
        >
          {type === 'emote' && item.url && (
            <img 
              src={item.url} 
              alt={item.code} 
              className="w-6 h-6 object-contain"
            />
          )}
          {type === 'user' && (
            <span className="w-6 h-6 rounded-full bg-twitch-purple flex items-center justify-center text-xs font-bold">
              {(item.displayName || item.username)?.[0]?.toUpperCase()}
            </span>
          )}
          <span className="text-white text-sm truncate">
            {type === 'emote' ? item.code : `@${item.displayName || item.username}`}
          </span>
          {type === 'emote' && item.type && (
            <span className="text-xs text-gray-500 ml-auto">{item.type}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// Main WatchChat component
export default function WatchChat({ 
  messages = [], 
  modActions = [],
  channelName, 
  channelData,
  isConnected 
}) {
  const { isAuthenticated, user } = useAuth();
  const openProfileCard = useProfileCardStore(state => state.openCard);
  const { loadChannelEmotes, isLoaded: emotesLoaded, cache: emoteCache } = useEmotes();
  
  const [activeTab, setActiveTab] = useState('chat');
  const [inputValue, setInputValue] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [displayMessages, setDisplayMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [chatPermissions, setChatPermissions] = useState(null);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [channelEmotesLoaded, setChannelEmotesLoaded] = useState(false);
  
  // Autocomplete state
  const [autocompleteItems, setAutocompleteItems] = useState([]);
  const [autocompleteType, setAutocompleteType] = useState(null);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [autocompleteStart, setAutocompleteStart] = useState(-1);
  const [showEmotePicker, setShowEmotePicker] = useState(false);
  const [emoteSearch, setEmoteSearch] = useState('');
  
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const emotePickerRef = useRef(null);
  const maxMessages = 200;

  // Build list of recent chatters for @mention completion
  const recentChatters = useMemo(() => {
    const chatters = new Map();
    messages.forEach(msg => {
      const username = msg.username || msg.displayName;
      if (username && !chatters.has(username.toLowerCase())) {
        chatters.set(username.toLowerCase(), {
          username: username,
          displayName: msg.displayName || msg.user_display_name || username,
        });
      }
    });
    return Array.from(chatters.values()).slice(0, 100);
  }, [messages]);

  // Build list of available emotes for completion
  const availableEmotes = useMemo(() => {
    const emotes = [];
    const channelId = channelData?.twitch_id;
    
    // Add channel emotes
    if (channelId && emoteCache.channels[channelId]) {
      const channelEmotes = emoteCache.channels[channelId];
      Object.entries(channelEmotes.seventv || {}).forEach(([code, emote]) => {
        emotes.push({ code, url: emote.url, type: '7TV' });
      });
      Object.entries(channelEmotes.bttv || {}).forEach(([code, emote]) => {
        emotes.push({ code, url: emote.url, type: 'BTTV' });
      });
      Object.entries(channelEmotes.ffz || {}).forEach(([code, emote]) => {
        emotes.push({ code, url: emote.url, type: 'FFZ' });
      });
    }
    
    // Add global emotes
    Object.entries(emoteCache.global.seventv || {}).forEach(([code, emote]) => {
      emotes.push({ code, url: emote.url, type: '7TV' });
    });
    Object.entries(emoteCache.global.bttv || {}).forEach(([code, emote]) => {
      emotes.push({ code, url: emote.url, type: 'BTTV' });
    });
    Object.entries(emoteCache.global.ffz || {}).forEach(([code, emote]) => {
      emotes.push({ code, url: emote.url, type: 'FFZ' });
    });
    
    return emotes;
  }, [channelData?.twitch_id, emoteCache, emotesLoaded, channelEmotesLoaded]);

  // Load channel emotes
  useEffect(() => {
    if (channelData?.twitch_id) {
      loadChannelEmotes(channelData.twitch_id, channelData.name).then(() => {
        setChannelEmotesLoaded(true);
      });
    }
  }, [channelData, loadChannelEmotes]);

  // Check chat permissions when authenticated
  useEffect(() => {
    if (isAuthenticated && channelName) {
      setPermissionsLoading(true);
      chatApi.getPermissions(channelName)
        .then(res => {
          setChatPermissions(res.data);
        })
        .catch(err => {
          console.error('Failed to check chat permissions:', err);
          setChatPermissions({ canSend: false, error: true });
        })
        .finally(() => {
          setPermissionsLoading(false);
        });
    }
  }, [isAuthenticated, channelName]);

  // Update displayed messages when not paused
  useEffect(() => {
    if (!isPaused) {
      setDisplayMessages(messages.slice(0, maxMessages));
    }
  }, [messages, isPaused, maxMessages]);

  // Auto scroll to bottom
  useEffect(() => {
    if (!isPaused && containerRef.current && activeTab === 'chat') {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayMessages, isPaused, activeTab]);

  // Close emote picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emotePickerRef.current && !emotePickerRef.current.contains(e.target)) {
        setShowEmotePicker(false);
      }
    };
    if (showEmotePicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showEmotePicker]);

  // Group emotes by source for the picker
  const groupedEmotes = useMemo(() => {
    const groups = {
      'Channel 7TV': [],
      'Channel BTTV': [],
      'Channel FFZ': [],
      'Global 7TV': [],
      'Global BTTV': [],
      'Global FFZ': [],
    };
    
    const channelId = channelData?.twitch_id;
    
    if (channelId && emoteCache.channels[channelId]) {
      const ch = emoteCache.channels[channelId];
      Object.entries(ch.seventv || {}).forEach(([code, emote]) => {
        groups['Channel 7TV'].push({ code, url: emote.url });
      });
      Object.entries(ch.bttv || {}).forEach(([code, emote]) => {
        groups['Channel BTTV'].push({ code, url: emote.url });
      });
      Object.entries(ch.ffz || {}).forEach(([code, emote]) => {
        groups['Channel FFZ'].push({ code, url: emote.url });
      });
    }
    
    Object.entries(emoteCache.global.seventv || {}).forEach(([code, emote]) => {
      groups['Global 7TV'].push({ code, url: emote.url });
    });
    Object.entries(emoteCache.global.bttv || {}).forEach(([code, emote]) => {
      groups['Global BTTV'].push({ code, url: emote.url });
    });
    Object.entries(emoteCache.global.ffz || {}).forEach(([code, emote]) => {
      groups['Global FFZ'].push({ code, url: emote.url });
    });
    
    // Filter empty groups
    return Object.fromEntries(
      Object.entries(groups).filter(([_, emotes]) => emotes.length > 0)
    );
  }, [channelData?.twitch_id, emoteCache, emotesLoaded, channelEmotesLoaded]);

  // Filter emotes by search
  const filteredGroupedEmotes = useMemo(() => {
    if (!emoteSearch.trim()) return groupedEmotes;
    
    const search = emoteSearch.toLowerCase();
    const filtered = {};
    
    for (const [group, emotes] of Object.entries(groupedEmotes)) {
      const matches = emotes.filter(e => e.code.toLowerCase().includes(search));
      if (matches.length > 0) {
        filtered[group] = matches;
      }
    }
    
    return filtered;
  }, [groupedEmotes, emoteSearch]);

  const handleEmoteSelect = (emote) => {
    const cursorPos = inputRef.current?.selectionStart || inputValue.length;
    const before = inputValue.slice(0, cursorPos);
    const after = inputValue.slice(cursorPos);
    
    // Add space before if needed
    const needsSpaceBefore = before.length > 0 && !before.endsWith(' ');
    // Add space after if needed
    const needsSpaceAfter = after.length > 0 && !after.startsWith(' ');
    
    const insertion = (needsSpaceBefore ? ' ' : '') + emote.code + (needsSpaceAfter ? ' ' : '');
    const newValue = before + insertion + after;
    
    setInputValue(newValue);
    setShowEmotePicker(false);
    
    setTimeout(() => {
      inputRef.current?.focus();
      const newPos = cursorPos + insertion.length;
      inputRef.current?.setSelectionRange(newPos, newPos);
    }, 0);
  };

  // Handle autocomplete
  const updateAutocomplete = useCallback((value, cursorPos) => {
    // Find the word being typed at cursor position
    const beforeCursor = value.slice(0, cursorPos);
    
    // Check for @mention
    const mentionMatch = beforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      const matches = recentChatters
        .filter(c => c.username.toLowerCase().startsWith(query) || 
                     c.displayName.toLowerCase().startsWith(query))
        .slice(0, 10);
      
      setAutocompleteItems(matches);
      setAutocompleteType('user');
      setAutocompleteIndex(0);
      setAutocompleteStart(cursorPos - mentionMatch[1].length - 1);
      return;
    }
    
    // Check for emote (word at end, at least 2 chars)
    const emoteMatch = beforeCursor.match(/(?:^|\s)(\w{2,})$/);
    if (emoteMatch) {
      const query = emoteMatch[1].toLowerCase();
      const matches = availableEmotes
        .filter(e => e.code.toLowerCase().startsWith(query))
        .slice(0, 10);
      
      if (matches.length > 0) {
        setAutocompleteItems(matches);
        setAutocompleteType('emote');
        setAutocompleteIndex(0);
        setAutocompleteStart(cursorPos - emoteMatch[1].length);
        return;
      }
    }
    
    // No match, clear autocomplete
    setAutocompleteItems([]);
    setAutocompleteType(null);
    setAutocompleteStart(-1);
  }, [recentChatters, availableEmotes]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    updateAutocomplete(value, e.target.selectionStart);
  };

  const handleAutocompleteSelect = (item) => {
    if (autocompleteStart === -1) return;
    
    const beforeMatch = inputValue.slice(0, autocompleteStart);
    const afterCursor = inputValue.slice(inputRef.current?.selectionStart || inputValue.length);
    
    let insertion;
    if (autocompleteType === 'user') {
      insertion = `@${item.username} `;
    } else {
      insertion = `${item.code} `;
    }
    
    const newValue = beforeMatch + insertion + afterCursor;
    setInputValue(newValue);
    setAutocompleteItems([]);
    setAutocompleteType(null);
    
    // Focus and move cursor
    setTimeout(() => {
      inputRef.current?.focus();
      const newPos = beforeMatch.length + insertion.length;
      inputRef.current?.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleUsernameClick = useCallback((username, event) => {
    openProfileCard(username, { x: event.clientX, y: event.clientY });
  }, [openProfileCard]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!inputValue.trim() || isSending || !chatPermissions?.canSend) {
      return;
    }

    setSendError(null);
    setIsSending(true);

    try {
      await chatApi.sendMessage(channelName, inputValue.trim());
      setInputValue('');
      setAutocompleteItems([]);
      inputRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage = error.response?.data?.error || 'Failed to send message';
      setSendError(errorMessage);
      
      // Clear error after 5 seconds
      setTimeout(() => setSendError(null), 5000);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    // Handle autocomplete navigation
    if (autocompleteItems.length > 0) {
      if (e.key === 'Tab' || (e.key === 'Enter' && autocompleteItems.length > 0)) {
        e.preventDefault();
        handleAutocompleteSelect(autocompleteItems[autocompleteIndex]);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocompleteIndex(i => Math.min(i + 1, autocompleteItems.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocompleteIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setAutocompleteItems([]);
        return;
      }
    }
    
    // Send message on Enter
    if (e.key === 'Enter' && !e.shiftKey && autocompleteItems.length === 0) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // Render chat input area
  const renderChatInput = () => {
    if (!isAuthenticated) {
      return (
        <div className="px-4 py-3 border-t border-gray-700 bg-twitch-gray">
          <Link 
            to="/login"
            className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-twitch-purple hover:bg-twitch-purple-dark text-white rounded-lg transition-colors"
          >
            <LogIn className="w-4 h-4" />
            <span>Log in to chat</span>
          </Link>
        </div>
      );
    }

    if (permissionsLoading) {
      return (
        <div className="px-4 py-3 border-t border-gray-700 bg-twitch-gray">
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Checking permissions...</span>
          </div>
        </div>
      );
    }

    if (!chatPermissions?.canSend) {
      const needsReauth = !chatPermissions?.hasChatScope;
      
      return (
        <div className="px-4 py-3 border-t border-gray-700 bg-twitch-gray">
          {needsReauth ? (
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-2">
                Chat permissions needed
              </p>
              <Link 
                to="/login"
                className="inline-flex items-center justify-center gap-2 py-2 px-4 bg-twitch-purple hover:bg-twitch-purple-dark text-white rounded-lg transition-colors text-sm"
              >
                <LogIn className="w-4 h-4" />
                <span>Re-authenticate to chat</span>
              </Link>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center">
              Unable to send messages in this channel
            </p>
          )}
        </div>
      );
    }

    return (
      <form onSubmit={handleSendMessage} className="px-3 py-2 border-t border-gray-700 bg-twitch-gray relative">
        {/* Autocomplete dropdown */}
        <AutocompleteDropdown
          items={autocompleteItems}
          selectedIndex={autocompleteIndex}
          onSelect={handleAutocompleteSelect}
          type={autocompleteType}
        />
        
        {/* Emote Picker */}
        {showEmotePicker && (
          <div 
            ref={emotePickerRef}
            className="absolute bottom-full left-0 right-0 mb-1 bg-twitch-dark border border-gray-600 rounded-lg shadow-xl z-50 max-h-80 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center gap-2 p-2 border-b border-gray-700">
              <div className="flex-1 relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={emoteSearch}
                  onChange={(e) => setEmoteSearch(e.target.value)}
                  placeholder="Search emotes..."
                  className="w-full bg-gray-800 border border-gray-600 rounded pl-8 pr-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple"
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={() => setShowEmotePicker(false)}
                className="p-1 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Emote Grid */}
            <div className="flex-1 overflow-y-auto p-2">
              {Object.keys(filteredGroupedEmotes).length === 0 ? (
                <div className="text-center text-gray-500 py-4 text-sm">
                  {emoteSearch ? 'No emotes found' : 'Loading emotes...'}
                </div>
              ) : (
                Object.entries(filteredGroupedEmotes).map(([group, emotes]) => (
                  <div key={group} className="mb-3">
                    <div className="text-xs text-gray-500 font-medium mb-1.5 px-1">
                      {group} ({emotes.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {emotes.map((emote) => (
                        <button
                          key={`${group}-${emote.code}`}
                          type="button"
                          onClick={() => handleEmoteSelect(emote)}
                          className="p-1.5 hover:bg-gray-700 rounded transition-colors group"
                          title={emote.code}
                        >
                          <img
                            src={emote.url}
                            alt={emote.code}
                            className="w-7 h-7 object-contain"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        
        {sendError && (
          <div className="flex items-center gap-2 text-red-400 text-xs mb-2 px-1">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            <span>{sendError}</span>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowEmotePicker(!showEmotePicker)}
            className={`p-2 rounded transition-colors ${
              showEmotePicker 
                ? 'bg-twitch-purple text-white' 
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
            title="Emotes"
          >
            <Smile className="w-5 h-5" />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Send a message"
            maxLength={500}
            disabled={isSending}
            className="flex-1 bg-twitch-dark border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isSending}
            className="p-2 bg-twitch-purple hover:bg-twitch-purple-dark disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
            title="Send message"
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        
        <div className="flex items-center justify-between mt-1 px-1">
          <span className="text-xs text-gray-500">
            {chatPermissions?.displayName || user?.display_name}
          </span>
          <span className="text-xs text-gray-500">
            {inputValue.length}/500
          </span>
        </div>
      </form>
    );
  };

  return (
    <div className="flex flex-col h-full bg-twitch-darker">
      {/* Chat Header with Tabs */}
      <div className="border-b border-gray-700 flex-shrink-0">
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-twitch-purple" />
            <span className="font-semibold text-white">Stream Chat</span>
            {isConnected && (
              <span className="w-2 h-2 bg-green-500 rounded-full" title="Connected" />
            )}
          </div>
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`p-1.5 rounded transition-colors ${
              isPaused 
                ? 'bg-yellow-600/20 text-yellow-500' 
                : 'hover:bg-gray-700 text-gray-400'
            }`}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex px-2">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'chat'
                ? 'text-twitch-purple border-twitch-purple'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            Chat
            <span className="ml-1.5 text-xs text-gray-500">
              {displayMessages.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('modactions')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'modactions'
                ? 'text-twitch-purple border-twitch-purple'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4 inline mr-1" />
            Mod Log
            {modActions.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full">
                {modActions.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Paused Banner */}
      {isPaused && activeTab === 'chat' && (
        <div className="bg-yellow-600/20 text-yellow-500 text-xs text-center py-1 border-b border-yellow-600/30">
          Chat paused - {messages.length - displayMessages.length} new messages
        </div>
      )}

      {/* Tab Content */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto"
      >
        {activeTab === 'chat' ? (
          // Chat Messages
          displayMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              {emotesLoaded ? 'Waiting for messages...' : 'Loading emotes...'}
            </div>
          ) : (
            [...displayMessages].reverse().map((message, index) => (
              <ChatMessage
                key={message.messageId || message.message_id || index}
                message={message}
                channelId={channelData?.twitch_id}
                onUsernameClick={handleUsernameClick}
              />
            ))
          )
        ) : (
          // Mod Actions
          modActions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm p-4">
              <Shield className="w-8 h-8 mb-2 opacity-50" />
              <p>No mod actions yet</p>
              <p className="text-xs text-gray-600 mt-1">
                Timeouts, bans, and deletions will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700/50">
              {[...modActions].reverse().map((action, index) => (
                <ModActionItem
                  key={action.id || index}
                  action={action}
                  onUsernameClick={handleUsernameClick}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Chat Input */}
      {renderChatInput()}
      
      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-700 text-xs text-gray-500 text-center flex-shrink-0">
        Chat via Chatterbox • <Link to={`/channel/${channelName}`} className="text-twitch-purple hover:underline">View logs</Link>
      </div>
    </div>
  );
}
