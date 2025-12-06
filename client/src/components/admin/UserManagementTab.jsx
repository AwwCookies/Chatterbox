import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
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
  AlertTriangle
} from 'lucide-react';

export default function UserManagementTab() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
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

  const users = data?.data?.users || [];
  const total = data?.data?.total || 0;
  const totalPages = Math.ceil(total / limit);

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
                <tr key={user.id} className="hover:bg-gray-700/50">
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
                        onClick={() => toggleAdminMutation.mutate({ 
                          id: user.id, 
                          isAdmin: !user.is_admin 
                        })}
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
                        onClick={() => setDeleteConfirm(user)}
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
    </div>
  );
}
