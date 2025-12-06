import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, tiersApi } from '../../services/api';
import { useToast } from '../../stores/toastStore';
import { 
  Users, 
  Shield, 
  ShieldOff, 
  Search, 
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Crown,
  Clock,
  ExternalLink,
  Trash2,
  AlertTriangle,
  X,
  Activity,
  Zap,
  Loader2,
  TrendingUp,
} from 'lucide-react';

// User Detail Modal with tier management and usage stats
function UserDetailModal({ user, tiers, onClose, onUpdate }) {
  const { addToast } = useToast();
  const [selectedTier, setSelectedTier] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [tierInfo, setTierInfo] = useState(null);
  const [usageStats, setUsageStats] = useState(null);
  const [loadingData, setLoadingData] = useState(true);

  // Fetch user's current tier and usage
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tierRes, usageRes] = await Promise.all([
          tiersApi.getUserTier(user.username).catch(() => null),
          tiersApi.getUserUsage(user.username, { days: 7 }).catch(() => null),
        ]);
        
        if (tierRes?.data) {
          setTierInfo(tierRes.data);
          setSelectedTier(tierRes.data.tier?.id?.toString() || '');
        }
        if (usageRes?.data) {
          setUsageStats(usageRes.data);
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      } finally {
        setLoadingData(false);
      }
    };
      fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user.username]);  const handleAssignTier = async () => {
    if (!selectedTier) return;
    
    setLoading(true);
    try {
      await tiersApi.assignUserTier(user.username, {
        tier_id: parseInt(selectedTier),
        expires_at: expiresAt || null,
      });
      addToast('Tier assigned successfully', 'success');
      onUpdate?.();
      
      // Refresh tier info
      const tierRes = await tiersApi.getUserTier(user.username);
      setTierInfo(tierRes.data);
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to assign tier', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTier = async () => {
    setLoading(true);
    try {
      await tiersApi.removeUserTier(user.username);
      addToast('Tier removed successfully', 'success');
      onUpdate?.();
      setTierInfo(null);
      setSelectedTier('');
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to remove tier', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-twitch-gray rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {user.profile_image_url ? (
              <img
                src={user.profile_image_url}
                alt={user.display_name}
                className="w-12 h-12 rounded-full"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center">
                <Users className="w-6 h-6 text-gray-400" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {user.display_name}
                {user.is_admin && <Crown className="w-5 h-5 text-yellow-400" />}
              </h2>
              <p className="text-gray-400">@{user.username}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loadingData ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-twitch-purple" />
            </div>
          ) : (
            <>
              {/* Current Tier */}
              <div className="bg-twitch-dark rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Crown className="w-5 h-5 text-yellow-400" />
                  Current Tier
                </h3>
                {tierInfo?.tier ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-white font-medium">{tierInfo.tier.display_name}</span>
                      {tierInfo.assigned_at && (
                        <p className="text-sm text-gray-400">
                          Assigned: {new Date(tierInfo.assigned_at).toLocaleDateString()}
                        </p>
                      )}
                      {tierInfo.expires_at && (
                        <p className="text-sm text-yellow-400">
                          Expires: {new Date(tierInfo.expires_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={handleRemoveTier}
                      disabled={loading}
                      className="px-3 py-1 text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <p className="text-gray-400">Using default tier (Free)</p>
                )}
              </div>

              {/* Assign Tier */}
              <div className="bg-twitch-dark rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-twitch-purple" />
                  Assign Tier
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Select Tier</label>
                    <select
                      value={selectedTier}
                      onChange={(e) => setSelectedTier(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    >
                      <option value="">Choose a tier...</option>
                      {tiers.map((tier) => (
                        <option key={tier.id} value={tier.id}>
                          {tier.display_name} {tier.is_default ? '(Default)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Expires At (Optional)</label>
                    <input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    />
                  </div>
                  <button
                    onClick={handleAssignTier}
                    disabled={loading || !selectedTier}
                    className="w-full px-4 py-2 bg-twitch-purple hover:bg-twitch-purple-dark text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Assign Tier
                  </button>
                </div>
              </div>

              {/* Usage Stats */}
              <div className="bg-twitch-dark rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-green-400" />
                  Usage (Last 7 Days)
                </h3>
                {usageStats?.stats ? (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-gray-700 rounded-lg">
                      <div className="text-2xl font-bold text-white">
                        {parseInt(usageStats.stats.total_calls || 0).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-400">API Calls</div>
                    </div>
                    <div className="text-center p-3 bg-gray-700 rounded-lg">
                      <div className="text-2xl font-bold text-white">
                        {usageStats.endpoints?.length || 0}
                      </div>
                      <div className="text-xs text-gray-400">Endpoints Used</div>
                    </div>
                    <div className="text-center p-3 bg-gray-700 rounded-lg">
                      <div className="text-2xl font-bold text-white">
                        {parseInt(usageStats.stats.search_queries || 0).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-400">Searches</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400">No usage data available</p>
                )}
              </div>

              {/* Account Info */}
              <div className="bg-twitch-dark rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  Account Info
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Twitch ID:</span>
                    <span className="text-white ml-2">{user.twitch_id}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Role:</span>
                    <span className={`ml-2 ${user.is_admin ? 'text-yellow-400' : 'text-gray-300'}`}>
                      {user.is_admin ? 'Admin' : 'User'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Created:</span>
                    <span className="text-white ml-2">
                      {new Date(user.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Last Login:</span>
                    <span className="text-white ml-2">
                      {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UserManagementTab() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const limit = 20;

  // Fetch OAuth users
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'oauth-users', page, search],
    queryFn: () => adminApi.getOAuthUsers({ 
      limit, 
      offset: (page - 1) * limit,
      search: search || undefined
    }),
  });

  // Fetch tiers for the user modal
  const { data: tiersData } = useQuery({
    queryKey: ['admin', 'tiers'],
    queryFn: () => tiersApi.getAll(),
  });

  const users = data?.data?.users || [];
  const total = data?.data?.total || 0;
  const totalPages = Math.ceil(total / limit);
  const tiers = tiersData?.data?.tiers || [];

  // Toggle admin mutation
  const toggleAdminMutation = useMutation({
    mutationFn: ({ id, isAdmin }) => adminApi.setUserAdmin(id, isAdmin),
    onSuccess: (_, variables) => {
      addToast(`Admin status ${variables.isAdmin ? 'granted' : 'revoked'}`, 'success');
      queryClient.invalidateQueries(['admin', 'oauth-users']);
    },
    onError: (err) => {
      addToast(err.response?.data?.error || 'Failed to update admin status', 'error');
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: (id) => adminApi.deleteOAuthUser(id),
    onSuccess: () => {
      addToast('User deleted successfully', 'success');
      queryClient.invalidateQueries(['admin', 'oauth-users']);
      setDeleteConfirm(null);
    },
    onError: (err) => {
      addToast(err.response?.data?.error || 'Failed to delete user', 'error');
    },
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    refetch();
  };

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
        <p className="text-red-400">Error loading users: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Users className="w-6 h-6 text-twitch-purple" />
          <h2 className="text-xl font-semibold text-white">User Management</h2>
          <span className="text-sm text-gray-400">({total} users)</span>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center space-x-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-twitch-purple"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-twitch-purple hover:bg-twitch-purple-dark text-white rounded-lg transition-colors"
        >
          Search
        </button>
      </form>

      {/* Users Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Created
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Last Login
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr 
                  key={user.id} 
                  className="hover:bg-gray-700/50 cursor-pointer"
                  onClick={() => setSelectedUser(user)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-3">
                      {user.profile_image_url ? (
                        <img
                          src={user.profile_image_url}
                          alt={user.display_name}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                          <Users className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-medium">{user.display_name}</span>
                          {user.is_admin && (
                            <Crown className="w-4 h-4 text-yellow-400" title="Admin" />
                          )}
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-400">
                          <span>@{user.username}</span>
                          <a
                            href={`https://twitch.tv/${user.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-twitch-purple"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      user.is_admin
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-gray-600 text-gray-300'
                    }`}>
                      {user.is_admin ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(user.created_at)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {formatDate(user.last_login)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAdminMutation.mutate({ 
                            id: user.id, 
                            isAdmin: !user.is_admin 
                          });
                        }}
                        disabled={toggleAdminMutation.isPending}
                        className={`p-2 rounded-lg transition-colors ${
                          user.is_admin
                            ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                            : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                        }`}
                        title={user.is_admin ? 'Revoke admin' : 'Grant admin'}
                      >
                        {user.is_admin ? (
                          <ShieldOff className="w-4 h-4" />
                        ) : (
                          <Shield className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(user);
                        }}
                        className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
                        title="Delete user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} users
          </p>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 text-gray-300">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-red-500/20 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Delete User</h3>
            </div>
            <p className="text-gray-300 mb-2">
              Are you sure you want to delete <strong>{deleteConfirm.display_name}</strong>?
            </p>
            <p className="text-sm text-gray-400 mb-6">
              This will remove their account and all associated data (sessions, requests). This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteUserMutation.mutate(deleteConfirm.id)}
                disabled={deleteUserMutation.isPending}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {deleteUserMutation.isPending ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          tiers={tiers}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}
