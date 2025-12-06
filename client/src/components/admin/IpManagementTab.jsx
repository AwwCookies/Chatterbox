import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import { useToast } from '../../stores/toastStore';

export default function IpManagementTab() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRule, setNewRule] = useState({
    ip: '',
    type: 'block',
    reason: '',
    rateLimit: 100,
    expiresAt: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Fetch IP rules
  const { data: rulesData, isLoading, error } = useQuery({
    queryKey: ['admin', 'ip-rules'],
    queryFn: () => adminApi.getIpRules(),
  });

  // Add IP rule mutation - handles block, rate-limit, and whitelist
  const addRuleMutation = useMutation({
    mutationFn: (rule) => {
      if (rule.type === 'block') {
        return adminApi.blockIp(rule.ip, rule.reason, rule.expiresAt || null);
      } else if (rule.type === 'rate-limit') {
        return adminApi.setIpRateLimit(rule.ip, rule.rateLimit, rule.expiresAt || null);
      } else {
        // whitelist - use rate limit with null to bypass
        return adminApi.setIpRateLimit(rule.ip, null, rule.expiresAt || null);
      }
    },
    onSuccess: () => {
      addToast('IP rule added successfully', 'success');
      queryClient.invalidateQueries(['admin', 'ip-rules']);
      queryClient.invalidateQueries(['admin', 'traffic']);
      setShowAddModal(false);
      setNewRule({ ip: '', type: 'block', reason: '', rateLimit: 100, expiresAt: '' });
    },
    onError: (err) => {
      addToast(err.response?.data?.error || 'Failed to add IP rule', 'error');
    },
  });

  // Remove IP rule mutation
  const removeRuleMutation = useMutation({
    mutationFn: (id) => adminApi.deleteIpRule(id),
    onSuccess: () => {
      addToast('IP rule removed successfully', 'success');
      queryClient.invalidateQueries(['admin', 'ip-rules']);
      queryClient.invalidateQueries(['admin', 'traffic']);
    },
    onError: (err) => {
      addToast(err.response?.data?.error || 'Failed to remove IP rule', 'error');
    },
  });

  // Filter rules - database uses ip_address column
  const filteredRules = (rulesData?.data?.rules || []).filter((rule) => {
    const ip = rule.ip_address || rule.ip;
    const matchesSearch = !searchTerm || ip.includes(searchTerm);
    const matchesType = filterType === 'all' || rule.rule_type === filterType || rule.type === filterType;
    return matchesSearch && matchesType;
  });

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  // Check if rule is expired
  const isExpired = (expiresAt) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  // Handle form submit
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newRule.ip) {
      addToast('IP address is required', 'error');
      return;
    }
    addRuleMutation.mutate({
      ...newRule,
      expiresAt: newRule.expiresAt || null,
      rateLimit: newRule.type === 'rate-limit' ? newRule.rateLimit : undefined,
    });
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
        Failed to load IP rules: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-xl font-semibold text-white">IP Management</h2>
          <p className="text-gray-400 text-sm mt-1">
            Block IPs, set custom rate limits, or whitelist trusted addresses
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Rule
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search by IP..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 focus:border-purple-500 focus:outline-none"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 focus:border-purple-500 focus:outline-none"
        >
          <option value="all">All Types</option>
          <option value="block">Blocked</option>
          <option value="rate-limit">Rate Limited</option>
          <option value="whitelist">Whitelisted</option>
        </select>
      </div>

      {/* Rules Table */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-750">
              <tr>
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
                
                return (
                <tr
                  key={rule.id || ip}
                  className={`hover:bg-gray-750 ${isExpired(rule.expires_at) ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-3">
                    <span className="text-white font-mono text-sm">{ip}</span>
                  </td>
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
                  <td className="px-4 py-3 text-gray-400 text-sm max-w-xs truncate">
                    {rule.reason || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {rule.expires_at ? (
                      <span className={isExpired(rule.expires_at) ? 'text-red-400' : 'text-gray-400'}>
                        {isExpired(rule.expires_at) ? 'Expired: ' : ''}
                        {formatDate(rule.expires_at)}
                      </span>
                    ) : (
                      <span className="text-gray-500">Never</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">{formatDate(rule.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Remove rule for ${ip}?`)) {
                          removeRuleMutation.mutate(rule.id);
                        }
                      }}
                      disabled={removeRuleMutation.isPending}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>

        {filteredRules.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {searchTerm || filterType !== 'all'
              ? 'No rules matching your filters'
              : 'No IP rules configured'}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Blocked IPs</div>
          <div className="text-2xl font-bold text-red-400 mt-1">
            {rulesData?.data?.rules?.filter((r) => r.type === 'block').length || 0}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Custom Rate Limits</div>
          <div className="text-2xl font-bold text-yellow-400 mt-1">
            {rulesData?.data?.rules?.filter((r) => r.type === 'rate-limit').length || 0}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Whitelisted</div>
          <div className="text-2xl font-bold text-green-400 mt-1">
            {rulesData?.data?.rules?.filter((r) => r.type === 'whitelist').length || 0}
          </div>
        </div>
      </div>

      {/* Add Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700 m-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">Add IP Rule</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* IP Address */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  IP Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newRule.ip}
                  onChange={(e) => setNewRule({ ...newRule, ip: e.target.value })}
                  placeholder="192.168.1.1 or 192.168.1.0/24"
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-purple-500 focus:outline-none"
                />
                <p className="text-gray-500 text-xs mt-1">Supports individual IPs or CIDR notation</p>
              </div>

              {/* Rule Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Rule Type</label>
                <select
                  value={newRule.type}
                  onChange={(e) => setNewRule({ ...newRule, type: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-purple-500 focus:outline-none"
                >
                  <option value="block">Block</option>
                  <option value="rate-limit">Custom Rate Limit</option>
                  <option value="whitelist">Whitelist (bypass rate limits)</option>
                </select>
              </div>

              {/* Rate Limit (only for rate-limit type) */}
              {newRule.type === 'rate-limit' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Requests per Minute
                  </label>
                  <input
                    type="number"
                    value={newRule.rateLimit}
                    onChange={(e) => setNewRule({ ...newRule, rateLimit: parseInt(e.target.value, 10) })}
                    min="1"
                    max="10000"
                    className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Reason</label>
                <input
                  type="text"
                  value={newRule.reason}
                  onChange={(e) => setNewRule({ ...newRule, reason: e.target.value })}
                  placeholder="Optional reason for this rule"
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-purple-500 focus:outline-none"
                />
              </div>

              {/* Expiration */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Expires At</label>
                <input
                  type="datetime-local"
                  value={newRule.expiresAt}
                  onChange={(e) => setNewRule({ ...newRule, expiresAt: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-purple-500 focus:outline-none"
                />
                <p className="text-gray-500 text-xs mt-1">Leave empty for permanent rule</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addRuleMutation.isPending}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {addRuleMutation.isPending ? 'Adding...' : 'Add Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
