import { useMemo } from 'react';

/**
 * Format date to locale string
 */
const formatDate = (dateStr) => {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleString();
};

/**
 * Check if a rule is expired
 */
const isExpired = (expiresAt) => {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
};

/**
 * Check if rule expires soon (within 24 hours)
 */
const expiresSoon = (expiresAt) => {
  if (!expiresAt) return false;
  const expires = new Date(expiresAt);
  const now = new Date();
  const dayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return expires > now && expires < dayFromNow;
};

/**
 * Rules management table
 */
export default function RulesTable({
  rulesData,
  searchTerm,
  filterType,
  selectedRules,
  onSelectRule,
  onSelectAll,
  onRemoveRule,
  onQuickAction,
  isLoading,
  error,
}) {
  // Filter rules
  const filteredRules = useMemo(() => {
    return (rulesData?.data?.rules || []).filter((rule) => {
      const ip = rule.ip_address || rule.ip;
      const matchesSearch = !searchTerm || ip.includes(searchTerm);
      const matchesType = filterType === 'all' || rule.rule_type === filterType || rule.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [rulesData?.data?.rules, searchTerm, filterType]);

  const allSelected = filteredRules.length > 0 && filteredRules.every(r => selectedRules.has(r.id));
  const someSelected = filteredRules.some(r => selectedRules.has(r.id));

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 text-red-400">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Failed to load IP rules: {error.message}
        </div>
      </div>
    );
  }

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
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                IP Address
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                Reason
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                Expires
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                Created
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filteredRules.map((rule) => {
              const ip = rule.ip_address || rule.ip;
              const ruleType = rule.rule_type || rule.type;
              const rateLimit = rule.rate_limit_override || rule.rate_limit;
              const isSelected = selectedRules.has(rule.id);
              const expired = isExpired(rule.expires_at);
              const expiringSoon = expiresSoon(rule.expires_at);

              return (
                <tr
                  key={rule.id || ip}
                  className={`hover:bg-gray-750 ${isSelected ? 'bg-purple-900/20' : ''} ${expired ? 'opacity-50' : ''}`}
                >
                  {/* Checkbox */}
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onSelectRule(rule.id)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500"
                    />
                  </td>

                  {/* IP Address */}
                  <td className="px-4 py-3">
                    <span className="text-white font-mono text-sm">{ip}</span>
                  </td>

                  {/* Type */}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded ${
                        ruleType === 'block'
                          ? 'bg-red-500/20 text-red-400'
                          : ruleType === 'rate-limit'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-green-500/20 text-green-400'
                      }`}
                    >
                      {ruleType === 'block'
                        ? 'Blocked'
                        : ruleType === 'rate-limit'
                        ? `Rate: ${rateLimit}/min`
                        : 'Whitelisted'}
                    </span>
                  </td>

                  {/* Reason */}
                  <td className="px-4 py-3 text-gray-400 text-sm max-w-xs">
                    <span className="truncate block" title={rule.reason}>
                      {rule.reason || '-'}
                    </span>
                  </td>

                  {/* Expires */}
                  <td className="px-4 py-3 text-sm">
                    {rule.expires_at ? (
                      <div className="flex items-center gap-1.5">
                        {expired ? (
                          <span className="text-red-400">Expired</span>
                        ) : expiringSoon ? (
                          <>
                            <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                            <span className="text-orange-400">{formatDate(rule.expires_at)}</span>
                          </>
                        ) : (
                          <span className="text-gray-400">{formatDate(rule.expires_at)}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-500">Never</span>
                    )}
                  </td>

                  {/* Created */}
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {formatDate(rule.created_at)}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Convert to different type */}
                      {ruleType !== 'block' && (
                        <button
                          onClick={() => onQuickAction(ip, 'block')}
                          className="px-2 py-1 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors"
                          title="Convert to block"
                        >
                          Block
                        </button>
                      )}
                      {ruleType !== 'whitelist' && (
                        <button
                          onClick={() => onQuickAction(ip, 'whitelist')}
                          className="px-2 py-1 text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded transition-colors"
                          title="Convert to whitelist"
                        >
                          Trust
                        </button>
                      )}
                      {/* Delete */}
                      <button
                        onClick={() => onRemoveRule(rule.id, ip)}
                        className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                        title="Remove rule"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {filteredRules.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
              <span>Loading rules...</span>
            </div>
          ) : searchTerm || filterType !== 'all' ? (
            <div className="flex flex-col items-center gap-2">
              <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span>No rules matching your filters</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>No IP rules configured</span>
              <p className="text-sm text-gray-600">Click "Add Rule" to create your first rule</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
