import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import useDiscord from '../hooks/useDiscord';
import { webhooksApi } from '../services/api';
import { useToastStore } from '../stores/toastStore';
import WebhookModal from '../components/common/WebhookModal';
import DiscordIntegrationCard from '../components/common/DiscordIntegrationCard';
import DiscordChannelSelector from '../components/common/DiscordChannelSelector';
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
  MessageSquare,
  Loader2,
  ExternalLink,
  Bookmark,
  Server,
  Hash,
  Copy,
  VolumeX,
  Volume2,
  Folder,
  FolderOpen,
  RotateCcw,
  Clock,
  Filter,
  Gem,
  Gift,
  Star,
  Zap,
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

// Helper to format relative time
const formatRelativeTime = (timestamp) => {
  if (!timestamp) return null;
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
};

// Webhook card component
function WebhookCard({ webhook, onEdit, onDelete, onTest, onToggle, onMute, onDuplicate, onResetCount }) {
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
    } else if (!['tracked_user_message'].includes(webhook.webhook_type)) {
      parts.push('All channels');
    }
    
    // Monetization webhook thresholds
    if (config.min_bits) {
      parts.push(`≥${config.min_bits.toLocaleString()} bits`);
    }
    if (config.min_gift_count) {
      parts.push(`≥${config.min_gift_count} gifts`);
    }
    if (config.min_viewers) {
      parts.push(`≥${config.min_viewers} viewers`);
    }
    if (config.min_months) {
      parts.push(`≥${config.min_months} months`);
    }
    if (config.sub_types?.length) {
      parts.push(config.sub_types.join(', '));
    }
    
    return parts.join(' • ') || 'No configuration';
  };

  const lastTriggered = formatRelativeTime(webhook.last_triggered_at);

  return (
    <div className={`bg-twitch-gray rounded-lg border ${
      !webhook.enabled ? 'border-gray-800 opacity-60' : 
      webhook.muted ? 'border-yellow-600/50' : 'border-gray-700'
    }`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`p-2 rounded-lg ${typeConfig.bgColor}`}>
              <Icon className={`w-5 h-5 ${typeConfig.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-white truncate">{webhook.name}</h3>
                {webhook.muted && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 flex items-center gap-1">
                    <VolumeX className="w-3 h-3" />
                    Muted
                  </span>
                )}
                {webhook.folder && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-600 text-gray-300 flex items-center gap-1">
                    <Folder className="w-3 h-3" />
                    {webhook.folder}
                  </span>
                )}
                {webhook.consecutive_failures > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400" title={webhook.last_error}>
                    {webhook.consecutive_failures} failures
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400">{typeConfig.label}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                <span>{formatConfig()}</span>
                {lastTriggered && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {lastTriggered}
                  </span>
                )}
                {webhook.trigger_count > 0 && (
                  <span>{webhook.trigger_count} triggers</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleTest}
              disabled={testing || !webhook.enabled || webhook.muted}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Test webhook"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
            </button>
            <button
              onClick={() => onMute(webhook)}
              className={`p-2 rounded-lg transition-colors ${
                webhook.muted 
                  ? 'text-yellow-400 hover:bg-yellow-500/20' 
                  : 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10'
              }`}
              title={webhook.muted ? 'Unmute' : 'Mute'}
            >
              {webhook.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
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
              onClick={() => onDuplicate(webhook)}
              className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
              title="Duplicate"
            >
              <Copy className="w-4 h-4" />
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
            {/* Discord info for OAuth-created webhooks */}
            {webhook.created_via_oauth && webhook.discord_guild_name && (
              <div className="flex items-center gap-2 text-blue-400 mb-2">
                <Server className="w-3 h-3" />
                <span>{webhook.discord_guild_name}</span>
                <Hash className="w-3 h-3 ml-1" />
                <span>{webhook.discord_channel_name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>URL:</span>
              <span className="font-mono">{webhook.webhook_url_masked}</span>
            </div>
            {webhook.created_via_oauth && (
              <div className="flex justify-between">
                <span>Created via:</span>
                <span className="text-green-400">Discord OAuth</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span>Triggers:</span>
              <div className="flex items-center gap-2">
                <span>{webhook.trigger_count || 0}</span>
                {webhook.trigger_count > 0 && (
                  <button
                    onClick={() => onResetCount(webhook.id)}
                    className="text-gray-500 hover:text-white p-0.5 rounded"
                    title="Reset count"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>
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

// Discord Bot Setup Section
function DiscordBotSetup() {
  const [expanded, setExpanded] = useState(false);
  const botInviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${import.meta.env.VITE_DISCORD_CLIENT_ID || '1446950478712799373'}&permissions=536870912&scope=bot`;

  return (
    <div className="bg-[#5865F2]/10 border border-[#5865F2]/30 rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <Server className="w-5 h-5 text-[#5865F2]" />
          <span className="font-medium text-white">Discord Bot Setup (Required for Auto-Create)</span>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>
      
      {expanded && (
        <div className="px-4 pb-4 space-y-3 text-sm text-gray-300">
          <div className="border-t border-[#5865F2]/30 pt-4">
            <p className="mb-3">
              To use the <strong>"Auto-fill from Discord"</strong> feature, the Chatterbox bot must be added to your Discord server.
              The bot needs the <strong>Manage Webhooks</strong> permission to create webhooks in your channels.
            </p>
            
            <ol className="list-decimal list-inside space-y-2">
              <li>Click the <strong>"Add Bot to Server"</strong> button below</li>
              <li>Select the Discord server you want to add the bot to</li>
              <li>Make sure the <strong>"Manage Webhooks"</strong> permission is enabled</li>
              <li>Click <strong>"Authorize"</strong></li>
              <li>Come back here and connect your Discord account</li>
              <li>Your server will now appear in the server selection!</li>
            </ol>
            
            <a
              href={botInviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg transition-colors"
            >
              <Server className="w-4 h-4" />
              Add Bot to Server
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mt-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-yellow-400">Bot Not in Server?</p>
                <p className="text-gray-400 text-xs mt-1">
                  If your server doesn't appear in the list after connecting Discord, the bot hasn't been added to that server yet.
                  You need to have <strong>Manage Server</strong> or <strong>Administrator</strong> permissions in the Discord server to add the bot.
                </p>
              </div>
            </div>
          </div>
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
  
  // Discord integration hook
  const discord = useDiscord();
  
  const [webhooks, setWebhooks] = useState([]);
  const [savedUrls, setSavedUrls] = useState([]);
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null); // null = all, '' = uncategorized
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState(null);
  const [showDiscordSelector, setShowDiscordSelector] = useState(false);
  const [creatingDiscordWebhook, setCreatingDiscordWebhook] = useState(false);
  const [pendingWebhookData, setPendingWebhookData] = useState(null);
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

  const fetchFolders = async () => {
    try {
      const response = await webhooksApi.getFolders();
      setFolders(response.data.folders || []);
    } catch (error) {
      // Silent fail
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchWebhooks();
      fetchSavedUrls();
      fetchFolders();
    }
  }, [isAuthenticated]);

  // Filter webhooks by folder
  const filteredWebhooks = useMemo(() => {
    if (selectedFolder === null) return webhooks;
    if (selectedFolder === '') return webhooks.filter(w => !w.folder);
    return webhooks.filter(w => w.folder === selectedFolder);
  }, [webhooks, selectedFolder]);

  // Get unique folders from current webhooks
  const availableFolders = useMemo(() => {
    const folderSet = new Set(webhooks.map(w => w.folder).filter(Boolean));
    return Array.from(folderSet).sort();
  }, [webhooks]);

  const handleCreate = () => {
    setEditingWebhook(null);
    setModalOpen(true);
  };

  // Open Discord channel selector
  const handleCreateViaDiscord = () => {
    setEditingWebhook(null);
    setPendingWebhookData(null);
    setShowDiscordSelector(true);
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
    fetchFolders();
  };

  const handleDelete = async (webhook) => {
    const isDiscordWebhook = webhook.created_via_oauth;
    const message = isDiscordWebhook 
      ? `Delete webhook "${webhook.name}"? This will also remove it from Discord.`
      : `Delete webhook "${webhook.name}"?`;
    
    if (!confirm(message)) return;
    
    try {
      await webhooksApi.delete(webhook.id, isDiscordWebhook);
      setWebhooks(webhooks.filter(w => w.id !== webhook.id));
      addToast('Webhook deleted', 'success');
      fetchFolders();
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

  // Handle Discord channel selection - open modal to configure webhook
  const handleDiscordChannelSelect = async (guild, channel) => {
    // Store selected guild/channel and open modal
    setPendingWebhookData({ guild, channel });
    setShowDiscordSelector(false);
    setModalOpen(true);
  };

  // Handle webhook modal save for Discord webhooks
  const handleDiscordWebhookSave = async (data, id) => {
    if (id) {
      // Editing existing webhook - use normal save
      await handleSave(data, id);
      return;
    }

    // Creating new webhook via Discord
    if (pendingWebhookData?.guild && pendingWebhookData?.channel) {
      setCreatingDiscordWebhook(true);
      try {
        await discord.createWebhook(
          pendingWebhookData.guild.id,
          pendingWebhookData.channel.id,
          data
        );
        setModalOpen(false);
        setPendingWebhookData(null);
        fetchWebhooks();
      } catch (error) {
        addToast(error.message || 'Failed to create webhook', 'error');
      } finally {
        setCreatingDiscordWebhook(false);
      }
    } else {
      // Normal manual creation
      await handleSave(data, id);
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

  const handleMute = async (webhook) => {
    try {
      await webhooksApi.update(webhook.id, { muted: !webhook.muted });
      setWebhooks(webhooks.map(w => 
        w.id === webhook.id ? { ...w, muted: !w.muted } : w
      ));
      addToast(`Webhook ${webhook.muted ? 'unmuted' : 'muted'}`, 'success');
    } catch (error) {
      addToast('Failed to update webhook', 'error');
    }
  };

  const handleDuplicate = async (webhook) => {
    try {
      const response = await webhooksApi.duplicate(webhook.id);
      setWebhooks([response.data.webhook, ...webhooks]);
      addToast('Webhook duplicated', 'success');
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to duplicate webhook', 'error');
    }
  };

  const handleResetCount = async (id) => {
    try {
      await webhooksApi.resetCount(id);
      setWebhooks(webhooks.map(w => 
        w.id === id ? { ...w, trigger_count: 0 } : w
      ));
      addToast('Trigger count reset', 'success');
    } catch (error) {
      addToast('Failed to reset count', 'error');
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
        <div className="flex items-center gap-2">
          {discord.connected && (
            <button
              onClick={handleCreateViaDiscord}
              disabled={limits.maxPerUser !== -1 && webhooks.length >= limits.maxPerUser}
              className="flex items-center gap-2 px-4 py-2 bg-[#5865F2] hover:brightness-110 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-all"
              title="Create webhook directly in Discord"
            >
              <Server className="w-4 h-4" />
              Create via Discord
            </button>
          )}
          <button
            onClick={handleCreate}
            disabled={limits.maxPerUser !== -1 && webhooks.length >= limits.maxPerUser}
            className="flex items-center gap-2 px-4 py-2 bg-twitch-purple hover:bg-twitch-purple-dark disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Webhook
          </button>
        </div>
      </div>

      {/* Discord Integration Card */}
      <DiscordIntegrationCard
        status={discord.status}
        loading={discord.loading}
        onConnect={discord.connect}
        onDisconnect={discord.disconnect}
        onRefresh={discord.refreshGuilds}
        guildsCount={discord.guilds.length}
      />

      {/* Discord Channel Selector */}
      {showDiscordSelector && (
        <DiscordChannelSelector
          guilds={discord.guilds}
          guildsLoading={discord.guildsLoading}
          channels={discord.channels}
          channelsLoading={discord.channelsLoading}
          onFetchChannels={discord.fetchChannels}
          onSelectChannel={handleDiscordChannelSelect}
          onRefreshGuilds={() => discord.fetchGuilds(true)}
          onCancel={() => {
            setShowDiscordSelector(false);
            setPendingWebhookData(null);
          }}
          creating={creatingDiscordWebhook}
        />
      )}

      {/* Help sections */}
      <div className="space-y-3">
        <DiscordBotSetup />
        <HelpSection />
      </div>

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
          <div className="flex items-center justify-center gap-3">
            {discord.connected && (
              <button
                onClick={handleCreateViaDiscord}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#5865F2] hover:brightness-110 text-white rounded-lg transition-all"
              >
                <Server className="w-4 h-4" />
                Create via Discord
              </button>
            )}
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-twitch-purple hover:bg-twitch-purple-dark text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Webhook
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Folder filter */}
          {availableFolders.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-gray-500" />
              <button
                onClick={() => setSelectedFolder(null)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  selectedFolder === null 
                    ? 'bg-twitch-purple text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                All ({webhooks.length})
              </button>
              <button
                onClick={() => setSelectedFolder('')}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  selectedFolder === '' 
                    ? 'bg-twitch-purple text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Uncategorized ({webhooks.filter(w => !w.folder).length})
              </button>
              {availableFolders.map(folder => (
                <button
                  key={folder}
                  onClick={() => setSelectedFolder(folder)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                    selectedFolder === folder 
                      ? 'bg-twitch-purple text-white' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <Folder className="w-3 h-3" />
                  {folder} ({webhooks.filter(w => w.folder === folder).length})
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>
              {filteredWebhooks.length} webhook{filteredWebhooks.length !== 1 ? 's' : ''}
              {selectedFolder !== null && ` in ${selectedFolder || 'uncategorized'}`}
            </span>
            <span>{limits.maxPerUser === -1 ? 'Unlimited' : `${limits.maxPerUser - webhooks.length} remaining`}</span>
          </div>
          {filteredWebhooks.map(webhook => (
            <WebhookCard
              key={webhook.id}
              webhook={webhook}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onTest={handleTest}
              onToggle={handleToggle}
              onMute={handleMute}
              onDuplicate={handleDuplicate}
              onResetCount={handleResetCount}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <WebhookModal
          webhook={editingWebhook}
          onClose={() => {
            setModalOpen(false);
            setPendingWebhookData(null);
          }}
          onSave={pendingWebhookData ? handleDiscordWebhookSave : handleSave}
          savedUrls={savedUrls}
          onRefreshUrls={fetchSavedUrls}
          maxTrackedUsernames={limits.maxTrackedUsernames}
          hideWebhookUrl={!!pendingWebhookData}
          discordChannel={pendingWebhookData?.channel}
          discordGuild={pendingWebhookData?.guild}
          saving={creatingDiscordWebhook}
          folders={availableFolders}
        />
      )}
    </div>
  );
}
