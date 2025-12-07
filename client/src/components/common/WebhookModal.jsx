import { useState, useEffect, useRef, useCallback } from 'react';
import { webhooksApi, channelsApi, usersApi } from '../../services/api';
import { useToastStore } from '../../stores/toastStore';
import {
  X,
  AlertCircle,
  Loader2,
  Search,
  User,
  Hash,
  Clock,
  Image,
  AtSign,
  FileText,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Sparkles,
  MessageSquare,
  Shield,
  Radio,
  Check,
  Plus,
  Settings,
  Zap,
  Server,
  Gem,
  Gift,
  Star,
} from 'lucide-react';

// Webhook type configurations
const WEBHOOK_TYPES = {
  tracked_user_message: {
    label: 'Tracked User Messages',
    description: 'Get notified when specific users send messages',
    icon: MessageSquare,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  mod_action: {
    label: 'Moderation Actions',
    description: 'Get notified about timeouts, bans, and other mod actions',
    icon: Shield,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
  },
  channel_live: {
    label: 'Channel Goes Live',
    description: 'Get notified when tracked channels start streaming',
    icon: Radio,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
  },
  channel_offline: {
    label: 'Channel Goes Offline',
    description: 'Get notified when tracked channels stop streaming',
    icon: Radio,
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
  },
  channel_game_change: {
    label: 'Game Change',
    description: 'Get notified when tracked channels change their game',
    icon: Radio,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
  },
  channel_bits: {
    label: 'Bits/Cheers',
    description: 'Get notified when viewers cheer with bits',
    icon: Gem,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
  },
  channel_subscription: {
    label: 'Subscriptions',
    description: 'Get notified about new subs and resubs',
    icon: Star,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
  },
  channel_gift_sub: {
    label: 'Gift Subs',
    description: 'Get notified when someone gifts subs',
    icon: Gift,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
  },
  channel_raid: {
    label: 'Raids',
    description: 'Get notified when a channel gets raided',
    icon: Zap,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
  },
};

// Preset colors for Discord embeds
const PRESET_COLORS = [
  { color: '#5865F2', name: 'Blurple' },
  { color: '#57F287', name: 'Green' },
  { color: '#FEE75C', name: 'Yellow' },
  { color: '#EB459E', name: 'Fuchsia' },
  { color: '#ED4245', name: 'Red' },
  { color: '#9146FF', name: 'Twitch' },
  { color: '#00D4FF', name: 'Cyan' },
  { color: '#FF6B35', name: 'Orange' },
];

// Mod action types with descriptions
const MOD_ACTION_TYPES = [
  { value: 'ban', label: 'Ban', description: 'Permanent bans' },
  { value: 'timeout', label: 'Timeout', description: 'Temporary timeouts' },
  { value: 'delete', label: 'Delete', description: 'Deleted messages' },
  { value: 'unban', label: 'Unban', description: 'Removed bans' },
  { value: 'untimeout', label: 'Untimeout', description: 'Removed timeouts' },
];

// Sub types for subscription webhooks
const SUB_TYPES = [
  { value: 'sub', label: 'New Sub', description: 'First-time subscribers' },
  { value: 'resub', label: 'Resub', description: 'Returning subscribers' },
  { value: 'prime', label: 'Prime', description: 'Amazon Prime subscriptions' },
];

// Debounce helper
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// User autocomplete input component
function UserAutocomplete({ selectedUsers, onAdd, onRemove, maxUsers = 50 }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      setLoading(true);
      usersApi.getAll({ search: debouncedQuery, limit: 10 })
        .then(res => {
          const users = res.data.users || res.data || [];
          // Filter out already selected users
          const filtered = users.filter(u => 
            !selectedUsers.includes(u.username?.toLowerCase())
          );
          setSuggestions(filtered);
          setHighlightedIndex(0);
        })
        .catch(() => setSuggestions([]))
        .finally(() => setLoading(false));
    } else {
      setSuggestions([]);
    }
  }, [debouncedQuery, selectedUsers]);

  const handleSelect = (username) => {
    const normalized = username.toLowerCase();
    if (!selectedUsers.includes(normalized) && selectedUsers.length < maxUsers) {
      onAdd(normalized);
    }
    setQuery('');
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0 && highlightedIndex >= 0) {
        handleSelect(suggestions[highlightedIndex].username);
      } else if (query.trim()) {
        // Allow adding custom username even without suggestion
        handleSelect(query.trim());
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Escape') {
      setSuggestions([]);
      setFocused(false);
    } else if (e.key === 'Backspace' && !query && selectedUsers.length > 0) {
      onRemove(selectedUsers[selectedUsers.length - 1]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-300">
        Tracked Users
        <span className="text-gray-500 font-normal ml-2">
          ({selectedUsers.length}/{maxUsers})
        </span>
      </label>
      
      {/* Selected users chips */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-twitch-gray rounded-lg border border-gray-600">
          {selectedUsers.map(username => (
            <span
              key={username}
              className="inline-flex items-center gap-1 px-2 py-1 bg-twitch-purple/20 text-twitch-purple rounded-md text-sm group"
            >
              <User className="w-3 h-3" />
              {username}
              <button
                type="button"
                onClick={() => onRemove(username)}
                className="ml-0.5 hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      
      {/* Input with autocomplete */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 200)}
            onKeyDown={handleKeyDown}
            placeholder="Search for users to track..."
            className="w-full bg-twitch-gray border border-gray-600 rounded-lg pl-10 pr-10 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple"
            disabled={selectedUsers.length >= maxUsers}
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 animate-spin" />
          )}
        </div>
        
        {/* Suggestions dropdown */}
        {focused && suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-twitch-dark border border-gray-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
            {suggestions.map((user, index) => (
              <button
                key={user.username}
                type="button"
                onClick={() => handleSelect(user.username)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                  index === highlightedIndex ? 'bg-twitch-purple/20' : 'hover:bg-gray-700'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
                  {user.profile_image_url ? (
                    <img src={user.profile_image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{user.display_name || user.username}</p>
                  <p className="text-gray-500 text-xs truncate">@{user.username}</p>
                </div>
                {user.message_count && (
                  <span className="text-xs text-gray-500">{user.message_count.toLocaleString()} msgs</span>
                )}
              </button>
            ))}
          </div>
        )}
        
        {/* No results message */}
        {focused && query.length >= 2 && !loading && suggestions.length === 0 && (
          <div className="absolute z-10 w-full mt-1 bg-twitch-dark border border-gray-600 rounded-lg shadow-xl p-3">
            <p className="text-gray-400 text-sm text-center">
              No users found. Press Enter to add "{query}" anyway.
            </p>
          </div>
        )}
      </div>
      
      <p className="text-xs text-gray-500">
        Search and select users to track. Press Enter to add custom usernames.
      </p>
    </div>
  );
}

// Channel picker with search
function ChannelPicker({ selectedChannels, onToggle, allChannels, setAllChannels }) {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!allChannels && channels.length === 0) {
      setLoading(true);
      channelsApi.getAll({ active: true })
        .then(res => {
          setChannels(res.data.channels || res.data || []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [allChannels]);

  const filteredChannels = channels.filter(ch => {
    const name = ch.name || ch.channel_name || ch;
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-300">Channels</label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={allChannels}
            onChange={(e) => setAllChannels(e.target.checked)}
            className="rounded bg-twitch-gray border-gray-600 text-twitch-purple focus:ring-twitch-purple"
          />
          <span className="text-sm text-gray-400">All channels</span>
        </label>
      </div>
      
      {!allChannels && (
        <div className="space-y-2">
          {/* Selected channels */}
          {selectedChannels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedChannels.map(channel => (
                <span
                  key={channel}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-md text-sm"
                >
                  <Hash className="w-3 h-3" />
                  {channel}
                  <button
                    type="button"
                    onClick={() => onToggle(channel)}
                    className="ml-0.5 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          
          {/* Search and list */}
          <div className="bg-twitch-gray border border-gray-600 rounded-lg overflow-hidden">
            <div className="relative border-b border-gray-600">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search channels..."
                className="w-full bg-transparent pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
              />
            </div>
            
            <div className="max-h-40 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                </div>
              ) : filteredChannels.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  {search ? 'No channels match your search' : 'No channels available'}
                </p>
              ) : (
                <div className="p-2 grid grid-cols-2 gap-1">
                  {filteredChannels.map(channel => {
                    const name = channel.name || channel.channel_name || channel;
                    const isSelected = selectedChannels.includes(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => onToggle(name)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ${
                          isSelected 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'hover:bg-gray-700 text-gray-300'
                        }`}
                      >
                        <Hash className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{name}</span>
                        {isSelected && <Check className="w-3 h-3 ml-auto flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          
          <p className="text-xs text-gray-500">
            {selectedChannels.length} channel{selectedChannels.length !== 1 ? 's' : ''} selected
          </p>
        </div>
      )}
    </div>
  );
}

// Embed customization section
function EmbedCustomization({ formData, setFormData }) {
  const [showPreview, setShowPreview] = useState(false);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-twitch-purple" />
          Embed Customization
        </h3>
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
        >
          {showPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          {showPreview ? 'Hide' : 'Show'} Preview
        </button>
      </div>
      
      {/* Color picker */}
      <div>
        <label className="block text-xs text-gray-400 mb-2">Embed Color</label>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_COLORS.map(({ color, name }) => (
            <button
              key={color}
              type="button"
              onClick={() => setFormData({ ...formData, embedColor: color })}
              className={`w-7 h-7 rounded-md transition-all ${
                formData.embedColor === color 
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-twitch-dark scale-110' 
                  : 'hover:scale-105'
              }`}
              style={{ backgroundColor: color }}
              title={name}
            />
          ))}
          <div className="relative">
            <input
              type="color"
              value={formData.embedColor}
              onChange={(e) => setFormData({ ...formData, embedColor: e.target.value })}
              className="w-7 h-7 rounded-md cursor-pointer opacity-0 absolute inset-0"
            />
            <div 
              className="w-7 h-7 rounded-md border-2 border-dashed border-gray-600 flex items-center justify-center"
              style={{ backgroundColor: formData.embedColor }}
            >
              <Plus className="w-3 h-3 text-gray-400" />
            </div>
          </div>
          <span className="text-xs text-gray-500 ml-2 font-mono">{formData.embedColor}</span>
        </div>
      </div>
      
      {/* Custom bot name */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">
          <AtSign className="w-3 h-3 inline mr-1" />
          Custom Bot Name
        </label>
        <input
          type="text"
          value={formData.customUsername}
          onChange={(e) => setFormData({ ...formData, customUsername: e.target.value })}
          placeholder="Chatterbox"
          maxLength={80}
          className="w-full bg-twitch-gray border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple"
        />
      </div>
      
      {/* Custom avatar URL */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">
          <Image className="w-3 h-3 inline mr-1" />
          Custom Avatar URL
        </label>
        <input
          type="url"
          value={formData.customAvatarUrl}
          onChange={(e) => setFormData({ ...formData, customAvatarUrl: e.target.value })}
          placeholder="https://example.com/avatar.png"
          className="w-full bg-twitch-gray border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple font-mono"
        />
      </div>
      
      {/* Toggle options */}
      <div className="space-y-2">
        <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-700/50 transition-colors">
          <input
            type="checkbox"
            checked={formData.includeTimestamp}
            onChange={(e) => setFormData({ ...formData, includeTimestamp: e.target.checked })}
            className="rounded bg-twitch-gray border-gray-600 text-twitch-purple focus:ring-twitch-purple"
          />
          <Clock className="w-4 h-4 text-gray-400" />
          <div>
            <span className="text-sm text-gray-300">Include Timestamp</span>
            <p className="text-xs text-gray-500">Show when the event occurred</p>
          </div>
        </label>
        
        <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-700/50 transition-colors">
          <input
            type="checkbox"
            checked={formData.mentionEveryone ?? false}
            onChange={(e) => setFormData({ ...formData, mentionEveryone: e.target.checked })}
            className="rounded bg-twitch-gray border-gray-600 text-twitch-purple focus:ring-twitch-purple"
          />
          <Zap className="w-4 h-4 text-yellow-400" />
          <div>
            <span className="text-sm text-gray-300">Mention @everyone</span>
            <p className="text-xs text-gray-500">Ping everyone when triggered (use sparingly)</p>
          </div>
        </label>
      </div>
      
      {/* Preview */}
      {showPreview && (
        <div className="bg-[#36393f] rounded-lg p-4 border-l-4" style={{ borderLeftColor: formData.embedColor }}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-twitch-purple flex items-center justify-center flex-shrink-0">
              {formData.customAvatarUrl ? (
                <img src={formData.customAvatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <MessageSquare className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{formData.customUsername || 'Chatterbox'}</span>
                <span className="text-xs text-gray-400 bg-[#5865F2] px-1 rounded">BOT</span>
                <span className="text-xs text-gray-500">Today at 12:00 PM</span>
              </div>
              <div className="mt-2 bg-[#2f3136] rounded p-3 border-l-4" style={{ borderLeftColor: formData.embedColor }}>
                <p className="text-sm text-gray-300">
                  <strong className="text-white">Example User</strong> sent a message in <strong className="text-twitch-purple">#channel</strong>
                </p>
                <p className="text-sm text-gray-400 mt-2 italic">"This is a preview of how your webhook will look!"</p>
                {formData.includeTimestamp && (
                  <p className="text-xs text-gray-500 mt-2">Dec 6, 2025 • 12:00 PM</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Main modal component
export default function WebhookModal({ 
  webhook, 
  onClose, 
  onSave, 
  savedUrls = [], 
  onRefreshUrls, 
  maxTrackedUsernames = 50,
  hideWebhookUrl = false,
  discordChannel = null,
  discordGuild = null,
  saving: externalSaving = false,
  folders = [],
}) {
  const addToast = useToastStore(state => state.addToast);
  const isEditing = !!webhook;
  const isDiscordCreate = hideWebhookUrl && discordChannel && discordGuild;
  
  // Generate default name for Discord webhooks
  const getDefaultName = () => {
    if (webhook?.name) return webhook.name;
    if (isDiscordCreate && discordChannel?.name) {
      return `#${discordChannel.name} notifications`;
    }
    return '';
  };
  
  // Form state
  const [formData, setFormData] = useState({
    name: getDefaultName(),
    webhookUrl: '',
    webhookType: webhook?.webhook_type || 'tracked_user_message',
    embedColor: webhook?.embed_color || '#5865F2',
    customUsername: webhook?.custom_username || '',
    customAvatarUrl: webhook?.custom_avatar_url || '',
    includeTimestamp: webhook?.include_timestamp ?? true,
    mentionEveryone: webhook?.config?.mention_everyone ?? false,
    folder: webhook?.folder || '',
  });
  
  const [newFolder, setNewFolder] = useState('');
  const [trackedUsers, setTrackedUsers] = useState(webhook?.config?.tracked_usernames || []);
  const [selectedChannels, setSelectedChannels] = useState(webhook?.config?.channels || []);
  const [allChannels, setAllChannels] = useState(!webhook?.config?.channels?.length);
  const [actionTypes, setActionTypes] = useState(webhook?.config?.action_types || ['ban', 'timeout']);
  
  // Monetization thresholds
  const [minBits, setMinBits] = useState(webhook?.config?.min_bits || 0);
  const [minGiftCount, setMinGiftCount] = useState(webhook?.config?.min_gift_count || 1);
  const [minViewers, setMinViewers] = useState(webhook?.config?.min_viewers || 0);
  const [minMonths, setMinMonths] = useState(webhook?.config?.min_months || 0);
  const [subTypes, setSubTypes] = useState(webhook?.config?.sub_types || ['sub', 'resub', 'prime']);
  
  const [saveUrlToBank, setSaveUrlToBank] = useState(false);
  const [savedUrlName, setSavedUrlName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('basics');

  const handleToggleChannel = (name) => {
    setSelectedChannels(prev => 
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    );
  };

  const handleSelectSavedUrl = (urlId) => {
    const savedUrl = savedUrls.find(u => u.id === parseInt(urlId));
    if (savedUrl) {
      setFormData({ ...formData, webhookUrl: savedUrl.webhook_url });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      // Build config based on type
      let config = {};
      
      if (formData.webhookType === 'tracked_user_message') {
        if (trackedUsers.length === 0) {
          throw new Error('At least one tracked user is required');
        }
        config.tracked_usernames = trackedUsers;
      } else if (formData.webhookType === 'mod_action') {
        if (actionTypes.length === 0) {
          throw new Error('At least one action type is required');
        }
        config.action_types = actionTypes;
        if (!allChannels && selectedChannels.length > 0) {
          config.channels = selectedChannels;
        }
      } else if (formData.webhookType === 'channel_bits') {
        if (!allChannels && selectedChannels.length > 0) {
          config.channels = selectedChannels;
        }
        if (minBits > 0) {
          config.min_bits = minBits;
        }
      } else if (formData.webhookType === 'channel_subscription') {
        if (!allChannels && selectedChannels.length > 0) {
          config.channels = selectedChannels;
        }
        if (subTypes.length > 0 && subTypes.length < 3) {
          config.sub_types = subTypes;
        }
        if (minMonths > 0) {
          config.min_months = minMonths;
        }
      } else if (formData.webhookType === 'channel_gift_sub') {
        if (!allChannels && selectedChannels.length > 0) {
          config.channels = selectedChannels;
        }
        if (minGiftCount > 1) {
          config.min_gift_count = minGiftCount;
        }
      } else if (formData.webhookType === 'channel_raid') {
        if (!allChannels && selectedChannels.length > 0) {
          config.channels = selectedChannels;
        }
        if (minViewers > 0) {
          config.min_viewers = minViewers;
        }
      } else {
        if (!allChannels && selectedChannels.length > 0) {
          config.channels = selectedChannels;
        }
      }
      
      if (formData.mentionEveryone) {
        config.mention_everyone = true;
      }

      // Determine folder - use new folder if specified, otherwise existing selection
      const folder = newFolder.trim() || formData.folder || null;

      const data = {
        name: formData.name,
        webhookType: formData.webhookType,
        config,
        embedColor: formData.embedColor,
        customUsername: formData.customUsername || null,
        customAvatarUrl: formData.customAvatarUrl || null,
        includeTimestamp: formData.includeTimestamp,
        folder,
      };

      if (!isEditing && formData.webhookUrl) {
        data.webhookUrl = formData.webhookUrl;
        
        if (saveUrlToBank && savedUrlName.trim()) {
          try {
            await webhooksApi.saveUrl({ name: savedUrlName, webhookUrl: formData.webhookUrl });
            onRefreshUrls?.();
          } catch {
            addToast('Webhook saved but URL could not be added to bank', 'warning');
          }
        }
      } else if (!isEditing && !isDiscordCreate) {
        throw new Error('Webhook URL is required');
      }

      await onSave(data, webhook?.id);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save webhook');
    } finally {
      setSaving(false);
    }
  };

  const typeConfig = WEBHOOK_TYPES[formData.webhookType];
  const TypeIcon = typeConfig?.icon || MessageSquare;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-twitch-dark rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-gradient-to-r from-twitch-purple/20 to-transparent">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${typeConfig?.bgColor || 'bg-gray-700'}`}>
              <TypeIcon className={`w-5 h-5 ${typeConfig?.color || 'text-gray-400'}`} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {isEditing ? 'Edit Webhook' : 'Create Webhook'}
              </h2>
              <p className="text-xs text-gray-400">{typeConfig?.description}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Section: Basics */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Basic Settings
              </h3>
              
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Webhook Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Mod Alerts, User Tracker"
                  className="w-full bg-twitch-gray border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple"
                  required
                />
              </div>

              {/* Folder */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Folder (optional)</label>
                <div className="flex gap-2">
                  {folders.length > 0 ? (
                    <select
                      value={formData.folder}
                      onChange={(e) => {
                        setFormData({ ...formData, folder: e.target.value });
                        setNewFolder('');
                      }}
                      className="flex-1 bg-twitch-gray border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-twitch-purple"
                    >
                      <option value="">No folder</option>
                      {folders.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  ) : null}
                  <input
                    type="text"
                    value={newFolder}
                    onChange={(e) => {
                      setNewFolder(e.target.value);
                      setFormData({ ...formData, folder: '' });
                    }}
                    placeholder={folders.length > 0 ? "Or create new folder" : "Create folder"}
                    className={`${folders.length > 0 ? 'w-40' : 'flex-1'} bg-twitch-gray border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple text-sm`}
                  />
                </div>
              </div>

              {/* Discord Channel Info (when creating via OAuth) */}
              {isDiscordCreate && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-blue-400 text-sm">
                    <Hash className="w-4 h-4" />
                    <span>Creating webhook in: <strong>{discordGuild.name}</strong> → #{discordChannel.name}</span>
                  </div>
                </div>
              )}

              {/* Discord Channel Info (when creating via Discord) */}
              {isDiscordCreate && (
                <div className="p-3 bg-[#5865F2]/10 border border-[#5865F2]/30 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                    <Server className="w-4 h-4 text-[#5865F2]" />
                    <span className="font-medium">Creating webhook via Discord</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      {discordGuild?.icon ? (
                        <img 
                          src={`https://cdn.discordapp.com/icons/${discordGuild.id}/${discordGuild.icon}.png?size=32`}
                          alt={discordGuild.name}
                          className="w-5 h-5 rounded-full"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-[#5865F2] flex items-center justify-center text-xs text-white">
                          {discordGuild?.name?.charAt(0) || 'S'}
                        </div>
                      )}
                      <span className="text-white">{discordGuild?.name}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-400">
                      <Hash className="w-4 h-4" />
                      <span>{discordChannel?.name}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Webhook URL */}
              {!isEditing && !hideWebhookUrl && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Discord Webhook URL</label>
                  
                  {savedUrls.length > 0 && (
                    <select
                      onChange={(e) => handleSelectSavedUrl(e.target.value)}
                      className="w-full bg-twitch-gray border border-gray-600 rounded-lg px-3 py-2 text-gray-400 focus:outline-none focus:border-twitch-purple text-sm mb-2"
                      defaultValue=""
                    >
                      <option value="" disabled>Select from saved URLs...</option>
                      {savedUrls.map(url => (
                        <option key={url.id} value={url.id}>
                          {url.name} ({url.webhook_url_masked})
                        </option>
                      ))}
                    </select>
                  )}
                  
                  <input
                    type="url"
                    value={formData.webhookUrl}
                    onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                    placeholder="https://discord.com/api/webhooks/..."
                    className="w-full bg-twitch-gray border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple font-mono text-sm"
                    required
                  />
                  
                  {formData.webhookUrl && (
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveUrlToBank}
                        onChange={(e) => setSaveUrlToBank(e.target.checked)}
                        className="rounded bg-twitch-gray border-gray-600 text-twitch-purple focus:ring-twitch-purple"
                      />
                      <span className="text-xs text-gray-400">Save URL to bank for reuse</span>
                    </label>
                  )}
                  {saveUrlToBank && (
                    <input
                      type="text"
                      value={savedUrlName}
                      onChange={(e) => setSavedUrlName(e.target.value)}
                      placeholder="Name for this URL"
                      className="w-full mt-2 bg-twitch-gray border border-gray-600 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple"
                    />
                  )}
                </div>
              )}

              {/* Webhook Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Webhook Type</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(WEBHOOK_TYPES).map(([key, config]) => {
                    const Icon = config.icon;
                    const isSelected = formData.webhookType === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={isEditing}
                        onClick={() => setFormData({ ...formData, webhookType: key })}
                        className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                          isSelected
                            ? 'border-twitch-purple bg-twitch-purple/10'
                            : 'border-gray-600 hover:border-gray-500 bg-twitch-gray'
                        } ${isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <div className={`p-2 rounded-lg ${config.bgColor}`}>
                          <Icon className={`w-4 h-4 ${config.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white">{config.label}</p>
                          <p className="text-xs text-gray-500 truncate">{config.description}</p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-twitch-purple" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Section: Configuration based on type */}
            <div className="border-t border-gray-700 pt-4 space-y-4">
              <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Configuration
              </h3>
              
              {formData.webhookType === 'tracked_user_message' && (
                <UserAutocomplete
                  selectedUsers={trackedUsers}
                  onAdd={(user) => setTrackedUsers([...trackedUsers, user])}
                  onRemove={(user) => setTrackedUsers(trackedUsers.filter(u => u !== user))}
                  maxUsers={maxTrackedUsernames}
                />
              )}

              {formData.webhookType === 'mod_action' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Action Types</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {MOD_ACTION_TYPES.map(({ value, label, description }) => {
                        const isSelected = actionTypes.includes(value);
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setActionTypes(prev =>
                                isSelected ? prev.filter(t => t !== value) : [...prev, value]
                              );
                            }}
                            className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                              isSelected
                                ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400'
                                : 'border-gray-600 hover:border-gray-500 text-gray-300'
                            }`}
                          >
                            <Shield className="w-4 h-4 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{label}</p>
                            </div>
                            {isSelected && <Check className="w-3 h-3 ml-auto" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  <ChannelPicker
                    selectedChannels={selectedChannels}
                    onToggle={handleToggleChannel}
                    allChannels={allChannels}
                    setAllChannels={setAllChannels}
                  />
                </div>
              )}

              {['channel_live', 'channel_offline', 'channel_game_change'].includes(formData.webhookType) && (
                <ChannelPicker
                  selectedChannels={selectedChannels}
                  onToggle={handleToggleChannel}
                  allChannels={allChannels}
                  setAllChannels={setAllChannels}
                />
              )}

              {/* Bits webhook config */}
              {formData.webhookType === 'channel_bits' && (
                <div className="space-y-4">
                  <ChannelPicker
                    selectedChannels={selectedChannels}
                    onToggle={handleToggleChannel}
                    allChannels={allChannels}
                    setAllChannels={setAllChannels}
                  />
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Minimum Bits (0 = all)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={minBits}
                      onChange={(e) => setMinBits(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g., 100 to only trigger on 100+ bits"
                    />
                    <p className="mt-1 text-xs text-gray-500">Only trigger when someone cheers at least this many bits</p>
                  </div>
                </div>
              )}

              {/* Subscription webhook config */}
              {formData.webhookType === 'channel_subscription' && (
                <div className="space-y-4">
                  <ChannelPicker
                    selectedChannels={selectedChannels}
                    onToggle={handleToggleChannel}
                    allChannels={allChannels}
                    setAllChannels={setAllChannels}
                  />
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Sub Types</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'sub', label: 'New Sub' },
                        { value: 'resub', label: 'Resub' },
                        { value: 'prime', label: 'Prime' },
                      ].map(({ value, label }) => {
                        const isSelected = subTypes.includes(value);
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setSubTypes(prev =>
                                isSelected ? prev.filter(t => t !== value) : [...prev, value]
                              );
                            }}
                            className={`flex items-center gap-2 p-2 rounded-lg border text-sm transition-all ${
                              isSelected
                                ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400'
                                : 'border-gray-600 hover:border-gray-500 text-gray-300'
                            }`}
                          >
                            <Star className="w-4 h-4" />
                            <span>{label}</span>
                            {isSelected && <Check className="w-3 h-3 ml-auto" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Minimum Months (0 = all)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={minMonths}
                      onChange={(e) => setMinMonths(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g., 12 for 1+ year subs only"
                    />
                    <p className="mt-1 text-xs text-gray-500">Only trigger for resubs with at least this many cumulative months</p>
                  </div>
                </div>
              )}

              {/* Gift sub webhook config */}
              {formData.webhookType === 'channel_gift_sub' && (
                <div className="space-y-4">
                  <ChannelPicker
                    selectedChannels={selectedChannels}
                    onToggle={handleToggleChannel}
                    allChannels={allChannels}
                    setAllChannels={setAllChannels}
                  />
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Minimum Gift Count (1 = all)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={minGiftCount}
                      onChange={(e) => setMinGiftCount(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g., 5 to only trigger on 5+ gifted subs"
                    />
                    <p className="mt-1 text-xs text-gray-500">Only trigger when someone gifts at least this many subs at once</p>
                  </div>
                </div>
              )}

              {/* Raid webhook config */}
              {formData.webhookType === 'channel_raid' && (
                <div className="space-y-4">
                  <ChannelPicker
                    selectedChannels={selectedChannels}
                    onToggle={handleToggleChannel}
                    allChannels={allChannels}
                    setAllChannels={setAllChannels}
                  />
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Minimum Viewers (0 = all)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={minViewers}
                      onChange={(e) => setMinViewers(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g., 50 to only trigger on raids with 50+ viewers"
                    />
                    <p className="mt-1 text-xs text-gray-500">Only trigger for raids with at least this many viewers</p>
                  </div>
                </div>
              )}
            </div>

            {/* Section: Customization */}
            <div className="border-t border-gray-700 pt-4">
              <EmbedCustomization formData={formData} setFormData={setFormData} />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex justify-end gap-3 bg-twitch-dark">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || externalSaving}
            className="px-6 py-2 bg-twitch-purple hover:bg-twitch-purple-dark disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {(saving || externalSaving) && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEditing ? 'Save Changes' : 'Create Webhook'}
          </button>
        </div>
      </div>
    </div>
  );
}
