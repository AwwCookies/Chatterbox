import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { usersApi } from '../services/api';
import { useSettingsStore } from '../stores/settingsStore';
import { useProfileCardStore } from '../stores/profileCardStore';
import SearchBar from '../components/common/SearchBar';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { formatNumber, formatRelative } from '../utils/formatters';
import { 
  Users as UsersIcon, 
  Search, 
  Trophy, 
  Ban, 
  MessageSquare, 
  Clock, 
  Shield,
  Download,
  Trash2,
  AlertTriangle,
  UserX,
  UserCheck,
  FileText,
  ChevronDown,
  ChevronUp,
  X,
  Filter,
  RefreshCw,
  ExternalLink,
  Timer
} from 'lucide-react';

function UserRow({ user, isAdmin, onAction }) {
  const [expanded, setExpanded] = useState(false);
  const openProfileCard = useProfileCardStore(state => state.openCard);
  
  return (
    <div className={`border-b border-gray-700 ${user.is_blocked ? 'bg-red-900/10' : ''}`}>
      <div 
        className="flex items-center gap-4 p-4 hover:bg-gray-800/50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                openProfileCard(user.username);
              }}
              className="font-medium text-twitch-purple hover:underline"
            >
              {user.display_name || user.username}
            </button>
            {user.is_blocked && (
              <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full flex items-center gap-1">
                <Ban className="w-3 h-3" />
                Blocked
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">@{user.username}</p>
        </div>
        
        <div className="text-right">
          <p className="text-sm font-medium text-white">{formatNumber(user.message_count || 0)}</p>
          <p className="text-xs text-gray-500">messages</p>
        </div>
        
        <div className="text-right hidden sm:block">
          <p className="text-sm text-gray-300">{formatNumber(user.timeout_count || 0)}</p>
          <p className="text-xs text-gray-500">timeouts</p>
        </div>
        
        <div className="text-right hidden md:block">
          <p className="text-sm text-gray-300">{formatNumber(user.ban_count || 0)}</p>
          <p className="text-xs text-gray-500">bans</p>
        </div>
        
        <div className="text-right hidden lg:block min-w-[100px]">
          <p className="text-xs text-gray-400">
            {user.last_seen ? formatRelative(user.last_seen) : 'Never'}
          </p>
          <p className="text-xs text-gray-500">last seen</p>
        </div>
        
        <div className="text-gray-500">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>
      
      {expanded && (
        <div className="px-4 pb-4 bg-gray-800/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500">First Seen</p>
              <p className="text-sm text-white">{user.first_seen ? formatRelative(user.first_seen) : 'Unknown'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Last Seen</p>
              <p className="text-sm text-white">{user.last_seen ? formatRelative(user.last_seen) : 'Unknown'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Twitch ID</p>
              <p className="text-sm text-white">{user.twitch_id || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Messages</p>
              <p className="text-sm text-white">{formatNumber(user.message_count || 0)}</p>
            </div>
          </div>
          
          {user.is_blocked && user.blocked_reason && (
            <div className="mb-4 p-2 bg-red-900/20 border border-red-700/50 rounded">
              <p className="text-xs text-red-400">Block Reason: {user.blocked_reason}</p>
            </div>
          )}
          
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/user/${user.username}`}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-twitch-purple/20 text-twitch-purple rounded hover:bg-twitch-purple/30 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              View Profile
            </Link>
            
            {isAdmin && (
              <>
                <button
                  onClick={() => onAction('export', user)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Export Data
                </button>
                
                {user.is_blocked ? (
                  <button
                    onClick={() => onAction('unblock', user)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors"
                  >
                    <UserCheck className="w-3 h-3" />
                    Unblock
                  </button>
                ) : (
                  <button
                    onClick={() => onAction('block', user)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-orange-500/20 text-orange-400 rounded hover:bg-orange-500/30 transition-colors"
                  >
                    <UserX className="w-3 h-3" />
                    Block
                  </button>
                )}
                
                <button
                  onClick={() => onAction('deleteMessages', user)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-yellow-500/20 text-yellow-400 rounded hover:bg-yellow-500/30 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete Messages
                </button>
                
                <button
                  onClick={() => onAction('delete', user)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                >
                  <AlertTriangle className="w-3 h-3" />
                  Delete User
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', danger = false }) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-twitch-gray rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className={`w-6 h-6 ${danger ? 'text-red-400' : 'text-yellow-400'}`} />
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <p className="text-gray-300 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm rounded transition-colors ${
              danger 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-twitch-purple hover:bg-twitch-purple-dark text-white'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function BlockModal({ isOpen, onClose, onConfirm, username }) {
  const [reason, setReason] = useState('');
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-twitch-gray rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <UserX className="w-6 h-6 text-orange-400" />
          <h3 className="text-lg font-semibold text-white">Block User</h3>
        </div>
        <p className="text-gray-300 mb-4">
          Block <span className="text-twitch-purple font-medium">@{username}</span> from being logged?
          Their future messages will not be recorded.
        </p>
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-1">Reason (optional)</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason for blocking..."
            className="w-full px-3 py-2 bg-twitch-dark border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded transition-colors"
          >
            Block User
          </button>
        </div>
      </div>
    </div>
  );
}

function Users() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialUsername = searchParams.get('username') || '';
  const initialSearch = searchParams.get('search') || '';
  
  const [searchQuery, setSearchQuery] = useState(initialSearch || initialUsername);
  const [view, setView] = useState(initialUsername || initialSearch ? 'search' : 'top'); // 'top', 'search', 'blocked'
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: null, user: null });
  const [blockModal, setBlockModal] = useState({ isOpen: false, user: null });
  
  const apiKey = useSettingsStore(state => state.apiKey);
  const resultsPerPage = useSettingsStore(state => state.resultsPerPage);
  const isAdmin = !!apiKey;
  
  const queryClient = useQueryClient();

  // Sync URL params with state
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery && view === 'search') {
      params.set('search', searchQuery);
    }
    if (view === 'blocked') {
      params.set('view', 'blocked');
    }
    setSearchParams(params, { replace: true });
  }, [searchQuery, view, setSearchParams]);
  
  // Fetch top users
  const { data: topUsersData, isLoading: topLoading, refetch: refetchTop } = useQuery({
    queryKey: ['users', 'top', resultsPerPage],
    queryFn: () => usersApi.getTop({ limit: resultsPerPage }).then(res => res.data),
    enabled: view === 'top',
  });
  
  // Search users
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ['users', 'search', searchQuery, resultsPerPage],
    queryFn: () => usersApi.getAll({ search: searchQuery, limit: resultsPerPage }).then(res => res.data),
    enabled: view === 'search' && searchQuery.length > 0,
  });
  
  // Fetch blocked users
  const { data: blockedData, isLoading: blockedLoading, refetch: refetchBlocked } = useQuery({
    queryKey: ['users', 'blocked', resultsPerPage],
    queryFn: () => usersApi.getBlocked({ limit: resultsPerPage }).then(res => res.data),
    enabled: view === 'blocked' && isAdmin,
  });
  
  // Mutations
  const blockMutation = useMutation({
    mutationFn: ({ username, reason }) => usersApi.block(username, reason),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      setBlockModal({ isOpen: false, user: null });
    },
  });
  
  const unblockMutation = useMutation({
    mutationFn: (username) => usersApi.unblock(username),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      setConfirmModal({ isOpen: false, action: null, user: null });
    },
  });
  
  const deleteMessagesMutation = useMutation({
    mutationFn: (username) => usersApi.deleteMessages(username),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      setConfirmModal({ isOpen: false, action: null, user: null });
    },
  });
  
  const deleteUserMutation = useMutation({
    mutationFn: (username) => usersApi.deleteUser(username),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      setConfirmModal({ isOpen: false, action: null, user: null });
    },
  });
  
  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.length > 0) {
      setView('search');
    } else {
      setView('top');
    }
  };
  
  const handleAction = async (action, user) => {
    switch (action) {
      case 'export':
        try {
          const response = await usersApi.exportData(user.username);
          const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${user.username}_data_export.json`;
          a.click();
          URL.revokeObjectURL(url);
        } catch (error) {
          console.error('Export failed:', error);
        }
        break;
      case 'block':
        setBlockModal({ isOpen: true, user });
        break;
      case 'unblock':
        setConfirmModal({
          isOpen: true,
          action: 'unblock',
          user,
          title: 'Unblock User',
          message: `Are you sure you want to unblock @${user.username}? Their messages will be logged again.`,
          confirmText: 'Unblock',
          danger: false,
        });
        break;
      case 'deleteMessages':
        setConfirmModal({
          isOpen: true,
          action: 'deleteMessages',
          user,
          title: 'Delete All Messages',
          message: `Are you sure you want to delete all ${formatNumber(user.message_count || 0)} messages from @${user.username}? This action cannot be undone.`,
          confirmText: 'Delete Messages',
          danger: true,
        });
        break;
      case 'delete':
        setConfirmModal({
          isOpen: true,
          action: 'delete',
          user,
          title: 'Delete User',
          message: `Are you sure you want to permanently delete @${user.username} and all their data? This includes all messages and mod actions. This action cannot be undone.`,
          confirmText: 'Delete User',
          danger: true,
        });
        break;
    }
  };
  
  const handleConfirm = () => {
    const { action, user } = confirmModal;
    switch (action) {
      case 'unblock':
        unblockMutation.mutate(user.username);
        break;
      case 'deleteMessages':
        deleteMessagesMutation.mutate(user.username);
        break;
      case 'delete':
        deleteUserMutation.mutate(user.username);
        break;
    }
  };
  
  const handleBlockConfirm = (reason) => {
    blockMutation.mutate({ username: blockModal.user.username, reason });
  };
  
  const users = useMemo(() => {
    switch (view) {
      case 'top':
        return topUsersData?.users || [];
      case 'search':
        return searchData?.users || [];
      case 'blocked':
        return blockedData?.users || [];
      default:
        return [];
    }
  }, [view, topUsersData, searchData, blockedData]);
  
  const isLoading = view === 'top' ? topLoading : view === 'search' ? searchLoading : blockedLoading;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <UsersIcon className="w-6 h-6 text-twitch-purple" />
            Users
          </h1>
          <p className="text-gray-400">View and manage tracked users</p>
        </div>
        
        {isAdmin && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-400 flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Admin Mode
            </span>
          </div>
        )}
      </div>
      
      {/* Search & Filters */}
      <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <SearchBar 
              placeholder="Search users..." 
              onSearch={handleSearch}
              defaultValue={searchQuery}
            />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => { setView('top'); setSearchQuery(''); }}
              className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                view === 'top' 
                  ? 'bg-twitch-purple text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Trophy className="w-4 h-4" />
              Top Users
            </button>
            
            {isAdmin && (
              <button
                onClick={() => setView('blocked')}
                className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                  view === 'blocked' 
                    ? 'bg-red-500 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <Ban className="w-4 h-4" />
                Blocked
                {blockedData?.total > 0 && (
                  <span className="px-1.5 py-0.5 text-xs bg-red-600 rounded-full">
                    {blockedData.total}
                  </span>
                )}
              </button>
            )}
            
            <button
              onClick={() => view === 'top' ? refetchTop() : view === 'blocked' ? refetchBlocked() : null}
              className="p-2 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>
      
      {/* Stats Summary */}
      {view === 'top' && topUsersData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-1">
              <UsersIcon className="w-4 h-4 text-twitch-purple" />
              <span className="text-sm text-gray-400">Total Users</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatNumber(topUsersData.total || 0)}</p>
          </div>
          
          <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-gray-400">Top Chatter</span>
            </div>
            <p className="text-lg font-bold text-white truncate">
              {topUsersData.users?.[0]?.display_name || '-'}
            </p>
          </div>
          
          <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="w-4 h-4 text-green-400" />
              <span className="text-sm text-gray-400">Top Messages</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {formatNumber(topUsersData.users?.[0]?.message_count || 0)}
            </p>
          </div>
          
          <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-1">
              <Timer className="w-4 h-4 text-orange-400" />
              <span className="text-sm text-gray-400">Most Timeouts</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {formatNumber(Math.max(...(topUsersData.users?.map(u => u.timeout_count) || [0])))}
            </p>
          </div>
        </div>
      )}
      
      {/* User List */}
      <div className="bg-twitch-gray rounded-lg border border-gray-700 overflow-hidden">
        {/* Table Header */}
        <div className="hidden sm:flex items-center gap-4 px-4 py-3 bg-gray-800/50 text-xs text-gray-400 uppercase tracking-wide">
          <div className="flex-1">User</div>
          <div className="w-24 text-right">Messages</div>
          <div className="w-20 text-right hidden sm:block">Timeouts</div>
          <div className="w-16 text-right hidden md:block">Bans</div>
          <div className="w-24 text-right hidden lg:block">Last Seen</div>
          <div className="w-8"></div>
        </div>
        
        {/* User Rows */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <UsersIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>
              {view === 'search' && searchQuery 
                ? `No users found matching "${searchQuery}"`
                : view === 'blocked'
                ? 'No blocked users'
                : 'No users found'
              }
            </p>
          </div>
        ) : (
          <div>
            {users.map((user, index) => (
              <UserRow 
                key={user.id || index}
                user={user}
                isAdmin={isAdmin}
                onAction={handleAction}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Results info */}
      {users.length > 0 && (
        <p className="text-sm text-gray-400 text-center">
          Showing {users.length} of {
            view === 'top' ? topUsersData?.total : 
            view === 'blocked' ? blockedData?.total : 
            searchData?.users?.length || 0
          } users
        </p>
      )}
      
      {/* Modals */}
      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, action: null, user: null })}
        onConfirm={handleConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        danger={confirmModal.danger}
      />
      
      <BlockModal
        isOpen={blockModal.isOpen}
        onClose={() => setBlockModal({ isOpen: false, user: null })}
        onConfirm={handleBlockConfirm}
        username={blockModal.user?.username}
      />
    </div>
  );
}

export default Users;
