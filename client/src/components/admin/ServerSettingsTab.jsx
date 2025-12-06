import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import { useToast } from '../../stores/toastStore';

// Configuration categories for grouping (prefix-based)
const CONFIG_CATEGORIES = {
  'Rate Limiting': 'rateLimit.',
  'Messages': 'messages.',
  'WebSocket': 'websocket.',
  'Archive': 'archive.',
  'User Requests': 'userRequests.',
  'Security': 'security.',
  'Analytics': 'analytics.',
  'Webhooks': 'webhooks.',
};

export default function ServerSettingsTab() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [pendingChanges, setPendingChanges] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState(new Set(Object.keys(CONFIG_CATEGORIES)));

  // Fetch current configuration
  const { data: configData, isLoading, error } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => adminApi.getSettings(),
  });

  const configs = configData?.data?.configs || [];

  // Save single config mutation
  const saveMutation = useMutation({
    mutationFn: ({ key, value }) => adminApi.updateSetting(key, value),
    onSuccess: (_, variables) => {
      addToast(`Updated ${variables.key}`, 'success');
      queryClient.invalidateQueries(['admin', 'settings']);
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[variables.key];
        return next;
      });
    },
    onError: (err) => {
      addToast(err.response?.data?.error || 'Failed to save configuration', 'error');
    },
  });

  // Save all changes mutation
  const saveAllMutation = useMutation({
    mutationFn: (changes) => {
      const configsArray = Object.entries(changes).map(([key, value]) => ({ key, value }));
      return adminApi.updateSettingsBulk(configsArray);
    },
    onSuccess: () => {
      addToast('All changes saved', 'success');
      queryClient.invalidateQueries(['admin', 'settings']);
      setPendingChanges({});
    },
    onError: (err) => {
      addToast(err.response?.data?.error || 'Failed to save configurations', 'error');
    },
  });

  // Reset single config mutation
  const resetMutation = useMutation({
    mutationFn: (key) => adminApi.resetSettingKey(key),
    onSuccess: (_, key) => {
      addToast(`Reset ${key} to default`, 'success');
      queryClient.invalidateQueries(['admin', 'settings']);
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    onError: (err) => {
      addToast(err.response?.data?.error || 'Failed to reset configuration', 'error');
    },
  });

  // Handle config value change (local only)
  const handleConfigChange = (key, value) => {
    const original = configs.find((c) => c.key === key);
    if (original && value === original.value) {
      // Remove from pending if reverted to original
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } else {
      setPendingChanges((prev) => ({ ...prev, [key]: value }));
    }
  };

  // Get current value (pending or original)
  const getValue = (key) => {
    if (key in pendingChanges) return pendingChanges[key];
    const config = configs.find((c) => c.key === key);
    return config?.value;
  };

  // Check if key has pending change
  const hasChange = (key) => key in pendingChanges;

  // Save all pending changes
  const handleSaveAll = () => {
    if (Object.keys(pendingChanges).length > 0) {
      saveAllMutation.mutate(pendingChanges);
    }
  };

  // Discard all changes
  const handleDiscardAll = () => {
    setPendingChanges({});
  };

  // Toggle category expansion
  const toggleCategory = (category) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Group configs by category
  const groupedConfigs = useMemo(() => {
    const groups = {};
    const lowerSearch = searchTerm.toLowerCase();

    Object.entries(CONFIG_CATEGORIES).forEach(([category, prefix]) => {
      groups[category] = configs.filter((config) => {
        const matchesCategory = config.key.startsWith(prefix);
        const matchesSearch =
          !searchTerm ||
          config.key.toLowerCase().includes(lowerSearch) ||
          (config.description && config.description.toLowerCase().includes(lowerSearch));
        return matchesCategory && matchesSearch;
      });
    });

    // "Other" category for uncategorized configs
    const categorizedKeys = new Set(
      Object.values(CONFIG_CATEGORIES).flatMap((prefix) =>
        configs.filter((c) => c.key.startsWith(prefix)).map((c) => c.key)
      )
    );
    const otherConfigs = configs.filter((c) => {
      const matchesSearch =
        !searchTerm ||
        c.key.toLowerCase().includes(lowerSearch) ||
        (c.description && c.description.toLowerCase().includes(lowerSearch));
      return !categorizedKeys.has(c.key) && matchesSearch;
    });
    if (otherConfigs.length > 0) {
      groups['Other'] = otherConfigs;
    }

    return groups;
  }, [configs, searchTerm]);

  // Render input based on type
  const renderInput = (config) => {
    const value = getValue(config.key);
    const type = config.type;

    switch (type) {
      case 'boolean':
        return (
          <button
            onClick={() => handleConfigChange(config.key, !value)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              value ? 'bg-purple-600' : 'bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                value ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        );

      case 'number':
        return (
          <input
            type="number"
            value={value ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              handleConfigChange(config.key, val === '' ? 0 : parseFloat(val));
            }}
            className="bg-gray-700 text-white rounded px-3 py-1.5 text-sm border border-gray-600 focus:border-purple-500 focus:outline-none w-32"
          />
        );

      default:
        return (
          <input
            type="text"
            value={value ?? ''}
            onChange={(e) => handleConfigChange(config.key, e.target.value)}
            className="bg-gray-700 text-white rounded px-3 py-1.5 text-sm border border-gray-600 focus:border-purple-500 focus:outline-none flex-1 min-w-48"
          />
        );
    }
  };

  // Format key for display
  const formatKey = (key) => {
    // "rateLimit.windowMs" -> "Window Ms"
    const parts = key.split('.');
    const lastPart = parts[parts.length - 1];
    return lastPart
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (s) => s.toUpperCase())
      .trim();
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
        Failed to load configuration: {error.message}
      </div>
    );
  }

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-xl font-semibold text-white">Server Configuration</h2>
          <p className="text-gray-400 text-sm mt-1">
            Configure rate limits, security settings, and other server parameters
          </p>
        </div>

        <div className="flex gap-2">
          {hasPendingChanges && (
            <>
              <button
                onClick={handleDiscardAll}
                className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Discard ({Object.keys(pendingChanges).length})
              </button>
              <button
                onClick={handleSaveAll}
                disabled={saveAllMutation.isPending}
                className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {saveAllMutation.isPending ? 'Saving...' : `Save All (${Object.keys(pendingChanges).length})`}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search settings..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 pl-10 border border-gray-700 focus:border-purple-500 focus:outline-none"
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Unsaved changes indicator */}
      {hasPendingChanges && (
        <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-3 text-yellow-400 text-sm flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          You have {Object.keys(pendingChanges).length} unsaved change(s)
        </div>
      )}

      {/* Configuration categories */}
      <div className="space-y-4">
        {Object.entries(groupedConfigs).map(([category, categoryConfigs]) => {
          if (categoryConfigs.length === 0) return null;

          return (
            <div key={category} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full px-4 py-3 flex items-center justify-between bg-gray-800 hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">{category}</span>
                  <span className="text-xs text-gray-500">({categoryConfigs.length})</span>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    expandedCategories.has(category) ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expandedCategories.has(category) && (
                <div className="border-t border-gray-700">
                  {categoryConfigs.map((config) => {
                    const isModified = hasChange(config.key);
                    const currentValue = getValue(config.key);
                    const isDefault = currentValue === config.defaultValue;

                    return (
                      <div
                        key={config.key}
                        className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 border-b border-gray-700/50 last:border-b-0 ${
                          isModified ? 'bg-purple-500/5' : ''
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white text-sm font-medium">{formatKey(config.key)}</span>
                            {isModified && (
                              <span className="text-xs text-purple-400 bg-purple-500/20 px-1.5 py-0.5 rounded">
                                Modified
                              </span>
                            )}
                            {!isDefault && !isModified && (
                              <span className="text-xs text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded">
                                Custom
                              </span>
                            )}
                          </div>
                          <p className="text-gray-500 text-xs mt-0.5">{config.description}</p>
                          <p className="text-gray-600 text-xs font-mono">{config.key}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {renderInput(config)}
                          {!isDefault && (
                            <button
                              onClick={() => resetMutation.mutate(config.key)}
                              disabled={resetMutation.isPending}
                              className="p-1.5 text-gray-400 hover:text-white transition-colors"
                              title={`Reset to default (${config.defaultValue})`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                            </button>
                          )}
                          {isModified && (
                            <button
                              onClick={() => saveMutation.mutate({ key: config.key, value: pendingChanges[config.key] })}
                              disabled={saveMutation.isPending}
                              className="p-1.5 text-purple-400 hover:text-purple-300 transition-colors"
                              title="Save this change"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {configs.length === 0 && (
        <div className="text-center py-8 text-gray-500">No configuration values found</div>
      )}
    </div>
  );
}
