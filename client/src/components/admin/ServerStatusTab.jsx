import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSettingsStore } from '../../stores/settingsStore';
import { useToast } from '../../stores/toastStore';
import {
  Server,
  Database,
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  Clock,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Wifi,
  WifiOff,
  Users,
  MessageSquare,
  Shield,
  TrendingUp,
  BarChart3,
  Zap,
  Settings2,
  Play,
  Loader2,
  ChevronDown,
  ChevronRight,
  Trash2,
  Hash
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

// Format bytes to human readable
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Format duration
const formatDuration = (seconds) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
};

// Format number with commas
const formatNumber = (num) => {
  return num?.toLocaleString() ?? '0';
};

// Status badge component
function StatusBadge({ status }) {
  const config = {
    healthy: { color: 'text-green-400 bg-green-500/20', icon: CheckCircle, label: 'Healthy' },
    connected: { color: 'text-green-400 bg-green-500/20', icon: Wifi, label: 'Connected' },
    disconnected: { color: 'text-red-400 bg-red-500/20', icon: WifiOff, label: 'Disconnected' },
    error: { color: 'text-red-400 bg-red-500/20', icon: XCircle, label: 'Error' },
    warning: { color: 'text-yellow-400 bg-yellow-500/20', icon: AlertTriangle, label: 'Warning' },
    unknown: { color: 'text-gray-400 bg-gray-500/20', icon: AlertTriangle, label: 'Unknown' },
  };
  
  const cfg = config[status] || config.unknown;
  const Icon = cfg.icon;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// Stat card component
function StatCard({ icon: Icon, label, value, subValue, trend, color = 'text-twitch-purple' }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}
        </div>
        <div className={`p-2 rounded-lg bg-gray-700/50 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {trend && (
        <div className={`mt-2 flex items-center gap-1 text-xs ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
          <TrendingUp className={`w-3 h-3 ${trend < 0 ? 'rotate-180' : ''}`} />
          <span>{Math.abs(trend)}% from last period</span>
        </div>
      )}
    </div>
  );
}

