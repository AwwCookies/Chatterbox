import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ScrollText, 
  RefreshCw, 
  Trash2, 
  Search, 
  Filter, 
  Download,
  AlertCircle,
  AlertTriangle,
  Info,
  Bug,
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
  Clock,
  X,
  Copy,
  Check,
} from 'lucide-react';
import { adminApi } from '../../services/api';
import { useToastStore } from '../../stores/toastStore';

// Log level configurations
const LOG_LEVELS = {
  error: { 
    color: 'text-red-400', 
    bgColor: 'bg-red-500/10', 
    borderColor: 'border-red-500/30',
    icon: AlertCircle,
    label: 'Error'
  },
  warn: { 
    color: 'text-yellow-400', 
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    icon: AlertTriangle,
    label: 'Warning'
  },
  info: { 
    color: 'text-blue-400', 
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    icon: Info,
    label: 'Info'
  },
  debug: { 
    color: 'text-gray-400', 
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/30',
    icon: Bug,
    label: 'Debug'
  },
};

function LogEntry({ log, onCopy }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const levelConfig = LOG_LEVELS[log.level] || LOG_LEVELS.info;
  const Icon = levelConfig.icon;

  const handleCopy = () => {
    const text = `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}${log.meta ? '\n' + JSON.stringify(log.meta, null, 2) : ''}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasMeta = log.meta && Object.keys(log.meta).length > 0;

  return (
    <div 
      className={`border-l-2 ${levelConfig.borderColor} ${levelConfig.bgColor} hover:bg-opacity-20 transition-colors`}
    >
      <div 
        className="px-3 py-2 flex items-start gap-3 cursor-pointer"
        onClick={() => hasMeta && setExpanded(!expanded)}
      >
        {/* Level Icon */}
        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${levelConfig.color}`} />
        
        {/* Timestamp */}
        <span className="text-xs text-gray-500 font-mono whitespace-nowrap mt-0.5">
          {new Date(log.timestamp).toLocaleTimeString()}
        </span>
        
        {/* Message */}
        <span className="flex-1 text-sm text-gray-200 font-mono break-all">
          {log.message}
        </span>
        
        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
            className="p-1 text-gray-500 hover:text-white rounded"
            title="Copy log entry"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          {hasMeta && (
            <button className="p-1 text-gray-500 hover:text-white">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>
      
      {/* Expanded Meta */}
      {expanded && hasMeta && (
        <div className="px-3 pb-3 pl-10">
          <pre className="text-xs text-gray-400 bg-black/30 rounded p-2 overflow-x-auto">
            {JSON.stringify(log.meta, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function LogViewerTab() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(true);
  const [lastId, setLastId] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedLevels, setSelectedLevels] = useState(['error', 'warn', 'info']);
  const [showFilters, setShowFilters] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [total, setTotal] = useState(0);
  const [limit] = useState(500);
  
  const logsContainerRef = useRef(null);
  const streamIntervalRef = useRef(null);
  const addToast = useToastStore(state => state.addToast);

  // Fetch initial logs
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const [logsRes, statsRes] = await Promise.all([
        adminApi.getLogs({ 
          level: selectedLevels.join(','), 
          search: search || undefined,
          limit,
          order: 'desc'
        }),
        adminApi.getLogStats(),
      ]);
      
      const fetchedLogs = logsRes.data?.logs || [];
      setLogs(fetchedLogs.reverse()); // Reverse to show oldest first in container
      setTotal(logsRes.data?.total || 0);
      setStats(statsRes.data || {});
      
      if (fetchedLogs.length > 0) {
        setLastId(Math.max(...fetchedLogs.map(l => l.id)));
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      addToast('Failed to fetch logs', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedLevels, search, limit, addToast]);

  // Stream new logs
  const streamLogs = useCallback(async () => {
    if (!streaming) return;
    
    try {
      const res = await adminApi.streamLogs(lastId);
      const newLogs = res.data?.logs || [];
      
      if (newLogs.length > 0) {
        // Filter by selected levels
        const filteredNew = newLogs.filter(log => selectedLevels.includes(log.level));
        
        // Filter by search if active
        const searchFiltered = search 
          ? filteredNew.filter(log => 
              log.message.toLowerCase().includes(search.toLowerCase()) ||
              (log.meta && JSON.stringify(log.meta).toLowerCase().includes(search.toLowerCase()))
            )
          : filteredNew;
        
        if (searchFiltered.length > 0) {
          setLogs(prev => {
            const combined = [...prev, ...searchFiltered];
            // Keep only last N logs
            return combined.slice(-limit);
          });
        }
        
        setLastId(res.data?.lastId || lastId);
      }
    } catch (error) {
      console.error('Error streaming logs:', error);
    }
  }, [streaming, lastId, selectedLevels, search, limit]);

  // Initial fetch
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Streaming interval
  useEffect(() => {
    if (streaming) {
      streamIntervalRef.current = setInterval(streamLogs, 1000);
    }
    return () => {
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
      }
    };
  }, [streaming, streamLogs]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Handle scroll - disable auto-scroll if user scrolls up
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  // Toggle level filter
  const toggleLevel = (level) => {
    setSelectedLevels(prev => 
      prev.includes(level) 
        ? prev.filter(l => l !== level)
        : [...prev, level]
    );
  };

  // Clear logs
  const handleClear = async () => {
    if (!confirm('Are you sure you want to clear all logs?')) return;
    
    try {
      await adminApi.clearLogs();
      setLogs([]);
      setLastId(0);
      addToast('Logs cleared', 'success');
      fetchLogs();
    } catch (error) {
      addToast('Failed to clear logs', 'error');
    }
  };

  // Download logs as JSON
  const handleDownload = () => {
    const data = JSON.stringify(logs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatterbox-logs-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-green-400" />
            Server Logs
          </h2>
          <p className="text-sm text-gray-400">Real-time server log viewer</p>
        </div>
        
        {/* Stats Pills */}
        {stats && (
          <div className="flex items-center gap-2">
            {Object.entries(LOG_LEVELS).map(([level, config]) => (
              <div 
                key={level}
                className={`px-2 py-1 rounded text-xs font-medium ${config.bgColor} ${config.color}`}
              >
                {stats.byLevel[level] || 0} {config.label}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-twitch-dark rounded-lg border border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="w-full bg-twitch-gray border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-twitch-purple"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Level Filters */}
          <div className="flex items-center gap-1">
            {Object.entries(LOG_LEVELS).map(([level, config]) => (
              <button
                key={level}
                onClick={() => toggleLevel(level)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  selectedLevels.includes(level)
                    ? `${config.bgColor} ${config.color} border border-current`
                    : 'bg-gray-700 text-gray-400 border border-transparent hover:text-white'
                }`}
              >
                {config.label}
              </button>
            ))}
          </div>

          {/* Stream Toggle */}
          <button
            onClick={() => setStreaming(!streaming)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              streaming
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            {streaming ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {streaming ? 'Live' : 'Paused'}
          </button>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg disabled:opacity-50"
              title="Refresh logs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleDownload}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
              title="Download logs"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={handleClear}
              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg"
              title="Clear all logs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Info Bar */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-700 text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <span>Showing {logs.length} of {total} logs</span>
            {stats?.oldestLog && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Since {new Date(stats.oldestLog).toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={autoScroll ? 'text-green-400' : 'text-gray-500'}>
              Auto-scroll: {autoScroll ? 'On' : 'Off'}
            </span>
          </div>
        </div>
      </div>

      {/* Log Container */}
      <div 
        ref={logsContainerRef}
        onScroll={handleScroll}
        className="bg-twitch-dark rounded-lg border border-gray-700 h-[600px] overflow-y-auto font-mono text-sm"
      >
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            Loading logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <ScrollText className="w-12 h-12 mb-3 opacity-50" />
            <p>No logs to display</p>
            <p className="text-sm mt-1">Try adjusting your filters or wait for new logs</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {logs.map(log => (
              <LogEntry key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>

      {/* Recent Errors Summary */}
      {stats?.recentErrors?.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <h3 className="text-sm font-medium text-red-400 mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Recent Errors ({stats.recentErrors.length})
          </h3>
          <div className="space-y-2">
            {stats.recentErrors.slice(0, 5).map(error => (
              <div key={error.id} className="text-xs text-gray-300 font-mono truncate">
                <span className="text-gray-500">{new Date(error.timestamp).toLocaleTimeString()}</span>
                {' '}
                {error.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default LogViewerTab;
