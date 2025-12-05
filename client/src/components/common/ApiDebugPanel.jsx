import { useState, useEffect } from 'react';
import { 
  Bug, 
  X, 
  Play, 
  ChevronDown, 
  ChevronRight, 
  Copy, 
  Check,
  Loader2,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

const apiEndpoints = [
  {
    category: 'Messages',
    endpoints: [
      { method: 'GET', path: '/messages', description: 'List messages', params: ['limit', 'offset', 'channel', 'user'] },
      { method: 'GET', path: '/messages/search', description: 'Search messages', params: ['q', 'channel', 'user', 'limit'] },
      { method: 'GET', path: '/messages/:id', description: 'Get message by ID', params: ['id'] },
    ]
  },
  {
    category: 'Users',
    endpoints: [
      { method: 'GET', path: '/users', description: 'List users', params: ['limit', 'offset', 'search'] },
      { method: 'GET', path: '/users/:username', description: 'Get user profile', params: ['username'] },
      { method: 'GET', path: '/users/:username/messages', description: 'User messages', params: ['username', 'limit', 'channel'] },
      { method: 'GET', path: '/users/:username/mod-actions', description: 'User mod history', params: ['username', 'limit'] },
      { method: 'GET', path: '/users/:username/stats', description: 'User statistics', params: ['username'] },
    ]
  },
  {
    category: 'Mod Actions',
    endpoints: [
      { method: 'GET', path: '/mod-actions', description: 'List mod actions', params: ['limit', 'offset', 'channel', 'type', 'target'] },
      { method: 'GET', path: '/mod-actions/recent', description: 'Recent actions', params: ['limit'] },
      { method: 'GET', path: '/mod-actions/stats', description: 'Action statistics', params: ['channel', 'since', 'until'] },
    ]
  },
  {
    category: 'Channels',
    endpoints: [
      { method: 'GET', path: '/channels', description: 'List channels', params: ['active'] },
      { method: 'GET', path: '/channels/:name', description: 'Get channel', params: ['name'] },
      { method: 'GET', path: '/channels/:name/stats', description: 'Channel stats', params: ['name', 'since', 'until'] },
      { method: 'GET', path: '/channels/:name/top-users', description: 'Top chatters', params: ['name', 'limit'] },
      { method: 'GET', path: '/channels/:name/links', description: 'Messages with links', params: ['name', 'limit', 'offset'] },
      { method: 'POST', path: '/channels', description: 'Add channel', params: [], body: { name: '' } },
      { method: 'PATCH', path: '/channels/:name', description: 'Update channel', params: ['name'], body: { is_active: true } },
      { method: 'DELETE', path: '/channels/:name', description: 'Remove channel', params: ['name'] },
    ]
  },
  {
    category: 'Utilities',
    endpoints: [
      { method: 'GET', path: '/utils/link-preview', description: 'Get link metadata', params: ['url'] },
    ]
  },
  {
    category: 'System',
    endpoints: [
      { method: 'GET', path: '/health', description: 'Health check', params: [] },
      { method: 'GET', path: '/stats', description: 'System stats', params: [] },
    ]
  },
];

function ApiDebugPanel({ isOpen, onClose }) {
  const [expandedCategories, setExpandedCategories] = useState(['System']);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [params, setParams] = useState({});
  const [body, setBody] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (selectedEndpoint) {
      // Initialize params with empty values
      const initialParams = {};
      selectedEndpoint.params.forEach(p => {
        initialParams[p] = '';
      });
      setParams(initialParams);
      setBody(selectedEndpoint.body ? JSON.stringify(selectedEndpoint.body, null, 2) : '');
      setResponse(null);
      setError(null);
    }
  }, [selectedEndpoint]);

  const toggleCategory = (category) => {
    setExpandedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const buildUrl = () => {
    if (!selectedEndpoint) return '';
    let path = selectedEndpoint.path;
    const queryParams = [];

    // Replace path params and collect query params
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

  const executeRequest = async () => {
    if (!selectedEndpoint) return;

    setLoading(true);
    setError(null);
    setResponse(null);

    const url = buildUrl();
    const options = {
      method: selectedEndpoint.method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (['POST', 'PATCH', 'PUT'].includes(selectedEndpoint.method) && body) {
      try {
        options.body = body;
      } catch (e) {
        setError('Invalid JSON body');
        setLoading(false);
        return;
      }
    }

    try {
      const startTime = Date.now();
      const res = await fetch(url, options);
      const duration = Date.now() - startTime;
      const data = await res.json();
      
      setResponse({
        status: res.status,
        statusText: res.statusText,
        duration,
        data,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const copyResponse = () => {
    if (response) {
      navigator.clipboard.writeText(JSON.stringify(response.data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-14 bottom-0 w-96 bg-twitch-dark border-l border-gray-700 shadow-xl z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-twitch-gray">
        <div className="flex items-center gap-2">
          <Bug className="w-5 h-5 text-yellow-500" />
          <span className="font-semibold text-white">API Debug</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Endpoints List */}
        <div className="h-48 overflow-y-auto border-b border-gray-700 p-2">
          {apiEndpoints.map(({ category, endpoints }) => (
            <div key={category} className="mb-1">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-gray-400 hover:text-white"
              >
                {expandedCategories.includes(category) ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                {category}
              </button>
              
              {expandedCategories.includes(category) && (
                <div className="ml-4 space-y-0.5">
                  {endpoints.map((endpoint, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedEndpoint(endpoint)}
                      className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                        selectedEndpoint === endpoint
                          ? 'bg-twitch-purple/20 text-white'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      <span className={`font-mono text-[10px] px-1 rounded ${
                        endpoint.method === 'GET' ? 'bg-green-600/30 text-green-400' :
                        endpoint.method === 'POST' ? 'bg-blue-600/30 text-blue-400' :
                        endpoint.method === 'PATCH' ? 'bg-yellow-600/30 text-yellow-400' :
                        endpoint.method === 'DELETE' ? 'bg-red-600/30 text-red-400' :
                        'bg-gray-600/30 text-gray-400'
                      }`}>
                        {endpoint.method}
                      </span>
                      <span className="truncate">{endpoint.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Request Builder */}
        {selectedEndpoint && (
          <div className="p-3 border-b border-gray-700 space-y-3">
            <div className="text-xs font-mono text-gray-400 bg-gray-800 p-2 rounded truncate">
              {selectedEndpoint.method} {selectedEndpoint.path}
            </div>

            {/* Parameters */}
            {selectedEndpoint.params.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400">Parameters</label>
                {selectedEndpoint.params.map(param => (
                  <div key={param} className="flex items-center gap-2">
                    <label className="text-xs text-gray-400 w-20">{param}</label>
                    <input
                      type="text"
                      value={params[param] || ''}
                      onChange={(e) => setParams(prev => ({ ...prev, [param]: e.target.value }))}
                      placeholder={param.startsWith(':') ? 'required' : 'optional'}
                      className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Request Body */}
            {selectedEndpoint.body && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400">Request Body</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-twitch-purple resize-none"
                />
              </div>
            )}

            {/* Execute Button */}
            <button
              onClick={executeRequest}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-twitch-purple hover:bg-twitch-purple-dark text-white py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Execute
            </button>
          </div>
        )}

        {/* Response */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {error && (
            <div className="p-3 bg-red-500/10 border-b border-red-500/30 flex items-center gap-2 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {response && (
            <>
              <div className="flex items-center justify-between p-2 bg-twitch-gray border-b border-gray-700">
                <div className="flex items-center gap-2">
                  {response.status >= 200 && response.status < 300 ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span className={`text-xs font-mono ${
                    response.status >= 200 && response.status < 300 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {response.status} {response.statusText}
                  </span>
                  <span className="text-xs text-gray-500">{response.duration}ms</span>
                </div>
                <button
                  onClick={copyResponse}
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                  title="Copy response"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <pre className="flex-1 p-3 overflow-auto text-xs font-mono text-gray-300 bg-gray-900/50">
                {JSON.stringify(response.data, null, 2)}
              </pre>
            </>
          )}

          {!response && !error && selectedEndpoint && (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              Click Execute to test the endpoint
            </div>
          )}

          {!selectedEndpoint && (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              Select an endpoint to test
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ApiDebugPanel;
