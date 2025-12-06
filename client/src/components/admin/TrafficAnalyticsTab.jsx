import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../services/api';

const TIME_RANGES = [
  { value: 'hour', label: 'Last Hour' },
  { value: 'day', label: 'Last 24 Hours' },
  { value: 'week', label: 'Last 7 Days' },
];

export default function TrafficAnalyticsTab() {
  const [timeRange, setTimeRange] = useState('day');
  const [sortBy, setSortBy] = useState('requests');
  const [sortDir, setSortDir] = useState('desc');
  const [searchIp, setSearchIp] = useState('');

  // Fetch traffic data
  const { data: trafficData, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'traffic', timeRange],
    queryFn: () => adminApi.getTrafficStats(timeRange),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const stats = trafficData?.data?.stats;

  // Sort and filter IP stats
  const sortedIpStats = useMemo(() => {
    if (!stats?.topIps) return [];

    let filtered = stats.topIps.map((item) => ({
      ip: item.ip,
      requests: item.requests,
      avgResponseTime: item.avgResponseTime,
      errors: 0, // Not tracked per-IP currently
      lastSeen: null,
    }));

    // Filter by search
    if (searchIp) {
      filtered = filtered.filter((item) => item.ip.includes(searchIp));
    }

    // Sort
    filtered.sort((a, b) => {
      const aVal = sortBy === 'requests' ? a.requests : sortBy === 'errors' ? a.errors : new Date(a.lastSeen);
      const bVal = sortBy === 'requests' ? b.requests : sortBy === 'errors' ? b.errors : new Date(b.lastSeen);
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return filtered;
  }, [stats?.ipStats, searchIp, sortBy, sortDir]);

  // Format time ago
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Handle sort toggle
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 text-red-400">
        Failed to load traffic data: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-xl font-semibold text-white">Traffic Analytics</h2>
          <p className="text-gray-400 text-sm mt-1">Monitor server traffic and identify potential issues</p>
        </div>

        <div className="flex gap-2 items-center">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-purple-500 focus:outline-none"
          >
            {TIME_RANGES.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => refetch()}
            className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            title="Refresh"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Total Requests</div>
          <div className="text-2xl font-bold text-white mt-1">
            {stats?.summary?.totalRequests?.toLocaleString() || 0}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Unique IPs</div>
          <div className="text-2xl font-bold text-white mt-1">
            {stats?.summary?.uniqueIps?.toLocaleString() || 0}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Avg Response</div>
          <div className="text-2xl font-bold text-green-400 mt-1">
            {stats?.summary?.avgResponseTime || 0}ms
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Error Rate</div>
          <div className="text-2xl font-bold text-yellow-400 mt-1">
            {stats?.summary?.errorRate || 0}%
          </div>
        </div>
      </div>

      {/* Top Endpoints */}
      {stats?.topPaths && stats.topPaths.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          <div className="px-4 py-3 border-b border-gray-700">
            <h3 className="font-medium text-white">Top Endpoints</h3>
          </div>
          <div className="divide-y divide-gray-700">
            {stats.topPaths.slice(0, 10).map((endpoint, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded ${
                      endpoint.method === 'GET'
                        ? 'bg-green-500/20 text-green-400'
                        : endpoint.method === 'POST'
                        ? 'bg-blue-500/20 text-blue-400'
                        : endpoint.method === 'DELETE'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}
                  >
                    {endpoint.method}
                  </span>
                  <span className="text-white font-mono text-sm">{endpoint.path}</span>
                </div>
                <span className="text-gray-400">{endpoint.requests.toLocaleString()} requests</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* IP Traffic Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="px-4 py-3 border-b border-gray-700 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
          <h3 className="font-medium text-white">Traffic by IP</h3>
          <input
            type="text"
            placeholder="Filter by IP..."
            value={searchIp}
            onChange={(e) => setSearchIp(e.target.value)}
            className="bg-gray-700 text-white rounded px-3 py-1.5 text-sm border border-gray-600 focus:border-purple-500 focus:outline-none"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-750">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  IP Address
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase cursor-pointer hover:text-white"
                  onClick={() => handleSort('requests')}
                >
                  <div className="flex items-center gap-1">
                    Requests
                    {sortBy === 'requests' && (
                      <span>{sortDir === 'desc' ? '↓' : '↑'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase cursor-pointer hover:text-white"
                  onClick={() => handleSort('errors')}
                >
                  <div className="flex items-center gap-1">
                    Errors
                    {sortBy === 'errors' && (
                      <span>{sortDir === 'desc' ? '↓' : '↑'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase cursor-pointer hover:text-white"
                  onClick={() => handleSort('lastSeen')}
                >
                  <div className="flex items-center gap-1">
                    Last Seen
                    {sortBy === 'lastSeen' && (
                      <span>{sortDir === 'desc' ? '↓' : '↑'}</span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {sortedIpStats.slice(0, 50).map((item) => (
                <tr key={item.ip} className="hover:bg-gray-750">
                  <td className="px-4 py-3">
                    <span className="text-white font-mono text-sm">{item.ip}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {item.requests.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={item.errors > 0 ? 'text-red-400' : 'text-gray-500'}>
                      {item.errors.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {formatTimeAgo(item.lastSeen)}
                  </td>
                  <td className="px-4 py-3">
                    {item.blocked ? (
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-500/20 text-red-400">
                        Blocked
                      </span>
                    ) : item.rateLimited ? (
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-500/20 text-yellow-400">
                        Rate Limited
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-500/20 text-green-400">
                        Active
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sortedIpStats.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {searchIp ? `No IPs matching "${searchIp}"` : 'No traffic data available'}
          </div>
        )}

        {sortedIpStats.length > 50 && (
          <div className="px-4 py-3 text-center text-gray-500 text-sm border-t border-gray-700">
            Showing 50 of {sortedIpStats.length} IPs
          </div>
        )}
      </div>
    </div>
  );
}
