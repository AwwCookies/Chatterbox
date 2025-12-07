import { useMemo } from 'react';

/**
 * Get severity color based on request rate
 */
const getRateColor = (rate) => {
  if (rate >= 10) return 'text-red-400';
  if (rate >= 5) return 'text-yellow-400';
  return 'text-green-400';
};

/**
 * Get threat level based on IP behavior
 */
const getThreatLevel = (ipData) => {
  const { requestsPerSecond, requestCount, maxRequests } = ipData;
  const usagePercent = (requestCount / maxRequests) * 100;

  if (ipData.isBlocked) return { level: 'blocked', label: 'Blocked', color: 'bg-red-500' };
  if (requestsPerSecond >= 15 || usagePercent >= 95) return { level: 'critical', label: 'Critical', color: 'bg-red-500' };
  if (requestsPerSecond >= 8 || usagePercent >= 75) return { level: 'high', label: 'High', color: 'bg-orange-500' };
  if (requestsPerSecond >= 4 || usagePercent >= 50) return { level: 'medium', label: 'Medium', color: 'bg-yellow-500' };
  return { level: 'low', label: 'Low', color: 'bg-green-500' };
};

/**
 * Live traffic monitoring table
 */
export default function LiveTrafficTable({
  liveData,
  rulesData,
  searchTerm,
  sort,
  onToggleSort,
  selectedIps,
  onSelectIp,
  onSelectAll,
  onQuickAction,
  onRemoveRule,
  isLoading,
}) {
  // Process and sort live IPs
  const sortedLiveIps = useMemo(() => {
    const ips = liveData?.data?.activeIps || [];
    const filtered = ips.filter(ip => !searchTerm || ip.ip.includes(searchTerm));

    return [...filtered].sort((a, b) => {
      const aVal = a[sort.field];
      const bVal = b[sort.field];
      const dir = sort.dir === 'desc' ? -1 : 1;
      if (typeof aVal === 'number') return (aVal - bVal) * dir;
      return String(aVal).localeCompare(String(bVal)) * dir;
    });
  }, [liveData?.data?.activeIps, searchTerm, sort]);

  // Get existing rule for an IP
  const getExistingRule = (ip) => {
    return rulesData?.data?.rules?.find(r => (r.ip_address || r.ip) === ip);
  };

  const allSelected = sortedLiveIps.length > 0 && sortedLiveIps.every(ip => selectedIps.has(ip.ip));
  const someSelected = sortedLiveIps.some(ip => selectedIps.has(ip.ip));

  const SortIcon = ({ field }) => {
    if (sort.field !== field) return null;
    return <span className="ml-1">{sort.dir === 'desc' ? '↓' : '↑'}</span>;
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-900/50">
            <tr>
              {/* Checkbox column */}
              <th className="px-3 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => el && (el.indeterminate = someSelected && !allSelected)}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500"
                />
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase cursor-pointer hover:text-white"
                onClick={() => onToggleSort('ip')}
              >
                IP Address <SortIcon field="ip" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                Threat
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase cursor-pointer hover:text-white"
                onClick={() => onToggleSort('requestCount')}
              >
                Requests <SortIcon field="requestCount" />
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase cursor-pointer hover:text-white"
                onClick={() => onToggleSort('requestsPerSecond')}
              >
                Rate/sec <SortIcon field="requestsPerSecond" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                Limit
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                Quick Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {sortedLiveIps.map((ipData) => {
              const existingRule = getExistingRule(ipData.ip);
              const usagePercent = ipData.percentOfLimit || (ipData.requestCount / ipData.maxRequests) * 100;
              const threat = getThreatLevel(ipData);
              const isSelected = selectedIps.has(ipData.ip);
              const ruleType = existingRule?.rule_type || existingRule?.type;

              return (
                <tr
                  key={ipData.ip}
                  className={`hover:bg-gray-750 ${isSelected ? 'bg-purple-900/20' : ''}`}
                >
                  {/* Checkbox */}
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onSelectIp(ipData.ip)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500"
                    />
                  </td>

                  {/* IP Address */}
                  <td className="px-4 py-3">
                    <span className="text-white font-mono text-sm">{ipData.ip}</span>
                  </td>

                  {/* Threat Level */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${threat.color} bg-opacity-20 text-white`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${threat.color}`}></span>
                      {threat.label}
                    </span>
                  </td>

                  {/* Requests */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{ipData.requestCount}</span>
                      <span className="text-gray-500 text-sm">/ {ipData.maxRequests}</span>
                    </div>
                    <div className="w-24 h-1.5 bg-gray-700 rounded-full mt-1">
                      <div
                        className={`h-full rounded-full transition-all ${
                          usagePercent >= 80 ? 'bg-red-500' :
                          usagePercent >= 50 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(usagePercent, 100)}%` }}
                      />
                    </div>
                  </td>

                  {/* Rate/sec */}
                  <td className="px-4 py-3">
                    <span className={`font-medium ${getRateColor(ipData.requestsPerSecond)}`}>
                      {ipData.requestsPerSecond?.toFixed(2) || '0.00'}/s
                    </span>
                  </td>

                  {/* Limit */}
                  <td className="px-4 py-3 text-sm">
                    {ipData.hasCustomLimit ? (
                      <span className="text-yellow-400">{ipData.maxRequests}/min (custom)</span>
                    ) : (
                      <span className="text-gray-400">{ipData.maxRequests}/min</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    {ipData.isBlocked ? (
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-500/20 text-red-400">
                        Blocked
                      </span>
                    ) : ruleType === 'whitelist' ? (
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-500/20 text-green-400">
                        Whitelisted
                      </span>
                    ) : ruleType === 'rate-limit' ? (
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-500/20 text-yellow-400">
                        Rate Limited
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-500/20 text-gray-400">
                        Normal
                      </span>
                    )}
                  </td>

                  {/* Quick Actions */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Block */}
                      {!ipData.isBlocked && (
                        <button
                          onClick={() => onQuickAction(ipData.ip, 'block')}
                          className="px-2 py-1 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors"
                          title="Block this IP"
                        >
                          Block
                        </button>
                      )}

                      {/* Rate Limit */}
                      {ruleType !== 'rate-limit' && (
                        <button
                          onClick={() => onQuickAction(ipData.ip, 'rate-limit')}
                          className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 rounded transition-colors"
                          title="Set custom rate limit"
                        >
                          Limit
                        </button>
                      )}

                      {/* Whitelist */}
                      {ruleType !== 'whitelist' && (
                        <button
                          onClick={() => onQuickAction(ipData.ip, 'whitelist')}
                          className="px-2 py-1 text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded transition-colors"
                          title="Whitelist this IP"
                        >
                          Trust
                        </button>
                      )}

                      {/* Clear existing rule */}
                      {existingRule && (
                        <button
                          onClick={() => onRemoveRule(existingRule.id, ipData.ip)}
                          className="px-2 py-1 text-xs bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 rounded transition-colors"
                          title="Remove existing rule"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {sortedLiveIps.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
              <span>Loading traffic data...</span>
            </div>
          ) : searchTerm ? (
            <div className="flex flex-col items-center gap-2">
              <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>No IPs matching "{searchTerm}"</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
              <span>No active IPs in the current time window</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
