import { useState, useEffect, useMemo } from 'react';
import { tiersApi } from '../../services/api';
import { useToastStore } from '../../stores/toastStore';
import {
  BarChart3,
  TrendingUp,
  Users,
  Clock,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Calendar,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Zap,
  Server,
  Trash2,
} from 'lucide-react';

// Simple bar chart component
function SimpleBarChart({ data, labelKey, valueKey, maxBars = 10, color = 'bg-twitch-purple' }) {
  const sortedData = [...data].sort((a, b) => b[valueKey] - a[valueKey]).slice(0, maxBars);
  const maxValue = Math.max(...sortedData.map(d => d[valueKey]));

  if (sortedData.length === 0) {
    return <div className="text-center text-gray-400 py-4">No data available</div>;
  }

  return (
    <div className="space-y-2">
      {sortedData.map((item, index) => (
        <div key={index} className="flex items-center gap-3">
          <div className="w-32 truncate text-sm text-gray-400" title={item[labelKey]}>
            {item[labelKey]}
          </div>
          <div className="flex-1 h-6 bg-twitch-dark rounded-full overflow-hidden">
            <div
              className={`h-full ${color} rounded-full transition-all duration-500`}
              style={{ width: `${Math.max((item[valueKey] / maxValue) * 100, 2)}%` }}
            />
          </div>
          <div className="w-16 text-right text-sm text-white font-medium">
            {item[valueKey].toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

// Time series chart component (simplified)
function TimeSeriesChart({ data, height = 120 }) {
  if (!data || data.length === 0) {
    return <div className="text-center text-gray-400 py-8">No data available</div>;
  }

  const maxValue = Math.max(...data.map(d => d.call_count || d.callCount || 0));
  const points = data.map((d, i) => ({
    x: (i / (data.length - 1 || 1)) * 100,
    y: 100 - ((d.call_count || d.callCount || 0) / (maxValue || 1)) * 100,
    value: d.call_count || d.callCount || 0,
    time: d.time_bucket || d.timestamp,
  }));

  // Create SVG path
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L 100 100 L 0 100 Z`;

  return (
    <div className="relative" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        {/* Grid lines */}
        <line x1="0" y1="25" x2="100" y2="25" stroke="#3d3d40" strokeWidth="0.5" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="#3d3d40" strokeWidth="0.5" />
        <line x1="0" y1="75" x2="100" y2="75" stroke="#3d3d40" strokeWidth="0.5" />
        
        {/* Area fill */}
        <path d={areaD} fill="url(#gradient)" opacity="0.3" />
        
        {/* Line */}
        <path d={pathD} fill="none" stroke="#9147ff" strokeWidth="2" />
        
        {/* Gradient definition */}
        <defs>
          <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9147ff" />
            <stop offset="100%" stopColor="#9147ff" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Labels */}
      <div className="absolute left-0 top-0 text-xs text-gray-400">{maxValue.toLocaleString()}</div>
      <div className="absolute left-0 bottom-0 text-xs text-gray-400">0</div>
    </div>
  );
}

// Stat card component
function StatCard({ icon: Icon, label, value, subValue, trend, color = 'text-twitch-purple' }) {
  return (
    <div className="bg-twitch-gray rounded-xl p-4 border border-gray-700">
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg bg-twitch-dark ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-sm ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-sm text-gray-400">{label}</div>
        {subValue && <div className="text-xs text-gray-500 mt-1">{subValue}</div>}
      </div>
    </div>
  );
}

// Distribution pie chart (simplified as bar segments)
function DistributionChart({ data, colorMap }) {
  const total = data.reduce((sum, d) => sum + parseInt(d.count || 0), 0);
  
  if (total === 0) {
    return <div className="text-center text-gray-400 py-4">No data available</div>;
  }

  return (
    <div className="space-y-3">
      {/* Bar */}
      <div className="h-4 rounded-full overflow-hidden flex">
        {data.map((item, index) => (
          <div
            key={index}
            className={`${colorMap[item.category] || colorMap[item.bucket] || 'bg-gray-600'} transition-all duration-500`}
            style={{ width: `${(parseInt(item.count) / total) * 100}%` }}
            title={`${item.category || item.bucket}: ${item.count}`}
          />
        ))}
      </div>
      
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {data.map((item, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div className={`w-3 h-3 rounded ${colorMap[item.category] || colorMap[item.bucket] || 'bg-gray-600'}`} />
            <span className="text-gray-400">{item.category || item.bucket}</span>
            <span className="text-white font-medium">{parseInt(item.count).toLocaleString()}</span>
            <span className="text-gray-500">({Math.round((parseInt(item.count) / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UsageAnalytics() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [timeRange, setTimeRange] = useState('24h');
  const [refreshing, setRefreshing] = useState(false);
  const addToast = useToastStore((state) => state.addToast);

  const getDateRange = () => {
    const now = new Date();
    const until = now.toISOString();
    let since;

    switch (timeRange) {
      case '1h':
        since = new Date(now - 60 * 60 * 1000).toISOString();
        break;
      case '6h':
        since = new Date(now - 6 * 60 * 60 * 1000).toISOString();
        break;
      case '24h':
        since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
        break;
      case '7d':
        since = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case '30d':
        since = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
      default:
        since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    }

    return { since, until, bucket: timeRange === '7d' || timeRange === '30d' ? 'day' : 'hour' };
  };

  const fetchData = async () => {
    try {
      const { since, until, bucket } = getDateRange();
      const response = await tiersApi.getSystemUsage({ since, until, bucket });
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch usage data:', error);
      addToast('Failed to fetch usage analytics', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleAggregation = async () => {
    try {
      await tiersApi.triggerAggregation();
      addToast('Aggregation triggered successfully', 'success');
    } catch (error) {
      addToast('Failed to trigger aggregation', 'error');
    }
  };

  const handleCleanup = async () => {
    if (!confirm('This will delete API usage records older than 90 days. Continue?')) return;
    
    try {
      const response = await tiersApi.triggerCleanup(90);
      addToast(`Cleanup completed: ${response.data.usageRecordsDeleted} records deleted`, 'success');
    } catch (error) {
      addToast('Failed to run cleanup', 'error');
    }
  };

  const statusColorMap = {
    '2xx Success': 'bg-green-500',
    '3xx Redirect': 'bg-blue-500',
    '4xx Client Error': 'bg-yellow-500',
    '5xx Server Error': 'bg-red-500',
    'Unknown': 'bg-gray-500',
  };

  const responseTimeColorMap = {
    '< 100ms': 'bg-green-500',
    '100-500ms': 'bg-lime-500',
    '500ms-1s': 'bg-yellow-500',
    '1-5s': 'bg-orange-500',
    '> 5s': 'bg-red-500',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-twitch-purple" />
      </div>
    );
  }

  const stats = data?.stats || {};
  const timeline = data?.timeline || [];
  const topUsers = data?.topUsers || [];
  const topEndpoints = data?.topEndpoints || [];
  const distributions = data?.distributions || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-twitch-purple" />
            Usage Analytics
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Monitor API usage and system performance
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Time range selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-twitch-dark border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-twitch-purple"
          >
            <option value="1h">Last Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 bg-twitch-dark hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          
          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-2 bg-twitch-dark hover:bg-gray-700 text-white rounded-lg transition-colors">
              <Server className="w-4 h-4" />
              Maintenance
            </button>
            <div className="absolute right-0 top-full mt-1 bg-twitch-gray border border-gray-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={handleAggregation}
                className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-twitch-dark hover:text-white"
              >
                Run Aggregation
              </button>
              <button
                onClick={handleCleanup}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-twitch-dark flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Cleanup Old Data
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Activity}
          label="Total API Calls"
          value={(parseInt(stats.total_calls) || 0).toLocaleString()}
          color="text-twitch-purple"
        />
        <StatCard
          icon={Users}
          label="Unique Users"
          value={(parseInt(stats.unique_users) || 0).toLocaleString()}
          color="text-blue-400"
        />
        <StatCard
          icon={Clock}
          label="Avg Response Time"
          value={`${parseInt(stats.avg_response_time) || 0}ms`}
          color="text-green-400"
        />
        <StatCard
          icon={AlertTriangle}
          label="Errors"
          value={(parseInt(stats.total_errors) || 0).toLocaleString()}
          subValue={`${parseInt(stats.server_errors) || 0} server errors`}
          color="text-red-400"
        />
      </div>

      {/* Timeline chart */}
      <div className="bg-twitch-gray rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">API Calls Over Time</h3>
        <TimeSeriesChart data={timeline} height={150} />
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>{timeline[0]?.time_bucket ? new Date(timeline[0].time_bucket).toLocaleString() : 'Start'}</span>
          <span>{timeline[timeline.length - 1]?.time_bucket ? new Date(timeline[timeline.length - 1].time_bucket).toLocaleString() : 'End'}</span>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Users */}
        <div className="bg-twitch-gray rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Top Users by API Calls
          </h3>
          {topUsers.length === 0 ? (
            <div className="text-center text-gray-400 py-8">No user data available</div>
          ) : (
            <div className="space-y-3">
              {topUsers.slice(0, 10).map((user, index) => (
                <div key={user.user_id || index} className="flex items-center gap-3">
                  <span className="text-gray-500 w-5 text-sm">{index + 1}</span>
                  <img
                    src={user.profile_image_url || '/default-avatar.png'}
                    alt={user.display_name || user.username}
                    className="w-8 h-8 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium truncate">
                        {user.display_name || user.username || 'Unknown'}
                      </span>
                      {user.is_admin && (
                        <span className="px-1.5 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded">
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {user.error_count > 0 && (
                        <span className="text-red-400">{user.error_count} errors • </span>
                      )}
                      {user.avg_response_time}ms avg
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-medium">{parseInt(user.call_count).toLocaleString()}</div>
                    <div className="text-xs text-gray-500">calls</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Endpoints */}
        <div className="bg-twitch-gray rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Top Endpoints
          </h3>
          {topEndpoints.length === 0 ? (
            <div className="text-center text-gray-400 py-8">No endpoint data available</div>
          ) : (
            <div className="space-y-3">
              {topEndpoints.slice(0, 10).map((endpoint, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 text-xs font-mono rounded ${
                    endpoint.method === 'GET' ? 'bg-blue-500/20 text-blue-400' :
                    endpoint.method === 'POST' ? 'bg-green-500/20 text-green-400' :
                    endpoint.method === 'PUT' || endpoint.method === 'PATCH' ? 'bg-yellow-500/20 text-yellow-400' :
                    endpoint.method === 'DELETE' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {endpoint.method}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-mono truncate" title={endpoint.endpoint}>
                      {endpoint.endpoint}
                    </div>
                    <div className="text-xs text-gray-500">
                      {endpoint.unique_users} users • {endpoint.avg_response_time}ms avg
                      {endpoint.p95_response_time && ` • P95: ${endpoint.p95_response_time}ms`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-medium">{parseInt(endpoint.call_count).toLocaleString()}</div>
                    {endpoint.error_count > 0 && (
                      <div className="text-xs text-red-400">{endpoint.error_count} errors</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Distributions */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Status Code Distribution */}
        <div className="bg-twitch-gray rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            Response Status Distribution
          </h3>
          <DistributionChart 
            data={distributions.statusCode || []} 
            colorMap={statusColorMap}
          />
        </div>

        {/* Response Time Distribution */}
        <div className="bg-twitch-gray rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            Response Time Distribution
          </h3>
          <DistributionChart 
            data={distributions.responseTime || []} 
            colorMap={responseTimeColorMap}
          />
        </div>
      </div>
    </div>
  );
}