// Service card component
function ServiceCard({ service, onRestart }) {
  const [restarting, setRestarting] = useState(false);
  
  const handleRestart = async () => {
    setRestarting(true);
    try {
      await onRestart(service.key);
    } finally {
      setRestarting(false);
    }
  };
  
  return (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-white">{service.name}</h4>
        <StatusBadge status={service.status} />
      </div>
      
      {service.details && (
        <div className="space-y-1 mb-3">
          {Object.entries(service.details).map(([key, value]) => (
            <div key={key} className="flex justify-between text-sm">
              <span className="text-gray-400">{key}</span>
              <span className="text-gray-200">{value}</span>
            </div>
          ))}
        </div>
      )}
      
      {service.canRestart && (
        <button
          onClick={handleRestart}
          disabled={restarting}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {restarting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Restart
        </button>
      )}
    </div>
  );
}

// Progress bar component
function ProgressBar({ value, max, label, color = 'bg-twitch-purple' }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-200">{percentage.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

// Collapsible section component
function CollapsibleSection({ title, icon: Icon, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="bg-gray-800/30 rounded-lg border border-gray-700/50 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-twitch-purple" />
          <span className="font-medium text-white">{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t border-gray-700/50">
          {children}
        </div>
      )}
    </div>
  );
}

// Table row highlight component
function TableRow({ columns, highlight }) {
  return (
    <tr className={`border-b border-gray-700/50 ${highlight ? 'bg-yellow-500/10' : 'hover:bg-gray-700/30'}`}>
      {columns.map((col, i) => (
        <td key={i} className="px-4 py-2 text-sm text-gray-300">
          {col}
        </td>
      ))}
    </tr>
  );
}

// Main component
function ServerStatusTab() {
  const apiKey = useSettingsStore(state => state.apiKey);
  const toast = useToast();
  const queryClient = useQueryClient();
  const [analyticsPeriod, setAnalyticsPeriod] = useState('24h');

  // Fetch system info
  const { data: systemData, isLoading: systemLoading, error: systemError, refetch: refetchSystem } = useQuery({
    queryKey: ['admin', 'system'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/system`, {
        headers: { 'X-API-Key': apiKey }
      });
      if (!res.ok) throw new Error('Failed to fetch system info');
      return res.json();
    },
    enabled: !!apiKey,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch database info
  const { data: dbData, isLoading: dbLoading, refetch: refetchDb } = useQuery({
    queryKey: ['admin', 'database'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/database`, {
        headers: { 'X-API-Key': apiKey }
      });
      if (!res.ok) throw new Error('Failed to fetch database info');
      return res.json();
    },
    enabled: !!apiKey,
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch services status
  const { data: servicesData, isLoading: servicesLoading, refetch: refetchServices } = useQuery({
    queryKey: ['admin', 'services'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/services`, {
        headers: { 'X-API-Key': apiKey }
      });
      if (!res.ok) throw new Error('Failed to fetch services');
      return res.json();
    },
    enabled: !!apiKey,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch analytics
  const { data: analyticsData, isLoading: analyticsLoading, refetch: refetchAnalytics } = useQuery({
    queryKey: ['admin', 'analytics', analyticsPeriod],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/analytics?period=${analyticsPeriod}`, {
        headers: { 'X-API-Key': apiKey }
      });
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return res.json();
    },
    enabled: !!apiKey,
  });

  // Fetch performance metrics
  const { data: perfData, isLoading: perfLoading, refetch: refetchPerf } = useQuery({
    queryKey: ['admin', 'performance'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/performance`, {
        headers: { 'X-API-Key': apiKey }
      });
      if (!res.ok) throw new Error('Failed to fetch performance');
      return res.json();
    },
    enabled: !!apiKey,
  });

  // Fetch config
  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ['admin', 'config'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/config`, {
        headers: { 'X-API-Key': apiKey }
      });
      if (!res.ok) throw new Error('Failed to fetch config');
      return res.json();
    },
    enabled: !!apiKey,
  });

  // Restart service mutation
  const restartMutation = useMutation({
    mutationFn: async (service) => {
      const res = await fetch(`${API_BASE}/api/admin/services/${service}/restart`, {
        method: 'POST',
        headers: { 'X-API-Key': apiKey }
      });
      if (!res.ok) throw new Error('Failed to restart service');
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Service restarted');
      queryClient.invalidateQueries(['admin', 'services']);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to restart service');
    }
  });

  // Vacuum database mutation
  const vacuumMutation = useMutation({
    mutationFn: async (table) => {
      const res = await fetch(`${API_BASE}/api/admin/database/vacuum`, {
        method: 'POST',
        headers: { 
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ table })
      });
      if (!res.ok) throw new Error('Failed to run vacuum');
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.message || 'VACUUM completed');
      queryClient.invalidateQueries(['admin', 'database']);
      queryClient.invalidateQueries(['admin', 'performance']);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to run vacuum');
    }
  });

  // Refresh all data
  const refreshAll = () => {
    refetchSystem();
    refetchDb();
    refetchServices();
    refetchAnalytics();
    refetchPerf();
  };

  if (!apiKey) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">API Key Required</h3>
        <p className="text-gray-400 text-center max-w-md">
          Configure your API key in Settings → Security to access server administration.
        </p>
      </div>
    );
  }

  if (systemError) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <XCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Authentication Failed</h3>
        <p className="text-gray-400 text-center max-w-md">
          Unable to authenticate with the server. Please check your API key.
        </p>
      </div>
    );
  }

  // Prepare services data
  const services = servicesData?.services ? [
    {
      key: 'database',
      name: 'PostgreSQL',
      status: servicesData.services.database?.status || 'unknown',
      details: {
        'Connection': servicesData.services.database?.connected ? 'Active' : 'Disconnected',
      },
      canRestart: false,
    },
    {
      key: 'twitch',
      name: 'Twitch IRC',
      status: servicesData.services.twitch?.status || 'unknown',
      details: {
        'Username': servicesData.services.twitch?.username || 'N/A',
        'Channels': servicesData.services.twitch?.channels?.length || 0,
      },
      canRestart: true,
    },
    {
      key: 'websocket',
      name: 'WebSocket Server',
      status: servicesData.services.websocket?.status || 'unknown',
      details: {
        'Connected Clients': servicesData.services.websocket?.connectedClients || 0,
      },
      canRestart: false,
    },
    {
      key: 'archive',
      name: 'Archive Service',
      status: servicesData.services.archive?.status || 'unknown',
      details: servicesData.services.archive?.stats ? {
        'Pending Messages': servicesData.services.archive.stats.pendingMessages || 0,
        'Total Archived': formatNumber(servicesData.services.archive.stats.totalArchived || 0),
      } : {},
      canRestart: true,
    },
  ] : [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Server className="w-7 h-7 text-twitch-purple" />
            Server Administration
          </h2>
          <p className="text-gray-400 mt-1">Monitor and manage your Chatterbox server</p>
        </div>
        <button
          onClick={refreshAll}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh All
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Clock}
          label="Server Uptime"
          value={systemData ? formatDuration(systemData.server.uptime) : '...'}
          subValue={systemData ? `Started ${new Date(systemData.server.startTime).toLocaleString()}` : ''}
          color="text-green-400"
        />
        <StatCard
          icon={Users}
          label="WebSocket Clients"
          value={formatNumber(servicesData?.services?.websocket?.connectedClients || 0)}
          color="text-blue-400"
        />
        <StatCard
          icon={Database}
          label="Database Size"
          value={dbData ? formatBytes(dbData.size) : '...'}
          subValue={dbData ? `${dbData.tables.length} tables` : ''}
          color="text-purple-400"
        />
        <StatCard
          icon={Zap}
          label="Cache Hit Ratio"
          value={dbData ? `${dbData.stats.cacheHitRatio}%` : '...'}
          subValue="Database query cache"
          color="text-yellow-400"
        />
      </div>

      {/* Services Status */}
      <CollapsibleSection title="Services Status" icon={Activity} defaultOpen={true}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
          {servicesLoading ? (
            <div className="col-span-4 flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-twitch-purple" />
            </div>
          ) : (
            services.map(service => (
              <ServiceCard 
                key={service.key} 
                service={service} 
                onRestart={(key) => restartMutation.mutate(key)}
              />
            ))
          )}
        </div>
      </CollapsibleSection>

      {/* System Resources */}
      <CollapsibleSection title="System Resources" icon={Cpu} defaultOpen={true}>
        {systemLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-twitch-purple" />
          </div>
        ) : systemData && (
          <div className="pt-4 space-y-6">
            {/* Memory Usage */}
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                <MemoryStick className="w-4 h-4" /> Memory Usage
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <ProgressBar 
                    value={systemData.memory.heapUsed} 
                    max={systemData.memory.heapTotal}
                    label={`Heap Used (${formatBytes(systemData.memory.heapUsed)} / ${formatBytes(systemData.memory.heapTotal)})`}
                    color="bg-blue-500"
                  />
                  <ProgressBar 
                    value={systemData.memory.rss} 
                    max={systemData.memory.systemTotal}
                    label={`RSS (${formatBytes(systemData.memory.rss)})`}
                    color="bg-purple-500"
                  />
                </div>
                <div className="space-y-3">
                  <ProgressBar 
                    value={systemData.memory.systemTotal - systemData.memory.systemFree} 
                    max={systemData.memory.systemTotal}
                    label={`System Memory (${formatBytes(systemData.memory.systemTotal - systemData.memory.systemFree)} / ${formatBytes(systemData.memory.systemTotal)})`}
                    color="bg-green-500"
                  />
                  <div className="text-sm text-gray-400">
                    External: {formatBytes(systemData.memory.external)} | 
                    Array Buffers: {formatBytes(systemData.memory.arrayBuffers)}
                  </div>
                </div>
              </div>
            </div>

            {/* CPU Info */}
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                <Cpu className="w-4 h-4" /> CPU Information
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-700/30 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Cores</p>
                  <p className="text-lg font-semibold text-white">{systemData.cpu.cores}</p>
                </div>
                <div className="bg-gray-700/30 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Speed</p>
                  <p className="text-lg font-semibold text-white">{systemData.cpu.speed} MHz</p>
                </div>
                <div className="bg-gray-700/30 rounded-lg p-3 col-span-2">
                  <p className="text-xs text-gray-400">Model</p>
                  <p className="text-sm font-medium text-white truncate">{systemData.cpu.model}</p>
                </div>
              </div>
              <div className="mt-3 text-sm text-gray-400">
                Load Average: {systemData.cpu.loadAvg.map(l => l.toFixed(2)).join(' | ')}
              </div>
            </div>

            {/* System Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Node.js Version</p>
                <p className="text-white font-medium">{systemData.server.nodeVersion}</p>
              </div>
              <div>
                <p className="text-gray-400">Platform</p>
                <p className="text-white font-medium">{systemData.server.platform} ({systemData.server.arch})</p>
              </div>
              <div>
                <p className="text-gray-400">OS</p>
                <p className="text-white font-medium">{systemData.os.type} {systemData.os.release}</p>
              </div>
              <div>
                <p className="text-gray-400">OS Uptime</p>
                <p className="text-white font-medium">{formatDuration(systemData.os.uptime)}</p>
              </div>
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Database Details */}
      <CollapsibleSection title="Database Details" icon={Database}>
        {dbLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-twitch-purple" />
          </div>
        ) : dbData && (
          <div className="pt-4 space-y-6">
            {/* Connection Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-700/30 rounded-lg p-3">
                <p className="text-xs text-gray-400">Total Connections</p>
                <p className="text-lg font-semibold text-white">{dbData.connections.total}</p>
              </div>
              <div className="bg-gray-700/30 rounded-lg p-3">
                <p className="text-xs text-gray-400">Active</p>
                <p className="text-lg font-semibold text-green-400">{dbData.connections.active}</p>
              </div>
              <div className="bg-gray-700/30 rounded-lg p-3">
                <p className="text-xs text-gray-400">Idle</p>
                <p className="text-lg font-semibold text-yellow-400">{dbData.connections.idle}</p>
              </div>
              <div className="bg-gray-700/30 rounded-lg p-3">
                <p className="text-xs text-gray-400">Transactions</p>
                <p className="text-lg font-semibold text-white">{formatNumber(dbData.stats.transactionsCommitted)}</p>
              </div>
            </div>

            {/* Table Sizes */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-300">Table Sizes</h4>
                <button
                  onClick={() => vacuumMutation.mutate(null)}
                  disabled={vacuumMutation.isPending}
                  className="flex items-center gap-2 px-3 py-1.5 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 rounded-lg text-xs transition-colors disabled:opacity-50"
                >
                  {vacuumMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                  VACUUM All
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 px-4 text-gray-400 font-medium">Table</th>
                      <th className="text-right py-2 px-4 text-gray-400 font-medium">Rows</th>
                      <th className="text-right py-2 px-4 text-gray-400 font-medium">Data Size</th>
                      <th className="text-right py-2 px-4 text-gray-400 font-medium">Index Size</th>
                      <th className="text-right py-2 px-4 text-gray-400 font-medium">Total Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbData.tables.map(table => (
                      <tr key={table.name} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                        <td className="py-2 px-4 text-white font-medium">{table.name}</td>
                        <td className="py-2 px-4 text-right text-gray-300">{formatNumber(table.rowCount)}</td>
                        <td className="py-2 px-4 text-right text-gray-300">{formatBytes(table.tableSize)}</td>
                        <td className="py-2 px-4 text-right text-gray-300">{formatBytes(table.indexesSize)}</td>
                        <td className="py-2 px-4 text-right text-white font-medium">{formatBytes(table.totalSize)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Query Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Tuples Fetched</p>
                <p className="text-white font-medium">{formatNumber(dbData.stats.tuplesFetched)}</p>
              </div>
              <div>
                <p className="text-gray-400">Tuples Inserted</p>
                <p className="text-white font-medium">{formatNumber(dbData.stats.tuplesInserted)}</p>
              </div>
              <div>
                <p className="text-gray-400">Deadlocks</p>
                <p className={`font-medium ${dbData.stats.deadlocks > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {dbData.stats.deadlocks}
                </p>
              </div>
              <div>
                <p className="text-gray-400">Conflicts</p>
                <p className={`font-medium ${dbData.stats.conflicts > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {dbData.stats.conflicts}
                </p>
              </div>
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Analytics */}
      <CollapsibleSection title="Analytics" icon={BarChart3}>
        <div className="pt-4 space-y-4">
          {/* Period Selector */}
          <div className="flex gap-2">
            {['1h', '6h', '24h', '7d', '30d'].map(period => (
              <button
                key={period}
                onClick={() => setAnalyticsPeriod(period)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  analyticsPeriod === period
                    ? 'bg-twitch-purple text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {period}
              </button>
            ))}
          </div>

          {analyticsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-twitch-purple" />
            </div>
          ) : analyticsData && (
            <div className="space-y-6">
              {/* Channel Activity */}
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-3">Channel Activity</h4>
                <div className="space-y-2">
                  {analyticsData.channelActivity.slice(0, 5).map(channel => (
                    <div key={channel.name} className="flex items-center gap-3">
                      <span className="text-gray-400 w-32 truncate">#{channel.displayName || channel.name}</span>
                      <div className="flex-1 h-4 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-twitch-purple"
                          style={{ 
                            width: `${(channel.messageCount / (analyticsData.channelActivity[0]?.messageCount || 1)) * 100}%` 
                          }}
                        />
                      </div>
                      <span className="text-white font-medium w-20 text-right">
                        {formatNumber(channel.messageCount)}
                      </span>
                      <span className="text-gray-400 text-sm w-24 text-right">
                        {channel.uniqueUsers} users
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Chatters */}
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-3">Top Chatters</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {analyticsData.topChatters.slice(0, 10).map((user, i) => (
                    <div key={user.username} className="bg-gray-700/30 rounded-lg p-2 flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? 'bg-yellow-500 text-black' :
                        i === 1 ? 'bg-gray-300 text-black' :
                        i === 2 ? 'bg-orange-500 text-black' :
                        'bg-gray-600 text-white'
                      }`}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{user.displayName || user.username}</p>
                        <p className="text-xs text-gray-400">{formatNumber(user.messageCount)} msgs</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mod Action Breakdown */}
              {analyticsData.modActionBreakdown.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-3">Mod Actions</h4>
                  <div className="flex flex-wrap gap-2">
                    {analyticsData.modActionBreakdown.map(action => (
                      <div key={action.actionType} className="bg-gray-700/30 rounded-lg px-3 py-2">
                        <span className="text-gray-400 text-sm">{action.actionType}</span>
                        <span className="ml-2 text-white font-medium">{formatNumber(action.count)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Peak Hours */}
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-3">Peak Hours (30 day avg)</h4>
                <div className="flex items-end gap-1 h-24">
                  {analyticsData.peakHours.map(hour => {
                    const maxCount = Math.max(...analyticsData.peakHours.map(h => h.count));
                    const height = maxCount > 0 ? (hour.count / maxCount) * 100 : 0;
                    return (
                      <div 
                        key={hour.hour}
                        className="flex-1 bg-twitch-purple/50 hover:bg-twitch-purple transition-colors rounded-t cursor-pointer group relative"
                        style={{ height: `${height}%`, minHeight: '4px' }}
                        title={`${hour.hour}:00 - ${formatNumber(hour.count)} messages`}
                      >
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 px-2 py-1 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                          {hour.hour}:00 - {formatNumber(hour.count)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>00:00</span>
                  <span>06:00</span>
                  <span>12:00</span>
                  <span>18:00</span>
                  <span>24:00</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Performance */}
      <CollapsibleSection title="Performance Metrics" icon={Zap}>
        {perfLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-twitch-purple" />
          </div>
        ) : perfData && (
          <div className="pt-4 space-y-6">
            {/* Table Bloat */}
            {perfData.tableBloat.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-3">Table Bloat (Dead Tuples)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-2 px-4 text-gray-400 font-medium">Table</th>
                        <th className="text-right py-2 px-4 text-gray-400 font-medium">Dead Tuples</th>
                        <th className="text-right py-2 px-4 text-gray-400 font-medium">Live Tuples</th>
                        <th className="text-right py-2 px-4 text-gray-400 font-medium">Bloat %</th>
                        <th className="text-right py-2 px-4 text-gray-400 font-medium">Last Vacuum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perfData.tableBloat.map(table => (
                        <tr key={table.tableName} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                          <td className="py-2 px-4 text-white font-medium">{table.tableName}</td>
                          <td className="py-2 px-4 text-right text-gray-300">{formatNumber(table.deadTuples)}</td>
                          <td className="py-2 px-4 text-right text-gray-300">{formatNumber(table.liveTuples)}</td>
                          <td className={`py-2 px-4 text-right font-medium ${
                            table.deadTuplePercent > 20 ? 'text-red-400' :
                            table.deadTuplePercent > 10 ? 'text-yellow-400' : 'text-green-400'
                          }`}>
                            {table.deadTuplePercent}%
                          </td>
                          <td className="py-2 px-4 text-right text-gray-400 text-xs">
                            {table.lastAutovacuum ? new Date(table.lastAutovacuum).toLocaleString() : 'Never'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Index Usage */}
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-3">Index Usage</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 px-4 text-gray-400 font-medium">Index</th>
                      <th className="text-right py-2 px-4 text-gray-400 font-medium">Scans</th>
                      <th className="text-right py-2 px-4 text-gray-400 font-medium">Tuples Read</th>
                      <th className="text-right py-2 px-4 text-gray-400 font-medium">Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perfData.indexUsage.slice(0, 10).map(idx => (
                      <tr key={idx.indexName} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                        <td className="py-2 px-4">
                          <div className="text-white font-medium">{idx.indexName}</div>
                          <div className="text-xs text-gray-500">{idx.tableName}</div>
                        </td>
                        <td className="py-2 px-4 text-right text-gray-300">{formatNumber(idx.scans)}</td>
                        <td className="py-2 px-4 text-right text-gray-300">{formatNumber(idx.tuplesRead)}</td>
                        <td className="py-2 px-4 text-right text-gray-300">{formatBytes(idx.indexSize)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Configuration */}
      <CollapsibleSection title="Configuration" icon={Settings2}>
        {configLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-twitch-purple" />
          </div>
        ) : configData && (
          <div className="pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Server Config */}
              <div className="bg-gray-700/30 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <Server className="w-4 h-4" /> Server
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Port</span>
                    <span className="text-white">{configData.server.port}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Environment</span>
                    <span className={`${configData.server.nodeEnv === 'production' ? 'text-green-400' : 'text-yellow-400'}`}>
                      {configData.server.nodeEnv}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Log Level</span>
                    <span className="text-white">{configData.server.logLevel}</span>
                  </div>
                </div>
              </div>

              {/* Database Config */}
              <div className="bg-gray-700/30 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <Database className="w-4 h-4" /> Database
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Host</span>
                    <span className="text-white">{configData.database.host}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Port</span>
                    <span className="text-white">{configData.database.port}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Database</span>
                    <span className="text-white">{configData.database.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">User</span>
                    <span className="text-white">{configData.database.user}</span>
                  </div>
                </div>
              </div>

              {/* Twitch Config */}
              <div className="bg-gray-700/30 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Twitch
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Username</span>
                    <span className="text-white">{configData.twitch.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Channels</span>
                    <span className="text-white">{configData.twitch.channels.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">API Key</span>
                    <span className={configData.features.apiKeyConfigured ? 'text-green-400' : 'text-red-400'}>
                      {configData.features.apiKeyConfigured ? 'Configured' : 'Not Set'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Channels List */}
            {configData.twitch.channels.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-2">Configured Channels</h4>
                <div className="flex flex-wrap gap-2">
                  {configData.twitch.channels.map(ch => (
                    <span key={ch} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 rounded text-sm text-gray-300">
                      <Hash className="w-3 h-3" />
                      {ch}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}

export default ServerStatusTab;
