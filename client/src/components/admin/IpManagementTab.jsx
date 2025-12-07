import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import { useToast } from '../../stores/toastStore';

import {
  IpStatsCards,
  LiveTrafficTable,
  RulesTable,
  QuickActionModal,
  AddRuleModal,
  BulkActionsBar,
  IpLookupPanel,
  ExportImportControls,
} from './ip-management';

export default function IpManagementTab() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  // View state
  const [activeView, setActiveView] = useState('live'); // 'live' | 'rules' | 'lookup'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [liveSort, setLiveSort] = useState({ field: 'requestsPerSecond', dir: 'desc' });

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [quickActionModal, setQuickActionModal] = useState(null);

  // Selection state
  const [selectedIps, setSelectedIps] = useState(new Set());
  const [selectedRules, setSelectedRules] = useState(new Set());

  // Fetch live IP stats (auto-refresh every 3s)
  const { data: liveData, isLoading: liveLoading } = useQuery({
    queryKey: ['admin', 'traffic', 'realtime'],
    queryFn: () => adminApi.getRealtimeTraffic(),
    refetchInterval: 3000,
  });

  // Fetch IP rules
  const { data: rulesData, isLoading: rulesLoading, error: rulesError } = useQuery({
    queryKey: ['admin', 'ip-rules'],
    queryFn: () => adminApi.getIpRules(),
  });

  // Add IP rule mutation
  const addRuleMutation = useMutation({
    mutationFn: (rule) => {
      if (rule.type === 'block') {
        return adminApi.blockIp(rule.ip, rule.reason, rule.expiresAt || null);
      } else if (rule.type === 'rate-limit') {
        return adminApi.setIpRateLimit(rule.ip, rule.rateLimit, rule.expiresAt || null);
      } else {
        return adminApi.whitelistIp(rule.ip, rule.reason, rule.expiresAt || null);
      }
    },
    onSuccess: () => {
      addToast('IP rule added successfully', 'success');
      queryClient.invalidateQueries(['admin', 'ip-rules']);
      queryClient.invalidateQueries(['admin', 'traffic']);
      setShowAddModal(false);
      setQuickActionModal(null);
      setSelectedIps(new Set());
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
      setSelectedRules(new Set());
    },
    onError: (err) => {
      addToast(err.response?.data?.error || 'Failed to remove IP rule', 'error');
    },
  });

  // Bulk action mutation
  const bulkActionMutation = useMutation({
    mutationFn: async ({ ips, action, rateLimit, expiresAt, reason }) => {
      const promises = ips.map(ip => {
        if (action === 'block') {
          return adminApi.blockIp(ip, reason, expiresAt);
        } else if (action === 'rate-limit') {
          return adminApi.setIpRateLimit(ip, rateLimit, expiresAt);
        } else if (action === 'whitelist') {
          return adminApi.whitelistIp(ip, reason, expiresAt);
        }
        return Promise.resolve();
      });
      return Promise.all(promises);
    },
    onSuccess: (_, { ips, action }) => {
      addToast(`Applied ${action} to ${ips.length} IPs`, 'success');
      queryClient.invalidateQueries(['admin', 'ip-rules']);
      queryClient.invalidateQueries(['admin', 'traffic']);
      setSelectedIps(new Set());
      setQuickActionModal(null);
    },
    onError: (err) => {
      addToast(err.response?.data?.error || 'Failed to apply bulk action', 'error');
    },
  });

  // Bulk remove mutation
  const bulkRemoveMutation = useMutation({
    mutationFn: async (ids) => {
      const promises = ids.map(id => adminApi.deleteIpRule(id));
      return Promise.all(promises);
    },
    onSuccess: (_, ids) => {
      addToast(`Removed ${ids.length} rules`, 'success');
      queryClient.invalidateQueries(['admin', 'ip-rules']);
      queryClient.invalidateQueries(['admin', 'traffic']);
      setSelectedRules(new Set());
    },
    onError: (err) => {
      addToast(err.response?.data?.error || 'Failed to remove rules', 'error');
    },
  });

  // Handlers
  const handleToggleSort = useCallback((field) => {
    setLiveSort(prev => ({
      field,
      dir: prev.field === field && prev.dir === 'desc' ? 'asc' : 'desc'
    }));
  }, []);

  const handleSelectIp = useCallback((ip) => {
    setSelectedIps(prev => {
      const next = new Set(prev);
      if (next.has(ip)) {
        next.delete(ip);
      } else {
        next.add(ip);
      }
      return next;
    });
  }, []);

  const handleSelectAllIps = useCallback((selected) => {
    if (selected) {
      const allIps = (liveData?.data?.activeIps || [])
        .filter(ip => !searchTerm || ip.ip.includes(searchTerm))
        .map(ip => ip.ip);
      setSelectedIps(new Set(allIps));
    } else {
      setSelectedIps(new Set());
    }
  }, [liveData?.data?.activeIps, searchTerm]);

  const handleSelectRule = useCallback((id) => {
    setSelectedRules(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAllRules = useCallback((selected) => {
    if (selected) {
      const allIds = (rulesData?.data?.rules || [])
        .filter(r => {
          const ip = r.ip_address || r.ip;
          const matchesSearch = !searchTerm || ip.includes(searchTerm);
          const matchesType = filterType === 'all' || r.rule_type === filterType || r.type === filterType;
          return matchesSearch && matchesType;
        })
        .map(r => r.id);
      setSelectedRules(new Set(allIds));
    } else {
      setSelectedRules(new Set());
    }
  }, [rulesData?.data?.rules, searchTerm, filterType]);

  const handleQuickAction = useCallback((ip, action) => {
    setQuickActionModal({ ip, action, isBulk: false });
  }, []);

  const handleBulkAction = useCallback((action) => {
    if (action === 'remove') {
      if (selectedRules.size === 0) return;
      if (confirm(`Remove ${selectedRules.size} rules?`)) {
        bulkRemoveMutation.mutate([...selectedRules]);
      }
    } else {
      if (selectedIps.size === 0) return;
      setQuickActionModal({ action, isBulk: true, ips: [...selectedIps] });
    }
  }, [selectedIps, selectedRules, bulkRemoveMutation]);

  const handleRemoveRule = useCallback((id, ip) => {
    if (confirm(`Remove rule for ${ip}?`)) {
      removeRuleMutation.mutate(id);
    }
  }, [removeRuleMutation]);

  const handleAddRule = useCallback((rule) => {
    addRuleMutation.mutate({
      ip: rule.ip,
      type: rule.type,
      reason: rule.reason,
      rateLimit: rule.rateLimit,
      expiresAt: rule.expiresAt,
    });
  }, [addRuleMutation]);

  const handleQuickActionSubmit = useCallback((data) => {
    if (quickActionModal?.isBulk) {
      bulkActionMutation.mutate({
        ips: quickActionModal.ips,
        action: data.action,
        rateLimit: data.rateLimit,
        expiresAt: data.expiresAt,
        reason: data.reason,
      });
    } else {
      addRuleMutation.mutate({
        ip: data.ip,
        type: data.action,
        reason: data.reason,
        rateLimit: data.rateLimit,
        expiresAt: data.expiresAt,
      });
    }
  }, [quickActionModal, addRuleMutation, bulkActionMutation]);

  const handleImport = useCallback((rules) => {
    const validRules = rules.filter(r => r.ip_address || r.ip);
    if (validRules.length === 0) {
      addToast('No valid rules found in file', 'error');
      return;
    }
    if (confirm(`Import ${validRules.length} rules?`)) {
      const promises = validRules.map(rule => {
        const ip = rule.ip_address || rule.ip;
        const type = rule.rule_type || rule.type;
        if (type === 'block') {
          return adminApi.blockIp(ip, rule.reason, rule.expires_at);
        } else if (type === 'rate-limit') {
          return adminApi.setIpRateLimit(ip, rule.rate_limit_override || rule.rate_limit || 100, rule.expires_at);
        } else {
          return adminApi.whitelistIp(ip, rule.reason, rule.expires_at);
        }
      });
      Promise.all(promises)
        .then(() => {
          addToast(`Imported ${validRules.length} rules`, 'success');
          queryClient.invalidateQueries(['admin', 'ip-rules']);
        })
        .catch(err => {
          addToast('Failed to import some rules', 'error');
        });
    }
  }, [addToast, queryClient]);

  const handleLookupAction = useCallback((ip, action) => {
    setQuickActionModal({ ip, action, isBulk: false });
  }, []);

  const isLoading = activeView === 'live' ? liveLoading : rulesLoading;
  const selectedCount = activeView === 'live' ? selectedIps.size : selectedRules.size;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
        <div>
          <h2 className="text-xl font-semibold text-white">IP Management</h2>
          <p className="text-gray-400 text-sm mt-1">
            Monitor traffic, block IPs, set rate limits, or whitelist trusted addresses
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportImportControls
            rules={rulesData}
            onImport={handleImport}
            isLoading={isLoading}
          />
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Rule
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <IpStatsCards
        liveData={liveData}
        rulesData={rulesData}
        selectedCount={selectedCount}
      />

      {/* View Tabs */}
      <div className="flex gap-2 border-b border-gray-700 pb-2">
        <button
          onClick={() => { setActiveView('live'); setSelectedRules(new Set()); }}
          className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
            activeView === 'live'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Live Traffic ({liveData?.data?.totalActiveIps || 0})
          </div>
        </button>
        <button
          onClick={() => { setActiveView('rules'); setSelectedIps(new Set()); }}
          className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
            activeView === 'rules'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Configured Rules ({rulesData?.data?.rules?.length || 0})
        </button>
        <button
          onClick={() => setActiveView('lookup')}
          className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
            activeView === 'lookup'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            IP Lookup
          </div>
        </button>
      </div>

      {/* Bulk Actions Bar */}
      {(activeView === 'live' || activeView === 'rules') && (
        <BulkActionsBar
          selectedCount={selectedCount}
          onClearSelection={() => {
            if (activeView === 'live') setSelectedIps(new Set());
            else setSelectedRules(new Set());
          }}
          onBulkAction={handleBulkAction}
          isLoading={bulkActionMutation.isPending || bulkRemoveMutation.isPending}
        />
      )}

      {/* Search and Filter */}
      {activeView !== 'lookup' && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by IP address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-800 text-white rounded-lg pl-10 pr-4 py-2 border border-gray-700 focus:border-purple-500 focus:outline-none"
            />
          </div>
          {activeView === 'rules' && (
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
          )}
        </div>
      )}

      {/* Live Traffic View */}
      {activeView === 'live' && (
        <LiveTrafficTable
          liveData={liveData}
          rulesData={rulesData}
          searchTerm={searchTerm}
          sort={liveSort}
          onToggleSort={handleToggleSort}
          selectedIps={selectedIps}
          onSelectIp={handleSelectIp}
          onSelectAll={handleSelectAllIps}
          onQuickAction={handleQuickAction}
          onRemoveRule={handleRemoveRule}
          isLoading={liveLoading}
        />
      )}

      {/* Rules View */}
      {activeView === 'rules' && (
        <RulesTable
          rulesData={rulesData}
          searchTerm={searchTerm}
          filterType={filterType}
          selectedRules={selectedRules}
          onSelectRule={handleSelectRule}
          onSelectAll={handleSelectAllRules}
          onRemoveRule={handleRemoveRule}
          onQuickAction={handleQuickAction}
          isLoading={rulesLoading}
          error={rulesError}
        />
      )}

      {/* IP Lookup View */}
      {activeView === 'lookup' && (
        <IpLookupPanel onLookup={handleLookupAction} />
      )}

      {/* Add Rule Modal */}
      {showAddModal && (
        <AddRuleModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddRule}
          isLoading={addRuleMutation.isPending}
        />
      )}

      {/* Quick Action Modal */}
      {quickActionModal && (
        <QuickActionModal
          ip={quickActionModal.ip}
          action={quickActionModal.action}
          isBulk={quickActionModal.isBulk}
          bulkCount={quickActionModal.ips?.length || 0}
          onClose={() => setQuickActionModal(null)}
          onSubmit={handleQuickActionSubmit}
          isLoading={addRuleMutation.isPending || bulkActionMutation.isPending}
        />
      )}
    </div>
  );
}
