import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSettingsStore } from '../../stores/settingsStore';
import { useToast } from '../../stores/toastStore';
import { adminApi } from '../../services/api';
import {
  FileText,
  Download,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  MessageSquare,
  Calendar,
  RefreshCw,
  Loader2,
  Eye,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

// Status badge component
function StatusBadge({ status }) {
  const config = {
    pending: { color: 'text-yellow-400 bg-yellow-500/20', icon: Clock, label: 'Pending' },
    approved: { color: 'text-blue-400 bg-blue-500/20', icon: CheckCircle, label: 'Approved' },
    denied: { color: 'text-red-400 bg-red-500/20', icon: XCircle, label: 'Denied' },
    completed: { color: 'text-green-400 bg-green-500/20', icon: CheckCircle, label: 'Completed' },
    cancelled: { color: 'text-gray-400 bg-gray-500/20', icon: XCircle, label: 'Cancelled' },
  };
  
  const cfg = config[status] || config.pending;
  const Icon = cfg.icon;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// Type badge component - accepts either 'type' or 'request_type'
function TypeBadge({ type, request_type }) {
  const requestType = type || request_type;
  const config = {
    export: { color: 'text-blue-400 bg-blue-500/20', icon: Download, label: 'Data Export' },
    delete: { color: 'text-red-400 bg-red-500/20', icon: Trash2, label: 'Account Deletion' },
  };
  
  const cfg = config[requestType] || config.export;
  const Icon = cfg.icon;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// Format date helper
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

// Helper to normalize request data (handle both snake_case from list and camelCase from detail API)
function normalizeRequest(request) {
  if (!request) return null;
  
  // Handle nested user object from API
  const user = request.user || {};
  
  return {
    ...request,
    // Normalize type field
    request_type: request.request_type || request.type,
    // Normalize date fields
    created_at: request.created_at || request.createdAt,
    updated_at: request.updated_at || request.updatedAt,
    processed_at: request.processed_at || request.processedAt,
    // Normalize notes
    admin_notes: request.admin_notes || request.adminNotes,
    user_notes: request.user_notes || request.userNotes || request.reason,
    // Flatten user fields for table display
    display_name: request.display_name || user.displayName || user.display_name,
    username: request.username || user.username,
    profile_image_url: request.profile_image_url || user.profileImageUrl || user.profile_image_url,
    // Also keep nested user object for modal
    user: {
      ...user,
      display_name: user.display_name || user.displayName,
      profile_image_url: user.profile_image_url || user.profileImageUrl,
      twitch_id: user.twitch_id || user.twitchId,
    },
    stats: request.stats || request.userStats,
  };
}

// Request detail modal
function RequestDetailModal({ request: rawRequest, onClose, onApprove, onDeny, isProcessing }) {
  const [adminNotes, setAdminNotes] = useState('');
  const request = normalizeRequest(rawRequest);

  if (!request) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-twitch-dark rounded-lg border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Request Details</h2>
              <p className="text-sm text-gray-400 mt-1">ID: {request.id}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* User Info */}
          <div className="bg-gray-800/50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
              <User className="w-4 h-4" /> User Information
            </h3>
            <div className="flex items-center gap-4">
              {request.user?.profile_image_url && (
                <img
                  src={request.user.profile_image_url}
                  alt={request.user.display_name}
                  className="w-12 h-12 rounded-full"
                />
              )}
              <div>
                <p className="text-white font-medium">{request.user?.display_name || 'Unknown User'}</p>
                <p className="text-sm text-gray-400">@{request.user?.username || 'unknown'}</p>
                <p className="text-xs text-gray-500">Twitch ID: {request.user?.twitch_id || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Request Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Request Type</p>
              <TypeBadge type={request.request_type} />
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Status</p>
              <StatusBadge status={request.status} />
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Requested At</p>
              <p className="text-white text-sm">{formatDate(request.created_at)}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Updated At</p>
              <p className="text-white text-sm">{formatDate(request.updated_at)}</p>
            </div>
          </div>

          {/* User Stats */}
          {request.stats && (
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> User Stats
              </h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-white">{request.stats.messageCount?.toLocaleString() || 0}</p>
                  <p className="text-xs text-gray-400">Messages</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{request.stats.modActionCount?.toLocaleString() || 0}</p>
                  <p className="text-xs text-gray-400">Mod Actions</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{request.stats.channelCount?.toLocaleString() || 0}</p>
                  <p className="text-xs text-gray-400">Channels</p>
                </div>
              </div>
            </div>
          )}

          {/* User Notes */}
          {request.user_notes && (
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">User Notes</h3>
              <p className="text-white text-sm">{request.user_notes}</p>
            </div>
          )}

          {/* Admin Notes */}
          {request.admin_notes && (
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Admin Notes</h3>
              <p className="text-white text-sm">{request.admin_notes}</p>
            </div>
          )}

          {/* Actions */}
          {request.status === 'pending' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Admin Notes (Optional)
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this decision..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-twitch-purple"
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => onApprove(adminNotes)}
                  disabled={isProcessing}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Approve Request
                </button>
                <button
                  onClick={() => onDeny(adminNotes)}
                  disabled={isProcessing}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  Deny Request
                </button>
              </div>

              {request.request_type === 'delete' && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-300">
                    <strong>Warning:</strong> Approving this deletion request will permanently remove all of this user's messages and data from the database. This action cannot be undone.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UserRequestsTab() {
  const apiKey = useSettingsStore(state => state.apiKey);
  const toast = useToast();
  const queryClient = useQueryClient();
  
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch requests
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'user-requests', page, statusFilter, typeFilter],
    queryFn: () => adminApi.getUserRequests({
      page,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      type: typeFilter !== 'all' ? typeFilter : undefined,
      limit: 20
    }),
    enabled: !!apiKey,
  });

  // Fetch pending count for badge
  const { data: pendingData } = useQuery({
    queryKey: ['admin', 'user-requests', 'pending-count'],
    queryFn: () => adminApi.getPendingRequests(),
    enabled: !!apiKey,
    refetchInterval: 30000,
  });

  // Fetch request details
  const { data: requestDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['admin', 'user-request', selectedRequest?.id],
    queryFn: () => adminApi.getRequest(selectedRequest.id),
    enabled: !!selectedRequest?.id,
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: ({ id, notes }) => adminApi.approveRequest(id, notes),
    onSuccess: (data) => {
      toast.success(`Request approved successfully`);
      queryClient.invalidateQueries(['admin', 'user-requests']);
      setSelectedRequest(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to approve request');
    },
  });

  // Deny mutation
  const denyMutation = useMutation({
    mutationFn: ({ id, notes }) => adminApi.denyRequest(id, notes),
    onSuccess: () => {
      toast.success('Request denied');
      queryClient.invalidateQueries(['admin', 'user-requests']);
      setSelectedRequest(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to deny request');
    },
  });

  const handleApprove = async (notes) => {
    setIsProcessing(true);
    try {
      await approveMutation.mutateAsync({ id: selectedRequest.id, notes });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeny = async (notes) => {
    setIsProcessing(true);
    try {
      await denyMutation.mutateAsync({ id: selectedRequest.id, notes });
    } finally {
      setIsProcessing(false);
    }
  };

  const rawRequests = data?.data?.requests || [];
  const requests = rawRequests.map(normalizeRequest);
  const pagination = data?.data?.pagination || { total: 0, pages: 1, total: rawRequests.length };
  const pendingCount = pendingData?.data?.requests?.length || 0;

  if (!apiKey) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <AlertTriangle className="w-12 h-12 mb-4 text-yellow-500" />
        <p className="text-lg font-medium">API Key Required</p>
        <p className="text-sm mt-1">Please configure your API key in settings to access admin features.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-white">User Requests</h2>
          {pendingCount > 0 && (
            <span className="px-2.5 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-medium">
              {pendingCount} pending
            </span>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-twitch-purple"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Type</label>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-twitch-purple"
          >
            <option value="all">All Types</option>
            <option value="export">Data Export</option>
            <option value="delete">Account Deletion</option>
          </select>
        </div>
      </div>

      {/* Requests Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-twitch-purple" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-red-400">
          <XCircle className="w-12 h-12 mb-4" />
          <p>Failed to load requests</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <FileText className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">No requests found</p>
          <p className="text-sm mt-1">User data requests will appear here.</p>
        </div>
      ) : (
        <div className="bg-gray-800/30 rounded-lg border border-gray-700/50 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">User</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Type</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Status</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Requested</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {request.profile_image_url && (
                        <img
                          src={request.profile_image_url}
                          alt=""
                          className="w-8 h-8 rounded-full"
                        />
                      )}
                      <div>
                        <p className="text-white font-medium">{request.display_name || 'Unknown'}</p>
                        <p className="text-xs text-gray-400">@{request.username || 'unknown'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <TypeBadge type={request.request_type} />
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={request.status} />
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-300">
                    {formatDate(request.created_at)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Showing {requests.length} of {pagination.total} requests
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-300">
              Page {page} of {pagination.pages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
              disabled={page === pagination.pages}
              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedRequest && (
        <RequestDetailModal
          request={requestDetail?.data?.request || selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onApprove={handleApprove}
          onDeny={handleDeny}
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
}

export default UserRequestsTab;
