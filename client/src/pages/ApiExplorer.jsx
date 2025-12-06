import { useState, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { 
  Bug, 
  Play, 
  ChevronDown, 
  ChevronRight, 
  Copy, 
  Check,
  Loader2,
  AlertCircle,
  CheckCircle,
  Search,
  Clock,
  Trash2,
  Save,
  Download,
  Upload,
  Key,
  Lock,
  Unlock,
  RefreshCw,
  Code,
  FileJson,
  Filter,
  BookOpen,
  Zap,
  Shield,
  Database,
  Users,
  MessageSquare,
  Radio,
  Settings,
  Activity,
  Send
} from 'lucide-react';

// Dynamically determine API URL based on current location
const getApiBase = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:3000`;
};

const API_BASE = getApiBase();

// Comprehensive API endpoint definitions with auth requirements
const apiEndpoints = [
  {
    category: 'System',
    icon: Activity,
    color: 'green',
    description: 'Health checks and system statistics',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Health check', params: [], auth: 'none' },
      { method: 'GET', path: '/stats', description: 'System statistics', params: [], auth: 'none' },
    ]
  },
  {
    category: 'Messages',
    icon: MessageSquare,
    color: 'blue',
    description: 'Chat message retrieval and search',
    endpoints: [
      { method: 'GET', path: '/messages', description: 'List messages with filters', params: ['limit', 'offset', 'channel', 'user', 'since', 'until', 'search', 'includeDeleted'], auth: 'none' },
      { method: 'GET', path: '/messages/search', description: 'Full-text search messages', params: ['q', 'channel', 'user', 'limit', 'offset'], auth: 'none' },
      { method: 'GET', path: '/messages/mentions/:username', description: 'Get messages mentioning user', params: ['username', 'channelId', 'daysBack', 'maxResults'], auth: 'none' },
      { method: 'GET', path: '/messages/replies/:userId', description: 'Get replies to user', params: ['userId', 'channelId', 'limit', 'offset'], auth: 'none' },
      { method: 'GET', path: '/messages/:id', description: 'Get message by ID', params: ['id'], auth: 'none' },
      { method: 'GET', path: '/messages/:messageId/thread', description: 'Get message thread/conversation', params: ['messageId', 'maxReplies'], auth: 'none' },
    ]
  },
  {
    category: 'Users',
    icon: Users,
    color: 'purple',
    description: 'User profiles, statistics, and management',
    endpoints: [
      { method: 'GET', path: '/users', description: 'List users with search', params: ['limit', 'offset', 'search', 'username', 'channel'], auth: 'none' },
      { method: 'GET', path: '/users/top', description: 'Top users by message count', params: ['limit', 'offset', 'channelId', 'since', 'until'], auth: 'none' },
      { method: 'GET', path: '/users/blocked', description: 'List blocked users', params: ['limit', 'offset'], auth: 'apiKey' },
      { method: 'GET', path: '/users/:username', description: 'Get user profile', params: ['username'], auth: 'none' },
      { method: 'GET', path: '/users/:username/messages', description: 'Get user messages', params: ['username', 'limit', 'offset', 'channel', 'since', 'until'], auth: 'none' },
      { method: 'GET', path: '/users/:username/mod-actions', description: 'Get user mod action history', params: ['username', 'limit', 'offset'], auth: 'none' },
      { method: 'GET', path: '/users/:username/stats', description: 'Get user statistics', params: ['username'], auth: 'none' },
      { method: 'GET', path: '/users/:username/export', description: 'Export user data', params: ['username'], auth: 'apiKey' },
      { method: 'POST', path: '/users/:username/block', description: 'Block a user', params: ['username'], body: { reason: '' }, auth: 'apiKey' },
      { method: 'POST', path: '/users/:username/unblock', description: 'Unblock a user', params: ['username'], auth: 'apiKey' },
      { method: 'PATCH', path: '/users/:username/notes', description: 'Update user notes', params: ['username'], body: { notes: '' }, auth: 'apiKey' },
      { method: 'DELETE', path: '/users/:username/messages', description: 'Delete all user messages', params: ['username'], auth: 'apiKey' },
      { method: 'DELETE', path: '/users/:username', description: 'Delete user entirely', params: ['username'], auth: 'apiKey' },
    ]
  },
  {
    category: 'User Analytics',
    icon: Activity,
    color: 'cyan',
    description: 'Detailed user activity analytics',
    endpoints: [
      { method: 'GET', path: '/users/:username/analytics/activity', description: 'Hourly/daily activity patterns', params: ['username', 'days'], auth: 'none' },
      { method: 'GET', path: '/users/:username/analytics/channels', description: 'Channel breakdown', params: ['username', 'days'], auth: 'none' },
      { method: 'GET', path: '/users/:username/analytics/emotes', description: 'Most used emotes', params: ['username', 'days', 'limit'], auth: 'none' },
      { method: 'GET', path: '/users/:username/analytics/summary', description: 'Comprehensive analytics summary', params: ['username', 'days'], auth: 'none' },
    ]
  },
  {
    category: 'Channels',
    icon: Radio,
    color: 'pink',
    description: 'Channel management and statistics',
    endpoints: [
      { method: 'GET', path: '/channels', description: 'List all channels', params: ['active'], auth: 'none' },
      { method: 'GET', path: '/channels/live/status', description: 'Get Twitch live status for channels', params: [], auth: 'none' },
      { method: 'GET', path: '/channels/:name', description: 'Get channel details', params: ['name'], auth: 'none' },
      { method: 'GET', path: '/channels/:name/stats', description: 'Get channel statistics', params: ['name', 'since', 'until'], auth: 'none' },
      { method: 'GET', path: '/channels/:name/top-users', description: 'Top chatters in channel', params: ['name', 'limit'], auth: 'none' },
      { method: 'GET', path: '/channels/:name/links', description: 'Messages containing links', params: ['name', 'limit', 'offset', 'since', 'until'], auth: 'none' },
      { method: 'POST', path: '/channels', description: 'Add channel to track', params: [], body: { name: '' }, auth: 'apiKey' },
      { method: 'PATCH', path: '/channels/:name', description: 'Update channel settings', params: ['name'], body: { is_active: true }, auth: 'apiKey' },
      { method: 'DELETE', path: '/channels/:name', description: 'Remove channel', params: ['name'], auth: 'apiKey' },
    ]
  },
  {
    category: 'Channel Analytics',
    icon: Activity,
    color: 'orange',
    description: 'Detailed channel activity analytics',
    endpoints: [
      { method: 'GET', path: '/channels/:name/analytics/hourly', description: 'Hourly message counts', params: ['name', 'hours'], auth: 'none' },
      { method: 'GET', path: '/channels/:name/analytics/daily', description: 'Daily statistics', params: ['name', 'days'], auth: 'none' },
      { method: 'GET', path: '/channels/:name/analytics/top-users', description: 'Top chatters (analytics)', params: ['name', 'days', 'limit'], auth: 'none' },
      { method: 'GET', path: '/channels/:name/analytics/heatmap', description: 'Activity heatmap data', params: ['name', 'days'], auth: 'none' },
      { method: 'GET', path: '/channels/:name/analytics/mod-actions', description: 'Mod action trends', params: ['name', 'days'], auth: 'none' },
      { method: 'GET', path: '/channels/:name/analytics/engagement', description: 'Engagement metrics', params: ['name', 'days'], auth: 'none' },
      { method: 'GET', path: '/channels/:name/analytics/retention', description: 'User retention data', params: ['name', 'days'], auth: 'none' },
      { method: 'GET', path: '/channels/:name/analytics/top-emotes', description: 'Top emotes used', params: ['name', 'days', 'limit'], auth: 'none' },
    ]
  },
  {
    category: 'Mod Actions',
    icon: Shield,
    color: 'red',
    description: 'Moderation action logs and statistics',
    endpoints: [
      { method: 'GET', path: '/mod-actions', description: 'List mod actions', params: ['limit', 'offset', 'channel', 'type', 'target', 'moderator'], auth: 'none' },
      { method: 'GET', path: '/mod-actions/recent', description: 'Recent mod actions', params: ['limit'], auth: 'none' },
      { method: 'GET', path: '/mod-actions/stats', description: 'Mod action statistics', params: ['channel', 'since', 'until'], auth: 'none' },
    ]
  },
  {
    category: 'OAuth / User Auth',
    icon: Key,
    color: 'yellow',
    description: 'User authentication and session management',
    endpoints: [
      { method: 'GET', path: '/oauth/login', description: 'Initiate Twitch OAuth (redirects)', params: ['redirect'], auth: 'none', note: 'Redirects to Twitch' },
      { method: 'GET', path: '/oauth/me', description: 'Get current user profile', params: [], auth: 'bearer' },
      { method: 'GET', path: '/oauth/followed-streams', description: 'Get followed live streams', params: [], auth: 'bearer' },
      { method: 'POST', path: '/oauth/refresh', description: 'Refresh access token', params: [], body: { refreshToken: '' }, auth: 'none' },
      { method: 'POST', path: '/oauth/logout', description: 'Logout current session', params: [], body: { refreshToken: '' }, auth: 'none' },
      { method: 'POST', path: '/oauth/logout-all', description: 'Logout all sessions', params: [], auth: 'bearer' },
      { method: 'POST', path: '/oauth/requests', description: 'Create data request (export/delete)', params: [], body: { type: 'export', reason: '' }, auth: 'bearer' },
      { method: 'DELETE', path: '/oauth/requests/:id', description: 'Cancel data request', params: ['id'], auth: 'bearer' },
    ]
  },
  {
    category: 'Chat',
    icon: Send,
    color: 'lime',
    description: 'Send chat messages via Twitch API',
    endpoints: [
      { method: 'POST', path: '/chat/send', description: 'Send a message to Twitch chat', params: [], body: { channel: 'channelname', message: 'Hello!' }, auth: 'bearer' },
    ]
  },
  {
    category: 'Utilities',
    icon: Zap,
    color: 'teal',
    description: 'Utility endpoints',
    endpoints: [
      { method: 'GET', path: '/utils/link-preview', description: 'Get link metadata/preview', params: ['url'], auth: 'none' },
    ]
  },
  {
    category: 'Admin - System',
    icon: Database,
    color: 'indigo',
    description: 'Server administration and monitoring',
    endpoints: [
      { method: 'GET', path: '/admin/system', description: 'System information', params: [], auth: 'apiKey' },
      { method: 'GET', path: '/admin/database', description: 'Database statistics', params: [], auth: 'apiKey' },
      { method: 'GET', path: '/admin/services', description: 'Services status', params: [], auth: 'apiKey' },
      { method: 'GET', path: '/admin/analytics', description: 'Analytics data', params: ['period'], auth: 'apiKey' },
      { method: 'GET', path: '/admin/performance', description: 'Performance metrics', params: [], auth: 'apiKey' },
      { method: 'GET', path: '/admin/logs', description: 'Server logs', params: ['limit', 'level'], auth: 'apiKey' },
      { method: 'GET', path: '/admin/config', description: 'System configuration (env, port)', params: [], auth: 'apiKey' },
      { method: 'POST', path: '/admin/services/:service/restart', description: 'Restart a service', params: ['service'], auth: 'apiKey' },
      { method: 'POST', path: '/admin/database/vacuum', description: 'Vacuum database table', params: [], body: { table: 'messages' }, auth: 'apiKey' },
    ]
  },
  {
    category: 'Admin - Settings',
    icon: Settings,
    color: 'slate',
    description: 'Server configuration management',
    endpoints: [
      { method: 'GET', path: '/admin/settings', description: 'Get all server settings', params: [], auth: 'apiKey' },
      { method: 'PUT', path: '/admin/settings/:key', description: 'Update a setting', params: ['key'], body: { value: 60000 }, auth: 'apiKey' },
      { method: 'DELETE', path: '/admin/settings/:key', description: 'Reset setting to default', params: ['key'], auth: 'apiKey' },
      { method: 'POST', path: '/admin/settings/bulk', description: 'Bulk update settings', params: [], body: { configs: [{ key: 'rateLimit.windowMs', value: 60000 }] }, auth: 'apiKey' },
    ]
  },
  {
    category: 'Admin - Traffic',
    icon: Activity,
    color: 'emerald',
    description: 'Traffic monitoring and analytics',
    endpoints: [
      { method: 'GET', path: '/admin/traffic', description: 'Traffic analytics', params: ['timeRange'], auth: 'apiKey' },
      { method: 'DELETE', path: '/admin/traffic/cleanup', description: 'Cleanup old traffic logs', params: [], body: { olderThanDays: 30 }, auth: 'apiKey' },
    ]
  },
  {
    category: 'Admin - IP Rules',
    icon: Shield,
    color: 'rose',
    description: 'IP blocking and rate limiting',
    endpoints: [
      { method: 'GET', path: '/admin/ip-rules', description: 'List all IP rules', params: [], auth: 'apiKey' },
      { method: 'GET', path: '/admin/ip-rules/:ip/status', description: 'Get IP status', params: ['ip'], auth: 'apiKey' },
      { method: 'POST', path: '/admin/ip-rules/block', description: 'Block an IP', params: [], body: { ip: '192.168.1.100', reason: 'Abuse', expiresAt: null }, auth: 'apiKey' },
      { method: 'POST', path: '/admin/ip-rules/unblock', description: 'Unblock an IP', params: [], body: { ip: '192.168.1.100' }, auth: 'apiKey' },
      { method: 'POST', path: '/admin/ip-rules/rate-limit', description: 'Set custom rate limit for IP', params: [], body: { ip: '192.168.1.100', limit: 500, expiresAt: null }, auth: 'apiKey' },
      { method: 'DELETE', path: '/admin/ip-rules/:id', description: 'Delete IP rule', params: ['id'], auth: 'apiKey' },
    ]
  },
  {
    category: 'Admin - User Management',
    icon: Users,
    color: 'violet',
    description: 'OAuth user and request management',
    endpoints: [
      { method: 'GET', path: '/admin/user-requests', description: 'List user data requests', params: ['status', 'type', 'limit', 'offset'], auth: 'apiKey' },
      { method: 'GET', path: '/admin/user-requests/pending', description: 'Get pending requests count', params: [], auth: 'apiKey' },
      { method: 'GET', path: '/admin/user-requests/:id', description: 'Get request details', params: ['id'], auth: 'apiKey' },
      { method: 'POST', path: '/admin/user-requests/:id/approve', description: 'Approve request', params: ['id'], body: { adminNotes: '' }, auth: 'apiKey' },
      { method: 'POST', path: '/admin/user-requests/:id/deny', description: 'Deny request', params: ['id'], body: { adminNotes: '' }, auth: 'apiKey' },
      { method: 'GET', path: '/admin/oauth-users', description: 'List OAuth users', params: ['limit', 'offset', 'search'], auth: 'apiKey' },
      { method: 'POST', path: '/admin/oauth-users/:id/admin', description: 'Set user admin status', params: ['id'], body: { isAdmin: true }, auth: 'apiKey' },
      { method: 'DELETE', path: '/admin/oauth-users/:id', description: 'Delete OAuth user', params: ['id'], auth: 'apiKey' },
    ]
  },
  {
    category: 'Webhooks',
    icon: Zap,
    color: 'fuchsia',
    description: 'Discord webhook management for notifications',
    endpoints: [
      { method: 'GET', path: '/webhooks', description: 'List user webhooks', params: [], auth: 'bearer' },
      { method: 'POST', path: '/webhooks', description: 'Create user webhook', params: [], body: { name: 'My Webhook', webhookType: 'mod_action', webhookUrl: 'https://discord.com/api/webhooks/...', config: { action_types: ['ban', 'timeout'] } }, auth: 'bearer' },
      { method: 'PUT', path: '/webhooks/:id', description: 'Update user webhook', params: ['id'], body: { name: 'Updated Name', enabled: true }, auth: 'bearer' },
      { method: 'DELETE', path: '/webhooks/:id', description: 'Delete user webhook', params: ['id'], auth: 'bearer' },
      { method: 'POST', path: '/webhooks/:id/test', description: 'Test user webhook', params: ['id'], auth: 'bearer' },
      { method: 'GET', path: '/webhooks/urls', description: 'List saved webhook URLs', params: [], auth: 'bearer' },
      { method: 'POST', path: '/webhooks/urls', description: 'Save webhook URL to bank', params: [], body: { name: 'Mod Alerts', webhookUrl: 'https://discord.com/api/webhooks/...' }, auth: 'bearer' },
      { method: 'PUT', path: '/webhooks/urls/:id', description: 'Update saved URL name', params: ['id'], body: { name: 'New Name' }, auth: 'bearer' },
      { method: 'DELETE', path: '/webhooks/urls/:id', description: 'Delete saved URL', params: ['id'], auth: 'bearer' },
      { method: 'GET', path: '/webhooks/admin', description: 'List admin webhooks', params: [], auth: 'bearer' },
      { method: 'POST', path: '/webhooks/admin', description: 'Create admin webhook', params: [], body: { name: 'Admin Alerts', webhookType: 'user_signup', webhookUrl: 'https://discord.com/api/webhooks/...' }, auth: 'bearer' },
      { method: 'PUT', path: '/webhooks/admin/:id', description: 'Update admin webhook', params: ['id'], body: { name: 'Updated Name', enabled: true }, auth: 'bearer' },
      { method: 'DELETE', path: '/webhooks/admin/:id', description: 'Delete admin webhook', params: ['id'], auth: 'bearer' },
      { method: 'POST', path: '/webhooks/admin/:id/test', description: 'Test admin webhook', params: ['id'], auth: 'bearer' },
    ]
  },
];

// Method colors
const methodColors = {
  GET: 'bg-green-500/20 text-green-400 border-green-500/30',
  POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  PUT: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  PATCH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
};

// Auth badge colors
const authColors = {
  none: 'bg-gray-500/20 text-gray-400',
  apiKey: 'bg-yellow-500/20 text-yellow-400',
  bearer: 'bg-purple-500/20 text-purple-400',
};

export default function ApiExplorer() {
  const user = useAuthStore(state => state.user);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const accessToken = useAuthStore(state => state.accessToken);
  const storedApiKey = useSettingsStore(state => state.apiKey);

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [params, setParams] = useState({});
  const [body, setBody] = useState('');
  const [apiKey, setApiKey] = useState(storedApiKey || '');
  const [useBearer, setUseBearer] = useState(true);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('params'); // params, headers, body

  // Redirect non-admins
  if (!isAuthenticated || !user?.is_admin) {
    return <Navigate to="/" replace />;
  }

  // Filter endpoints based on search
  const filteredEndpoints = useMemo(() => {
    if (!searchQuery.trim()) return apiEndpoints;
    
    const query = searchQuery.toLowerCase();
    return apiEndpoints.map(category => ({
      ...category,
      endpoints: category.endpoints.filter(ep => 
        ep.path.toLowerCase().includes(query) ||
        ep.description.toLowerCase().includes(query) ||
        ep.method.toLowerCase().includes(query)
      )
    })).filter(cat => cat.endpoints.length > 0);
  }, [searchQuery]);

  // Initialize params when endpoint changes
  useEffect(() => {
    if (selectedEndpoint) {
      const initialParams = {};
      selectedEndpoint.params.forEach(p => {
        initialParams[p] = '';
      });
      setParams(initialParams);
      setBody(selectedEndpoint.body ? JSON.stringify(selectedEndpoint.body, null, 2) : '');
      setResponse(null);
      setError(null);
      setActiveTab(selectedEndpoint.body ? 'body' : 'params');
    }
  }, [selectedEndpoint]);

  // Toggle category expansion
  const toggleCategory = (category) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Build full URL with params
  const buildUrl = () => {
    if (!selectedEndpoint) return '';
    let path = selectedEndpoint.path;
    const queryParams = [];

    Object.entries(params).forEach(([key, value]) => {
      if (!value) return;
      if (path.includes(`:${key}`)) {
        path = path.replace(`:${key}`, encodeURIComponent(value));
      } else {
        queryParams.push(`${key}=${encodeURIComponent(value)}`);
      }
    });

    const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
    return `${API_BASE}/api${path}${queryString}`;
  };

  // Execute API request
  const executeRequest = async () => {
    if (!selectedEndpoint) return;

    setLoading(true);
    setError(null);
    setResponse(null);

    const url = buildUrl();
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Add authentication based on endpoint requirements
    if (selectedEndpoint.auth === 'apiKey' && apiKey) {
      headers['X-API-Key'] = apiKey;
    } else if (selectedEndpoint.auth === 'bearer' && useBearer && accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const options = {
      method: selectedEndpoint.method,
      headers,
    };

    if (['POST', 'PATCH', 'PUT'].includes(selectedEndpoint.method) && body) {
      try {
        JSON.parse(body); // Validate JSON
        options.body = body;
      } catch (e) {
        setError('Invalid JSON in request body');
        setLoading(false);
        return;
      }
    }

    try {
      const startTime = Date.now();
      const res = await fetch(url, options);
      const duration = Date.now() - startTime;
      
      let data;
      const contentType = res.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await res.json();
      } else {
        data = await res.text();
      }
      
      const result = {
        status: res.status,
        statusText: res.statusText,
        duration,
        data,
        headers: Object.fromEntries(res.headers.entries()),
      };
      
      setResponse(result);
      
      // Add to history
      setHistory(prev => [{
        endpoint: selectedEndpoint,
        url,
        params: { ...params },
        body,
        response: result,
        timestamp: new Date().toISOString(),
      }, ...prev.slice(0, 49)]); // Keep last 50
      
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Copy response to clipboard
  const copyResponse = () => {
    if (response) {
      navigator.clipboard.writeText(JSON.stringify(response.data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Copy cURL command
  const copyCurl = () => {
    if (!selectedEndpoint) return;
    
    const url = buildUrl();
    let curl = `curl -X ${selectedEndpoint.method} '${url}'`;
    
    if (selectedEndpoint.auth === 'apiKey' && apiKey) {
      curl += ` \\\n  -H 'X-API-Key: ${apiKey}'`;
    } else if (selectedEndpoint.auth === 'bearer' && useBearer && accessToken) {
      curl += ` \\\n  -H 'Authorization: Bearer ${accessToken}'`;
    }
    
    if (['POST', 'PATCH', 'PUT'].includes(selectedEndpoint.method) && body) {
      curl += ` \\\n  -H 'Content-Type: application/json'`;
      curl += ` \\\n  -d '${body.replace(/\n/g, '')}'`;
    }
    
    navigator.clipboard.writeText(curl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Load from history
  const loadFromHistory = (item) => {
    setSelectedEndpoint(item.endpoint);
    setParams(item.params);
    setBody(item.body);
    setResponse(item.response);
    setShowHistory(false);
  };

  return (
    <div className="max-w-full mx-auto h-[calc(100vh-5rem)] overflow-hidden">
      <div className="flex h-full gap-4 overflow-hidden">
        {/* Left Panel - Endpoint Browser */}
        <div className="w-80 flex-shrink-0 bg-gray-800 rounded-lg border border-gray-700 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <Code className="w-5 h-5 text-twitch-purple" />
              <h1 className="text-lg font-bold text-white">API Explorer</h1>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search endpoints..."
                className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple"
              />
            </div>
          </div>

          {/* Endpoint List */}
          <div className="flex-1 overflow-y-auto p-2">
            {filteredEndpoints.map(({ category, icon: Icon, color, description, endpoints }) => (
              <div key={category} className="mb-2">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-700/50 transition-colors"
                >
                  {expandedCategories.has(category) ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <Icon className={`w-4 h-4 text-${color}-400`} />
                  <span className="text-sm font-medium text-white flex-1 text-left">{category}</span>
                  <span className="text-xs text-gray-500">{endpoints.length}</span>
                </button>
                
                {expandedCategories.has(category) && (
                  <div className="ml-6 mt-1 space-y-1">
                    {endpoints.map((endpoint, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedEndpoint(endpoint);
                          setSelectedCategory(category);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                          selectedEndpoint === endpoint
                            ? 'bg-twitch-purple/20 border border-twitch-purple/50'
                            : 'hover:bg-gray-700/50'
                        }`}
                      >
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${methodColors[endpoint.method]}`}>
                          {endpoint.method}
                        </span>
                        <span className="text-xs text-gray-300 truncate flex-1">{endpoint.description}</span>
                        {endpoint.auth !== 'none' && (
                          <Lock className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* History Toggle */}
          <div className="p-2 border-t border-gray-700">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                showHistory ? 'bg-twitch-purple text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span className="text-sm">History ({history.length})</span>
            </button>
          </div>
        </div>

        {/* Middle Panel - Request Builder */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {selectedEndpoint ? (
            <>
              {/* Endpoint Info */}
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-xs font-bold px-2 py-1 rounded border ${methodColors[selectedEndpoint.method]}`}>
                    {selectedEndpoint.method}
                  </span>
                  <code className="text-sm text-gray-300 font-mono flex-1 truncate">{selectedEndpoint.path}</code>
                  <span className={`text-xs px-2 py-1 rounded ${authColors[selectedEndpoint.auth]}`}>
                    {selectedEndpoint.auth === 'none' ? 'Public' : selectedEndpoint.auth === 'apiKey' ? 'API Key' : 'Bearer Token'}
                  </span>
                </div>
                <p className="text-sm text-gray-400">{selectedEndpoint.description}</p>
                {selectedEndpoint.note && (
                  <p className="text-xs text-yellow-400 mt-2">⚠️ {selectedEndpoint.note}</p>
                )}
                
                {/* Full URL */}
                <div className="mt-3 p-2 bg-gray-900 rounded font-mono text-xs text-gray-400 truncate">
                  {buildUrl() || `${API_BASE}/api${selectedEndpoint.path}`}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mb-4">
                {['params', 'auth', 'body'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                      activeTab === tab
                        ? 'bg-gray-800 text-white border-t border-l border-r border-gray-700'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {tab === 'params' && `Parameters (${selectedEndpoint.params.length})`}
                    {tab === 'auth' && 'Authentication'}
                    {tab === 'body' && 'Body'}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 flex-1 overflow-y-auto">
                {activeTab === 'params' && (
                  <div className="space-y-3">
                    {selectedEndpoint.params.length === 0 ? (
                      <p className="text-gray-500 text-sm">No parameters for this endpoint</p>
                    ) : (
                      selectedEndpoint.params.map(param => (
                        <div key={param} className="flex items-center gap-3">
                          <label className="text-sm text-gray-400 w-32 flex-shrink-0">
                            {param}
                            {selectedEndpoint.path.includes(`:${param}`) && (
                              <span className="text-red-400 ml-1">*</span>
                            )}
                          </label>
                          <input
                            type="text"
                            value={params[param] || ''}
                            onChange={(e) => setParams(prev => ({ ...prev, [param]: e.target.value }))}
                            placeholder={selectedEndpoint.path.includes(`:${param}`) ? 'Required' : 'Optional'}
                            className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple"
                          />
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'auth' && (
                  <div className="space-y-4">
                    <div className="p-3 bg-gray-900 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Key className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm font-medium text-white">API Key (X-API-Key header)</span>
                      </div>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter API key for admin endpoints"
                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
                      />
                      <p className="text-xs text-gray-500 mt-2">Required for admin and write operations</p>
                    </div>

                    <div className="p-3 bg-gray-900 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-purple-400" />
                          <span className="text-sm font-medium text-white">Bearer Token (OAuth)</span>
                        </div>
                        <button
                          onClick={() => setUseBearer(!useBearer)}
                          className={`px-3 py-1 text-xs rounded transition-colors ${
                            useBearer ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-700 text-gray-400'
                          }`}
                        >
                          {useBearer ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>
                      {accessToken ? (
                        <div className="text-xs text-green-400">✓ Logged in as {user?.username}</div>
                      ) : (
                        <div className="text-xs text-gray-500">Not logged in - Bearer token unavailable</div>
                      )}
                      <p className="text-xs text-gray-500 mt-2">Required for user-specific endpoints (/oauth/*)</p>
                    </div>

                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-sm text-blue-300">
                        <strong>This endpoint requires:</strong>{' '}
                        {selectedEndpoint.auth === 'none' && 'No authentication'}
                        {selectedEndpoint.auth === 'apiKey' && 'API Key (X-API-Key header)'}
                        {selectedEndpoint.auth === 'bearer' && 'Bearer Token (OAuth login)'}
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'body' && (
                  <div>
                    {selectedEndpoint.body ? (
                      <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={12}
                        className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-twitch-purple resize-none"
                        placeholder="Enter JSON request body"
                      />
                    ) : (
                      <p className="text-gray-500 text-sm">No request body for this endpoint</p>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={executeRequest}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-twitch-purple hover:bg-twitch-purple-dark text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                  Send Request
                </button>
                <button
                  onClick={copyCurl}
                  className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  title="Copy as cURL"
                >
                  <Code className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-800 rounded-lg border border-gray-700">
              <div className="text-center">
                <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">Select an endpoint to get started</p>
                <p className="text-gray-600 text-sm mt-1">Browse categories on the left or use search</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Response / History */}
        <div className="w-96 flex-shrink-0 bg-gray-800 rounded-lg border border-gray-700 flex flex-col overflow-hidden">
          {showHistory ? (
            <>
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <h2 className="font-semibold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Request History
                </h2>
                <button
                  onClick={() => setHistory([])}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Clear
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {history.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-8">No requests yet</p>
                ) : (
                  history.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => loadFromHistory(item)}
                      className="w-full p-3 mb-2 bg-gray-900 rounded-lg hover:bg-gray-700 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-1 rounded ${methodColors[item.endpoint.method]}`}>
                          {item.endpoint.method}
                        </span>
                        <span className={`text-xs ${
                          item.response.status >= 200 && item.response.status < 300 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {item.response.status}
                        </span>
                        <span className="text-xs text-gray-500">{item.response.duration}ms</span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">{item.endpoint.path}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <h2 className="font-semibold text-white flex items-center gap-2">
                  <FileJson className="w-4 h-4" />
                  Response
                </h2>
                {response && (
                  <button
                    onClick={copyResponse}
                    className="p-1.5 text-gray-400 hover:text-white transition-colors"
                    title="Copy response"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border-b border-red-500/30 flex items-center gap-2 text-red-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {response && (
                <>
                  <div className="p-3 bg-gray-900 border-b border-gray-700 flex items-center gap-3">
                    {response.status >= 200 && response.status < 300 ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-400" />
                    )}
                    <span className={`font-mono font-bold ${
                      response.status >= 200 && response.status < 300 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {response.status}
                    </span>
                    <span className="text-gray-400 text-sm">{response.statusText}</span>
                    <span className="text-gray-500 text-sm ml-auto">{response.duration}ms</span>
                  </div>
                  <pre className="flex-1 p-4 overflow-auto text-xs font-mono text-gray-300 bg-gray-900/50">
                    {typeof response.data === 'string' 
                      ? response.data 
                      : JSON.stringify(response.data, null, 2)
                    }
                  </pre>
                </>
              )}

              {!response && !error && (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Execute a request to see the response</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
