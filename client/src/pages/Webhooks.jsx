import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { webhooksApi, channelsApi } from '../services/api';
import { useToastStore } from '../stores/toastStore';
import {
  Webhook,
  Plus,
  Trash2,
  Edit2,
  Play,
  Pause,
  TestTube,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  X,
  AlertCircle,
  CheckCircle,
  Bell,
  Shield,
  Radio,
  User,
  MessageSquare,
  Loader2,
  ExternalLink,
  Settings,
  Copy,
  Link as LinkIcon,
  Save,
  Bookmark,
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
};

// Preset colors
const PRESET_COLORS = [
  '#5865F2', // Discord Blurple
  '#57F287', // Green
  '#FEE75C', // Yellow
  '#EB459E', // Fuchsia
  '#ED4245', // Red
  '#9146FF', // Twitch Purple
  '#00D4FF', // Cyan
  '#FF6B35', // Orange
];

// Webhook card component
function WebhookCard({ webhook, onEdit, onDelete, onTest, onToggle }) {
  const [testing, setTesting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const typeConfig = WEBHOOK_TYPES[webhook.webhook_type] || {};
  const Icon = typeConfig.icon || Webhook;

  const handleTest = async () => {
    setTesting(true);
    await onTest(webhook.id);
    setTesting(false);
  };

  const formatConfig = () => {
    const config = webhook.config || {};
    const parts = [];
    
    if (config.tracked_usernames?.length) {
      parts.push(`${config.tracked_usernames.length} tracked user${config.tracked_usernames.length > 1 ? 's' : ''}`);
    }
    if (config.action_types?.length) {
      parts.push(`${config.action_types.join(', ')}`);
    }
    if (config.channels?.length) {
      parts.push(`${config.channels.length} channel${config.channels.length > 1 ? 's' : ''}`);
    } else if (webhook.webhook_type !== 'tracked_user_message') {
      parts.push('All channels');
    }
    
    return parts.join(' • ') || 'No configuration';
  };

  return (
    <div className={`bg-twitch-gray rounded-lg border ${webhook.enabled ? 'border-gray-700' : 'border-gray-800 opacity-60'}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`p-2 rounded-lg ${typeConfig.bgColor}`}>
              <Icon className={`w-5 h-5 ${typeConfig.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white truncate">{webhook.name}</h3>
                {webhook.consecutive_failures > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400" title={webhook.last_error}>
                    {webhook.consecutive_failures} failures
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400">{typeConfig.label}</p>
              <p className="text-xs text-gray-500 mt-1">{formatConfig()}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleTest}
              disabled={testing || !webhook.enabled}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Test webhook"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
            </button>
            <button
              onClick={() => onToggle(webhook)}
              className={`p-2 rounded-lg transition-colors ${
                webhook.enabled 
                  ? 'text-green-400 hover:bg-green-500/20' 
                  : 'text-gray-500 hover:bg-gray-700'
              }`}
              title={webhook.enabled ? 'Disable' : 'Enable'}
            >
              {webhook.enabled ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button
              onClick={() => onEdit(webhook)}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(webhook)}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Expandable details */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-400 mt-3"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? 'Hide details' : 'Show details'}
        </button>
        
        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-700 space-y-2 text-xs text-gray-400">
            <div className="flex justify-between">
              <span>URL:</span>
              <span className="font-mono">{webhook.webhook_url_masked}</span>
            </div>
            <div className="flex justify-between">
              <span>Triggers:</span>
              <span>{webhook.trigger_count || 0}</span>
            </div>
            {webhook.last_triggered_at && (
              <div className="flex justify-between">
                <span>Last triggered:</span>
                <span>{new Date(webhook.last_triggered_at).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span>Embed color:</span>
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: webhook.embed_color || '#5865F2' }}
                />
                <span>{webhook.embed_color || '#5865F2'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Create/Edit webhook modal
function WebhookModal({ webhook, onClose, onSave, savedUrls = [], onRefreshUrls, maxTrackedUsernames = 50 }) {
  const [formData, setFormData] = useState({
    name: webhook?.name || '',
    webhookUrl: '',
    webhookType: webhook?.webhook_type || 'tracked_user_message',
    config: webhook?.config || {},
    embedColor: webhook?.embed_color || '#5865F2',
    customUsername: webhook?.custom_username || '',
    customAvatarUrl: webhook?.custom_avatar_url || '',
    includeTimestamp: webhook?.include_timestamp ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [trackedUsersInput, setTrackedUsersInput] = useState(
    (webhook?.config?.tracked_usernames || []).join(', ')
  );
  const [channelsInput, setChannelsInput] = useState(
    (webhook?.config?.channels || []).join(', ')
  );
  const [actionTypes, setActionTypes] = useState(
    webhook?.config?.action_types || ['ban', 'timeout']
  );
  const [allChannels, setAllChannels] = useState(!webhook?.config?.channels?.length);
  const [saveUrlToBank, setSaveUrlToBank] = useState(false);
  const [savedUrlName, setSavedUrlName] = useState('');
  const [availableChannels, setAvailableChannels] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState(webhook?.config?.channels || []);
  const addToast = useToastStore(state => state.addToast);

  const isEditing = !!webhook;

  // Fetch available channels when allChannels is unchecked
  useEffect(() => {
    if (!allChannels && availableChannels.length === 0) {
      setLoadingChannels(true);
      channelsApi.getAll({ active: true })
        .then(res => {
          setAvailableChannels(res.data.channels || res.data || []);
        })
        .catch(() => {
          // Silently fail, user can still type manually
        })
        .finally(() => setLoadingChannels(false));
    }
  }, [allChannels]);

  // Keep channelsInput in sync with selectedChannels
  useEffect(() => {
    setChannelsInput(selectedChannels.join(', '));
  }, [selectedChannels]);

  const handleToggleChannel = (channelName) => {
    setSelectedChannels(prev => {
      if (prev.includes(channelName)) {
        return prev.filter(c => c !== channelName);
      } else {
        return [...prev, channelName];
      }
    });
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
        const usernames = trackedUsersInput
          .split(/[,\n]/)
          .map(u => u.trim().toLowerCase())
          .filter(u => u);
        if (usernames.length === 0) {
          throw new Error('At least one tracked username is required');
        }
        config.tracked_usernames = usernames;
      } else if (formData.webhookType === 'mod_action') {
        config.action_types = actionTypes;
        if (!allChannels && selectedChannels.length > 0) {
          config.channels = selectedChannels;
        }
      } else {
        // Channel events
        if (!allChannels && selectedChannels.length > 0) {
          config.channels = selectedChannels;
        }
      }

      const data = {
        name: formData.name,
        webhookType: formData.webhookType,
        config,
        embedColor: formData.embedColor,
        customUsername: formData.customUsername || null,
        customAvatarUrl: formData.customAvatarUrl || null,
        includeTimestamp: formData.includeTimestamp,
      };

      // Only include URL if creating or if it's been changed
      if (!isEditing && formData.webhookUrl) {
        data.webhookUrl = formData.webhookUrl;
        
        // Save URL to bank if requested
        if (saveUrlToBank && savedUrlName.trim()) {
          try {
            await webhooksApi.saveUrl({ name: savedUrlName, webhookUrl: formData.webhookUrl });
            onRefreshUrls?.();
          } catch (urlError) {
            // Non-blocking, just notify
            addToast('URL saved but could not add to bank', 'warning');
          }
        }
      } else if (!isEditing) {
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-twitch-dark rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            {isEditing ? 'Edit Webhook' : 'Create Webhook'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My Webhook"
              className="w-full bg-twitch-gray border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple"
              required
            />
          </div>

          {/* Webhook URL */}
          {!isEditing && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Discord Webhook URL</label>
              
              {/* Saved URLs dropdown */}
              {savedUrls.length > 0 && (
                <div className="mb-2">
                  <select
                    onChange={(e) => handleSelectSavedUrl(e.target.value)}
                    className="w-full bg-twitch-gray border border-gray-600 rounded-lg px-3 py-2 text-gray-400 focus:outline-none focus:border-twitch-purple text-sm"
                    defaultValue=""
                  >
                    <option value="" disabled>Select from saved URLs...</option>
                    {savedUrls.map(url => (
                      <option key={url.id} value={url.id}>
                        {url.name} ({url.webhook_url_masked})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <input
                type="url"
                value={formData.webhookUrl}
                onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                placeholder="https://discord.com/api/webhooks/..."
                className="w-full bg-twitch-gray border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple font-mono text-sm"
                required
              />
              
              {/* Save to bank option */}
              {formData.webhookUrl && !savedUrls.find(u => u.webhook_url === formData.webhookUrl) && (
                <div className="mt-2 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveUrlToBank}
                      onChange={(e) => setSaveUrlToBank(e.target.checked)}
                      className="rounded bg-twitch-gray border-gray-600 text-twitch-purple focus:ring-twitch-purple"
                    />
                    <span className="text-xs text-gray-400">Save URL to my bank for reuse</span>
                  </label>
                  {saveUrlToBank && (
                    <input
                      type="text"
                      value={savedUrlName}
                      onChange={(e) => setSavedUrlName(e.target.value)}
                      placeholder="Name for this URL (e.g., 'Mod Alerts Channel')"
                      className="w-full bg-twitch-gray border border-gray-600 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple"
                    />
                  )}
                </div>
              )}
              
              <p className="text-xs text-gray-500 mt-1">
                Webhook URL cannot be changed after creation for security
              </p>
            </div>
          )}

          {/* Webhook Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
            <select
              value={formData.webhookType}
              onChange={(e) => setFormData({ ...formData, webhookType: e.target.value })}
              disabled={isEditing}
              className="w-full bg-twitch-gray border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-twitch-purple disabled:opacity-60"
            >
              {Object.entries(WEBHOOK_TYPES).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>

          {/* Type-specific configuration */}
          {formData.webhookType === 'tracked_user_message' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Tracked Usernames
              </label>
              <textarea
                value={trackedUsersInput}
                onChange={(e) => setTrackedUsersInput(e.target.value)}
                placeholder="user1, user2, user3"
                rows={3}
                className="w-full bg-twitch-gray border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Separate usernames with commas or new lines (max {maxTrackedUsernames})
              </p>
            </div>
          )}

          {formData.webhookType === 'mod_action' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Action Types</label>
                <div className="flex flex-wrap gap-2">
                  {['ban', 'timeout', 'delete', 'unban', 'untimeout'].map(type => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={actionTypes.includes(type)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setActionTypes([...actionTypes, type]);
                          } else {
                            setActionTypes(actionTypes.filter(t => t !== type));
                          }
                        }}
                        className="rounded bg-twitch-gray border-gray-600 text-twitch-purple focus:ring-twitch-purple"
                      />
                      <span className="text-sm text-gray-300 capitalize">{type}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {formData.webhookType !== 'tracked_user_message' && (
            <div>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={allChannels}
                  onChange={(e) => setAllChannels(e.target.checked)}
                  className="rounded bg-twitch-gray border-gray-600 text-twitch-purple focus:ring-twitch-purple"
                />
                <span className="text-sm text-gray-300">All tracked channels</span>
              </label>
              
              {!allChannels && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Specific Channels</label>
                  
                  {/* Channel picker */}
                  {loadingChannels ? (
                    <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading channels...
                    </div>
                  ) : availableChannels.length > 0 ? (
                    <div className="space-y-2">
                      {/* Selected channels pills */}
                      {selectedChannels.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {selectedChannels.map(channel => (
                            <span 
                              key={channel}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-twitch-purple/20 text-twitch-purple rounded text-xs"
                            >
                              {channel}
                              <button
                                type="button"
                                onClick={() => handleToggleChannel(channel)}
                                className="hover:text-white"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {/* Channel dropdown */}
                      <div className="max-h-32 overflow-y-auto bg-twitch-gray border border-gray-600 rounded-lg p-2">
                        <div className="grid grid-cols-2 gap-1">
                          {availableChannels.map(channel => {
                            const name = channel.name || channel.channel_name || channel;
                            const isSelected = selectedChannels.includes(name);
                            return (
                              <label 
                                key={name}
                                className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors ${
                                  isSelected ? 'bg-twitch-purple/20' : 'hover:bg-gray-700'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleChannel(name)}
                                  className="rounded bg-twitch-gray border-gray-600 text-twitch-purple focus:ring-twitch-purple"
                                />
                                <span className="text-sm text-gray-300 truncate">{name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">
                        {selectedChannels.length} channel{selectedChannels.length !== 1 ? 's' : ''} selected
                      </p>
                    </div>
                  ) : (
                    /* Fallback to textarea if no channels loaded */
                    <textarea
                      value={channelsInput}
                      onChange={(e) => {
                        setChannelsInput(e.target.value);
                        // Also update selectedChannels for consistency
                        const channels = e.target.value.split(/[,\n]/).map(c => c.trim().toLowerCase()).filter(c => c);
                        setSelectedChannels(channels);
                      }}
                      placeholder="channel1, channel2"
                      rows={2}
                      className="w-full bg-twitch-gray border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple font-mono text-sm"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Customization section */}
          <div className="border-t border-gray-700 pt-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Customization</h3>
            
            {/* Embed Color */}
            <div className="mb-3">
              <label className="block text-xs text-gray-400 mb-1">Embed Color</label>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, embedColor: color })}
                      className={`w-6 h-6 rounded transition-transform ${
                        formData.embedColor === color ? 'ring-2 ring-white scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={formData.embedColor}
                  onChange={(e) => setFormData({ ...formData, embedColor: e.target.value })}
                  className="w-8 h-6 rounded cursor-pointer"
                />
              </div>
            </div>

            {/* Custom Username */}
            <div className="mb-3">
              <label className="block text-xs text-gray-400 mb-1">Custom Bot Name (optional)</label>
              <input
                type="text"
                value={formData.customUsername}
                onChange={(e) => setFormData({ ...formData, customUsername: e.target.value })}
                placeholder="Chatterbox"
                maxLength={80}
                className="w-full bg-twitch-gray border border-gray-600 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple"
              />
            </div>

            {/* Include Timestamp */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.includeTimestamp}
                onChange={(e) => setFormData({ ...formData, includeTimestamp: e.target.checked })}
                className="rounded bg-twitch-gray border-gray-600 text-twitch-purple focus:ring-twitch-purple"
              />
              <span className="text-sm text-gray-300">Include timestamp in embed</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-twitch-purple hover:bg-twitch-purple-dark disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Webhook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Saved URLs management section
function SavedUrlsSection({ urls, onRefresh, maxUrls = 20 }) {
  const [expanded, setExpanded] = useState(false);
  const [newUrlName, setNewUrlName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const addToast = useToastStore(state => state.addToast);

  const handleAdd = async () => {
    if (!newUrlName.trim() || !newUrl.trim()) return;
    
    // Validate Discord webhook URL
    const isValid = /^https:\/\/(discord\.com|discordapp\.com|canary\.discord\.com|ptb\.discord\.com)\/api\/webhooks\/\d+\/[\w-]+$/.test(newUrl);
    if (!isValid) {
      addToast('Invalid Discord webhook URL', 'error');
      return;
    }
    
    setAdding(true);
    try {
      await webhooksApi.saveUrl({ name: newUrlName, webhookUrl: newUrl });
      setNewUrlName('');
      setNewUrl('');
      onRefresh();
      addToast('URL saved', 'success');
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to save URL', 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleUpdate = async (id) => {
    if (!editName.trim()) return;
    
    try {
      await webhooksApi.updateSavedUrl(id, { name: editName });
      setEditingId(null);
      onRefresh();
      addToast('URL updated', 'success');
    } catch (error) {
      addToast('Failed to update URL', 'error');
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete saved URL "${name}"?`)) return;
    
    try {
      await webhooksApi.deleteSavedUrl(id);
      onRefresh();
      addToast('URL deleted', 'success');
    } catch (error) {
      addToast('Failed to delete URL', 'error');
    }
  };

  return (
    <div className="bg-twitch-gray rounded-lg border border-gray-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <Bookmark className="w-5 h-5 text-yellow-400" />
          <div>
            <span className="font-medium text-white">Saved Webhook URLs</span>
            <span className="text-gray-500 text-sm ml-2">({urls.length}/{maxUrls})</span>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>
      
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-700 pt-4">
          <p className="text-xs text-gray-400">
            Save webhook URLs to quickly reuse them when creating new webhooks.
          </p>
          
          {/* Add new URL */}
          <div className="bg-twitch-dark p-3 rounded-lg space-y-2">
            <input
              type="text"
              value={newUrlName}
              onChange={(e) => setNewUrlName(e.target.value)}
              placeholder="Name (e.g., 'Mod Alerts')"
              className="w-full bg-twitch-gray border border-gray-600 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple"
            />
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full bg-twitch-gray border border-gray-600 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple font-mono"
            />
            <button
              onClick={handleAdd}
              disabled={adding || !newUrlName.trim() || !newUrl.trim()}
              className="flex items-center gap-2 px-3 py-1.5 bg-twitch-purple hover:bg-twitch-purple-dark disabled:bg-gray-600 text-white text-sm rounded transition-colors"
            >
              {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Add URL
            </button>
          </div>
          
          {/* Saved URLs list */}
          {urls.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No saved URLs yet</p>
          ) : (
            <div className="space-y-2">
              {urls.map(url => (
                <div key={url.id} className="flex items-center justify-between bg-twitch-dark p-2 rounded-lg">
                  {editingId === url.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 bg-twitch-gray border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-twitch-purple"
                        autoFocus
                      />
                      <button
                        onClick={() => handleUpdate(url.id)}
                        className="p-1 text-green-400 hover:bg-green-500/20 rounded"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1 text-gray-400 hover:bg-gray-700 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{url.name}</p>
                        <p className="text-xs text-gray-500 font-mono">{url.webhook_url_masked}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditingId(url.id); setEditName(url.name); }}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
                          title="Rename"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(url.id, url.name)}
                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Help section
function HelpSection() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-twitch-gray rounded-lg border border-gray-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <HelpCircle className="w-5 h-5 text-twitch-purple" />
          <span className="font-medium text-white">How to Create a Discord Webhook</span>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>
      
      {expanded && (
        <div className="px-4 pb-4 space-y-3 text-sm text-gray-300">
          <div className="border-t border-gray-700 pt-4">
            <ol className="list-decimal list-inside space-y-2">
              <li>Open Discord and go to the channel where you want to receive notifications</li>
              <li>Click the <strong>gear icon</strong> (⚙️) next to the channel name to open Channel Settings</li>
              <li>Select <strong>"Integrations"</strong> from the left sidebar</li>
              <li>Click <strong>"Webhooks"</strong>, then <strong>"New Webhook"</strong></li>
              <li>Give your webhook a name (e.g., "Chatterbox Alerts")</li>
              <li>Click <strong>"Copy Webhook URL"</strong></li>
              <li>Paste the URL here when creating your webhook</li>
            </ol>
          </div>
          
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mt-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-blue-400">Security Note</p>
                <p className="text-gray-400 text-xs mt-1">
                  Keep your webhook URL secret! Anyone with the URL can send messages to your channel.
                  For security, you cannot change the webhook URL after creation.
                </p>
              </div>
            </div>
          </div>

          <a
            href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-twitch-purple hover:underline mt-2"
          >
            Discord's Official Guide <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}

// Main Webhooks page
export default function Webhooks() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const addToast = useToastStore(state => state.addToast);
  
  const [webhooks, setWebhooks] = useState([]);
  const [savedUrls, setSavedUrls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState(null);
  const [limits, setLimits] = useState({
    maxPerUser: 10,
    maxUrlsPerUser: 20,
    maxTrackedUsernames: 50,
  });

  const fetchWebhooks = async () => {
    try {
      const response = await webhooksApi.getAll();
      setWebhooks(response.data.webhooks || []);
      if (response.data.limits) {
        setLimits(prev => ({ ...prev, ...response.data.limits }));
      }
    } catch (error) {
      addToast('Failed to load webhooks', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedUrls = async () => {
    try {
      const response = await webhooksApi.getSavedUrls();
      setSavedUrls(response.data.urls || []);
      if (response.data.limits) {
        setLimits(prev => ({ ...prev, ...response.data.limits }));
      }
    } catch (error) {
      // Silent fail for URLs - not critical
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchWebhooks();
      fetchSavedUrls();
    }
  }, [isAuthenticated]);

  const handleCreate = () => {
    setEditingWebhook(null);
    setModalOpen(true);
  };

  const handleEdit = (webhook) => {
    setEditingWebhook(webhook);
    setModalOpen(true);
  };

  const handleSave = async (data, id) => {
    if (id) {
      // Update
      await webhooksApi.update(id, data);
      addToast('Webhook updated', 'success');
    } else {
      // Create
      await webhooksApi.create(data);
      addToast('Webhook created', 'success');
    }
    fetchWebhooks();
  };

  const handleDelete = async (webhook) => {
    if (!confirm(`Delete webhook "${webhook.name}"?`)) return;
    
    try {
      await webhooksApi.delete(webhook.id);
      setWebhooks(webhooks.filter(w => w.id !== webhook.id));
      addToast('Webhook deleted', 'success');
    } catch (error) {
      addToast('Failed to delete webhook', 'error');
    }
  };

  const handleTest = async (id) => {
    try {
      await webhooksApi.test(id);
      addToast('Test message sent!', 'success');
    } catch (error) {
      addToast(error.response?.data?.error || 'Test failed', 'error');
    }
  };

  const handleToggle = async (webhook) => {
    try {
      await webhooksApi.update(webhook.id, { enabled: !webhook.enabled });
      setWebhooks(webhooks.map(w => 
        w.id === webhook.id ? { ...w, enabled: !w.enabled } : w
      ));
      addToast(`Webhook ${webhook.enabled ? 'disabled' : 'enabled'}`, 'success');
    } catch (error) {
      addToast('Failed to update webhook', 'error');
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-twitch-purple" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-twitch-gray rounded-xl p-8 text-center">
          <Webhook className="w-12 h-12 text-twitch-purple mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Discord Webhooks</h2>
          <p className="text-gray-400 mb-6">
            Sign in to set up Discord notifications for messages, moderation actions, and stream events.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-twitch-purple hover:bg-twitch-purple-dark text-white rounded-lg transition-colors"
          >
            Sign In to Continue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Webhook className="w-7 h-7 text-twitch-purple" />
            Discord Webhooks
          </h1>
          <p className="text-gray-400 mt-1">
            Get Discord notifications for messages, mod actions, and stream events
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={webhooks.length >= limits.maxPerUser}
          className="flex items-center gap-2 px-4 py-2 bg-twitch-purple hover:bg-twitch-purple-dark disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Webhook
        </button>
      </div>

      {/* Help section */}
      <HelpSection />

      {/* Saved URLs section */}
      <SavedUrlsSection urls={savedUrls} onRefresh={fetchSavedUrls} maxUrls={limits.maxUrlsPerUser} />

      {/* Webhooks list */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-twitch-purple" />
        </div>
      ) : webhooks.length === 0 ? (
        <div className="bg-twitch-gray rounded-xl p-8 text-center">
          <Bell className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-white mb-1">No Webhooks Yet</h3>
          <p className="text-gray-400 mb-4">
            Create your first webhook to start receiving Discord notifications
          </p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-twitch-purple hover:bg-twitch-purple-dark text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Webhook
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>{webhooks.length} webhook{webhooks.length !== 1 ? 's' : ''}</span>
            <span>{limits.maxPerUser - webhooks.length} remaining</span>
          </div>
          {webhooks.map(webhook => (
            <WebhookCard
              key={webhook.id}
              webhook={webhook}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onTest={handleTest}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <WebhookModal
          webhook={editingWebhook}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          savedUrls={savedUrls}
          onRefreshUrls={fetchSavedUrls}
          maxTrackedUsernames={limits.maxTrackedUsernames}
        />
      )}
    </div>
  );
}
