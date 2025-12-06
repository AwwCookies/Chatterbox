import { useState, useEffect } from 'react';
import { tiersApi, adminApi } from '../../services/api';
import { useToastStore } from '../../stores/toastStore';
import {
  Crown,
  Plus,
  Edit2,
  Trash2,
  Users,
  Zap,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Shield,
  Infinity,
  Star,
  ChevronDown,
  ChevronUp,
  Search,
  Download,
  Wifi,
  UserPlus,
} from 'lucide-react';

// Format limit value (handle -1 as unlimited)
const formatLimit = (value, suffix = '') => {
  if (value === -1 || value === null) {
    return <span className="flex items-center gap-1"><Infinity className="w-4 h-4" /> Unlimited</span>;
  }
  return `${value.toLocaleString()}${suffix}`;
};

// Tier card component
function TierCard({ tier, onEdit, onDelete, onViewUsers, isDefault }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`bg-twitch-gray rounded-xl border ${isDefault ? 'border-twitch-purple' : 'border-gray-700'} overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              tier.name === 'enterprise' ? 'bg-gradient-to-br from-yellow-500 to-orange-500' :
              tier.name === 'pro' ? 'bg-gradient-to-br from-purple-500 to-pink-500' :
              'bg-gradient-to-br from-gray-600 to-gray-700'
            }`}>
              {tier.name === 'enterprise' ? <Crown className="w-5 h-5 text-white" /> :
               tier.name === 'pro' ? <Star className="w-5 h-5 text-white" /> :
               <Users className="w-5 h-5 text-white" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white">{tier.display_name}</h3>
                {isDefault && (
                  <span className="px-2 py-0.5 text-xs bg-twitch-purple/20 text-twitch-purple rounded-full">
                    Default
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400">{tier.description || 'No description'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded-full flex items-center gap-1">
              <Users className="w-3 h-3" />
              {tier.user_count || 0} users
            </span>
          </div>
        </div>

        {/* Quick limits preview */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-twitch-dark rounded-lg p-2">
            <div className="text-xs text-gray-400">Webhooks</div>
            <div className="text-sm font-medium text-white">{formatLimit(tier.max_webhooks)}</div>
          </div>
          <div className="bg-twitch-dark rounded-lg p-2">
            <div className="text-xs text-gray-400">API/min</div>
            <div className="text-sm font-medium text-white">{formatLimit(tier.max_api_calls_per_minute)}</div>
          </div>
          <div className="bg-twitch-dark rounded-lg p-2">
            <div className="text-xs text-gray-400">Search Results</div>
            <div className="text-sm font-medium text-white">{formatLimit(tier.max_search_results)}</div>
          </div>
          <div className="bg-twitch-dark rounded-lg p-2">
            <div className="text-xs text-gray-400">History</div>
            <div className="text-sm font-medium text-white">
              {tier.max_history_days === null ? formatLimit(-1) : `${tier.max_history_days} days`}
            </div>
          </div>
        </div>

        {/* Expandable details */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 w-full flex items-center justify-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
        >
          {expanded ? 'Show less' : 'Show more'}
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-700 space-y-3">
            {/* Features */}
            <div>
              <div className="text-xs text-gray-400 mb-2">Features</div>
              <div className="flex flex-wrap gap-2">
                <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 ${
                  tier.can_export ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  <Download className="w-3 h-3" />
                  Export {tier.can_export ? 'enabled' : 'disabled'}
                </span>
                <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 ${
                  tier.can_use_websocket ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  <Wifi className="w-3 h-3" />
                  WebSocket {tier.can_use_websocket ? 'enabled' : 'disabled'}
                </span>
              </div>
            </div>

            {/* Pricing (for future) */}
            {(tier.price_monthly || tier.price_yearly) && (
              <div>
                <div className="text-xs text-gray-400 mb-2">Pricing</div>
                <div className="flex gap-4">
                  {tier.price_monthly && (
                    <span className="text-sm text-white">${tier.price_monthly}/mo</span>
                  )}
                  {tier.price_yearly && (
                    <span className="text-sm text-white">${tier.price_yearly}/yr</span>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => onViewUsers(tier)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                <Users className="w-4 h-4" />
                View Users
              </button>
              <button
                onClick={() => onEdit(tier)}
                className="flex items-center justify-center gap-2 px-3 py-2 text-sm bg-twitch-purple hover:bg-twitch-purple-dark text-white rounded-lg transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={() => onDelete(tier)}
                disabled={isDefault || tier.user_count > 0}
                className="flex items-center justify-center gap-2 px-3 py-2 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={isDefault ? 'Cannot delete default tier' : tier.user_count > 0 ? 'Cannot delete tier with users' : 'Delete tier'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Create/Edit tier modal
function TierModal({ tier, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: tier?.name || '',
    displayName: tier?.display_name || '',
    description: tier?.description || '',
    maxWebhooks: tier?.max_webhooks ?? 2,
    maxChannels: tier?.max_channels ?? 10,
    maxApiCallsPerMinute: tier?.max_api_calls_per_minute ?? 30,
    maxSearchResults: tier?.max_search_results ?? 50,
    maxHistoryDays: tier?.max_history_days ?? 7,
    canExport: tier?.can_export ?? false,
    canUseWebsocket: tier?.can_use_websocket ?? true,
    priceMonthly: tier?.price_monthly || '',
    priceYearly: tier?.price_yearly || '',
    isDefault: tier?.is_default ?? false,
    sortOrder: tier?.sort_order ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [unlimitedFields, setUnlimitedFields] = useState({
    maxWebhooks: tier?.max_webhooks === -1,
    maxChannels: tier?.max_channels === -1,
    maxApiCallsPerMinute: tier?.max_api_calls_per_minute === -1,
    maxSearchResults: tier?.max_search_results === -1,
    maxHistoryDays: tier?.max_history_days === null,
  });

  const isEditing = !!tier;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const data = {
        ...formData,
        maxWebhooks: unlimitedFields.maxWebhooks ? -1 : parseInt(formData.maxWebhooks),
        maxChannels: unlimitedFields.maxChannels ? -1 : parseInt(formData.maxChannels),
        maxApiCallsPerMinute: unlimitedFields.maxApiCallsPerMinute ? -1 : parseInt(formData.maxApiCallsPerMinute),
        maxSearchResults: unlimitedFields.maxSearchResults ? -1 : parseInt(formData.maxSearchResults),
        maxHistoryDays: unlimitedFields.maxHistoryDays ? null : parseInt(formData.maxHistoryDays),
        priceMonthly: formData.priceMonthly ? parseFloat(formData.priceMonthly) : null,
        priceYearly: formData.priceYearly ? parseFloat(formData.priceYearly) : null,
      };

      await onSave(data, tier?.id);
      onClose();
    } catch (error) {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  };

  const renderLimitInput = (field, label, placeholder) => (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={unlimitedFields[field] ? '' : formData[field]}
          onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
          disabled={unlimitedFields[field]}
          placeholder={unlimitedFields[field] ? 'Unlimited' : placeholder}
          className="flex-1 bg-twitch-dark border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple disabled:opacity-50"
        />
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={unlimitedFields[field]}
            onChange={(e) => setUnlimitedFields({ ...unlimitedFields, [field]: e.target.checked })}
            className="rounded bg-twitch-dark border-gray-600 text-twitch-purple focus:ring-twitch-purple"
          />
          <span className="text-sm text-gray-400">Unlimited</span>
        </label>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-twitch-gray rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">
            {isEditing ? 'Edit Tier' : 'Create Tier'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Internal Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                placeholder="tier_name"
                disabled={isEditing}
                className="w-full bg-twitch-dark border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple disabled:opacity-50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Display Name</label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="Tier Name"
                className="w-full bg-twitch-dark border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this tier offers..."
              rows={2}
              className="w-full bg-twitch-dark border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple"
            />
          </div>

          {/* Limits */}
          <div className="border-t border-gray-700 pt-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Limits</h3>
            <div className="space-y-3">
              {renderLimitInput('maxWebhooks', 'Max Webhooks', '10')}
              {renderLimitInput('maxChannels', 'Max Channels', '50')}
              {renderLimitInput('maxApiCallsPerMinute', 'API Calls per Minute', '100')}
              {renderLimitInput('maxSearchResults', 'Max Search Results', '500')}
              {renderLimitInput('maxHistoryDays', 'History Days', '90')}
            </div>
          </div>

          {/* Features */}
          <div className="border-t border-gray-700 pt-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Features</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.canExport}
                  onChange={(e) => setFormData({ ...formData, canExport: e.target.checked })}
                  className="rounded bg-twitch-dark border-gray-600 text-twitch-purple focus:ring-twitch-purple"
                />
                <span className="text-sm text-gray-300">Can Export Data</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.canUseWebsocket}
                  onChange={(e) => setFormData({ ...formData, canUseWebsocket: e.target.checked })}
                  className="rounded bg-twitch-dark border-gray-600 text-twitch-purple focus:ring-twitch-purple"
                />
                <span className="text-sm text-gray-300">Can Use WebSocket</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="rounded bg-twitch-dark border-gray-600 text-twitch-purple focus:ring-twitch-purple"
                />
                <span className="text-sm text-gray-300">Set as Default Tier</span>
              </label>
            </div>
          </div>

          {/* Pricing (for future) */}
          <div className="border-t border-gray-700 pt-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Pricing (Optional)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Monthly ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.priceMonthly}
                  onChange={(e) => setFormData({ ...formData, priceMonthly: e.target.value })}
                  placeholder="9.99"
                  className="w-full bg-twitch-dark border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Yearly ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.priceYearly}
                  onChange={(e) => setFormData({ ...formData, priceYearly: e.target.value })}
                  placeholder="99.99"
                  className="w-full bg-twitch-dark border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple"
                />
              </div>
            </div>
          </div>

          {/* Sort order */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Sort Order</label>
            <input
              type="number"
              value={formData.sortOrder}
              onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
              className="w-32 bg-twitch-dark border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-twitch-purple"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-twitch-purple hover:bg-twitch-purple-dark disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Tier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Users list modal
function TierUsersModal({ tier, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await tiersApi.getTierUsers(tier.id);
        setUsers(response.data.users || []);
      } catch (error) {
        console.error('Failed to fetch tier users:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [tier.id]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-twitch-gray rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {tier.display_name} Users ({users.length})
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-twitch-purple" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No users assigned to this tier
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 bg-twitch-dark rounded-lg">
                  <div className="flex items-center gap-3">
                    <img
                      src={user.profile_image_url || '/default-avatar.png'}
                      alt={user.display_name}
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <div className="font-medium text-white">{user.display_name}</div>
                      <div className="text-sm text-gray-400">@{user.username}</div>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-gray-400">
                      Assigned {new Date(user.assigned_at).toLocaleDateString()}
                    </div>
                    {user.expires_at && (
                      <div className="text-yellow-400">
                        Expires {new Date(user.expires_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Assign user to tier modal
function AssignUserModal({ tiers, onClose, onAssigned }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedTier, setSelectedTier] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [userCurrentTier, setUserCurrentTier] = useState(null);
  const addToast = useToastStore((state) => state.addToast);

  // Search for users
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    try {
      const response = await adminApi.getOAuthUsers({ search: searchQuery, limit: 10 });
      setSearchResults(response.data.users || []);
    } catch (error) {
      addToast('Failed to search users', 'error');
    } finally {
      setSearching(false);
    }
  };

  // Handle user selection
  const handleSelectUser = async (user) => {
    setSelectedUser(user);
    setSearchResults([]);
    setSearchQuery(user.username);
    
    // Get user's current tier
    try {
      const response = await tiersApi.getUserTier(user.username);
      setUserCurrentTier(response.data.tier);
      setSelectedTier(response.data.tier?.id?.toString() || '');
    } catch (error) {
      // User might not have a tier assigned
      setUserCurrentTier(null);
      setSelectedTier('');
    }
  };

  // Assign user to tier
  const handleAssign = async () => {
    if (!selectedUser || !selectedTier) return;
    
    setAssigning(true);
    try {
      await tiersApi.assignUserTier(selectedUser.username, {
        tier_id: parseInt(selectedTier),
        expires_at: expiresAt || null,
      });
      addToast(`Assigned ${selectedUser.username} to tier successfully`, 'success');
      onAssigned?.();
      onClose();
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to assign tier', 'error');
    } finally {
      setAssigning(false);
    }
  };

  // Remove tier assignment
  const handleRemove = async () => {
    if (!selectedUser) return;
    
    setAssigning(true);
    try {
      await tiersApi.removeUserTier(selectedUser.username);
      addToast(`Removed tier from ${selectedUser.username}`, 'success');
      onAssigned?.();
      onClose();
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to remove tier', 'error');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-twitch-gray rounded-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Assign User to Tier
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {/* User Search */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Search User
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Enter username..."
                  className="w-full px-3 py-2 bg-twitch-dark border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple"
                />
                {searchResults.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-twitch-dark border border-gray-600 rounded-lg max-h-48 overflow-y-auto">
                    {searchResults.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleSelectUser(user)}
                        className="w-full flex items-center gap-3 p-2 hover:bg-gray-700 text-left"
                      >
                        <img
                          src={user.profile_image_url || '/default-avatar.png'}
                          alt={user.display_name}
                          className="w-8 h-8 rounded-full"
                        />
                        <div>
                          <div className="text-white text-sm">{user.display_name}</div>
                          <div className="text-gray-400 text-xs">@{user.username}</div>
                        </div>
                        {user.is_admin && (
                          <Shield className="w-4 h-4 text-twitch-purple ml-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
                className="px-3 py-2 bg-twitch-purple hover:bg-twitch-purple-dark text-white rounded-lg disabled:opacity-50"
              >
                {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Selected User */}
          {selectedUser && (
            <div className="bg-twitch-dark rounded-lg p-3 flex items-center gap-3">
              <img
                src={selectedUser.profile_image_url || '/default-avatar.png'}
                alt={selectedUser.display_name}
                className="w-12 h-12 rounded-full"
              />
              <div className="flex-1">
                <div className="font-medium text-white">{selectedUser.display_name}</div>
                <div className="text-sm text-gray-400">@{selectedUser.username}</div>
                {userCurrentTier && (
                  <div className="text-xs text-twitch-purple mt-1">
                    Current: {userCurrentTier.display_name}
                  </div>
                )}
              </div>
              {selectedUser.is_admin && (
                <div className="text-xs bg-twitch-purple/20 text-twitch-purple px-2 py-1 rounded">
                  Admin
                </div>
              )}
            </div>
          )}

          {/* Tier Selection */}
          {selectedUser && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Assign to Tier
                </label>
                <select
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value)}
                  className="w-full px-3 py-2 bg-twitch-dark border border-gray-600 rounded-lg text-white focus:outline-none focus:border-twitch-purple"
                >
                  <option value="">Select a tier...</option>
                  {tiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.display_name} {tier.is_default ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Expires At (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full px-3 py-2 bg-twitch-dark border border-gray-600 rounded-lg text-white focus:outline-none focus:border-twitch-purple"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty for permanent assignment
                </p>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-700 flex gap-2">
          {selectedUser && userCurrentTier && (
            <button
              onClick={handleRemove}
              disabled={assigning}
              className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors disabled:opacity-50"
            >
              {assigning ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Remove Tier'}
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={assigning || !selectedUser || !selectedTier}
            className="px-4 py-2 bg-twitch-purple hover:bg-twitch-purple-dark text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
          >
            {assigning && <Loader2 className="w-4 h-4 animate-spin" />}
            Assign
          </button>
        </div>
      </div>
    </div>
  );
}

// Main component
export default function TiersManagement() {
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTier, setEditingTier] = useState(null);
  const [viewingUsersFor, setViewingUsersFor] = useState(null);
  const [assignUserOpen, setAssignUserOpen] = useState(false);
  const addToast = useToastStore((state) => state.addToast);

  const fetchTiers = async () => {
    try {
      const response = await tiersApi.getAll();
      setTiers(response.data.tiers || []);
    } catch (error) {
      addToast('Failed to fetch tiers', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTiers();
  }, []);

  const handleCreate = () => {
    setEditingTier(null);
    setModalOpen(true);
  };

  const handleEdit = (tier) => {
    setEditingTier(tier);
    setModalOpen(true);
  };

  const handleSave = async (data, id) => {
    try {
      if (id) {
        await tiersApi.update(id, data);
        addToast('Tier updated successfully', 'success');
      } else {
        await tiersApi.create(data);
        addToast('Tier created successfully', 'success');
      }
      fetchTiers();
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to save tier', 'error');
      throw error;
    }
  };

  const handleDelete = async (tier) => {
    if (!confirm(`Delete tier "${tier.display_name}"?`)) return;

    try {
      await tiersApi.delete(tier.id);
      addToast('Tier deleted successfully', 'success');
      fetchTiers();
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to delete tier', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-twitch-purple" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Crown className="w-6 h-6 text-yellow-400" />
            Subscription Tiers
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Manage user tiers and their limits
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAssignUserOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Assign User
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-twitch-purple hover:bg-twitch-purple-dark text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Tier
          </button>
        </div>
      </div>

      {/* Tiers grid */}
      {tiers.length === 0 ? (
        <div className="bg-twitch-gray rounded-xl p-8 text-center">
          <Crown className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-white mb-1">No Tiers Yet</h3>
          <p className="text-gray-400 mb-4">
            Create your first tier to start managing user access levels
          </p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-twitch-purple hover:bg-twitch-purple-dark text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Tier
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {tiers.map((tier) => (
            <TierCard
              key={tier.id}
              tier={tier}
              isDefault={tier.is_default}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onViewUsers={setViewingUsersFor}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {modalOpen && (
        <TierModal
          tier={editingTier}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}

      {viewingUsersFor && (
        <TierUsersModal
          tier={viewingUsersFor}
          onClose={() => setViewingUsersFor(null)}
        />
      )}

      {assignUserOpen && (
        <AssignUserModal
          tiers={tiers}
          onClose={() => setAssignUserOpen(false)}
          onAssigned={fetchTiers}
        />
      )}
    </div>
  );
}