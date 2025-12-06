import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../stores/toastStore';
import {
  User,
  LogOut,
  Download,
  Trash2,
  Clock,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  Calendar
} from 'lucide-react';

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const statusColors = {
  pending: 'text-yellow-400 bg-yellow-400/10',
  approved: 'text-green-400 bg-green-400/10',
  denied: 'text-red-400 bg-red-400/10',
  completed: 'text-blue-400 bg-blue-400/10'
};

const statusIcons = {
  pending: Clock,
  approved: CheckCircle,
  denied: XCircle,
  completed: CheckCircle
};

function RequestCard({ request, onCancel }) {
  const StatusIcon = statusIcons[request.status] || Clock;
  const isExport = request.type === 'export';
  const canDownload = isExport && request.status === 'approved' && request.downloadUrl;
  const canCancel = request.status === 'pending';

  const handleDownload = () => {
    if (request.downloadUrl.startsWith('data:')) {
      // Base64 data URL - create download link
      const link = document.createElement('a');
      link.href = request.downloadUrl;
      link.download = `chatterbox-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Regular URL
      window.open(request.downloadUrl, '_blank');
    }
  };

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${isExport ? 'bg-blue-500/20' : 'bg-red-500/20'}`}>
            {isExport ? (
              <Download className="w-5 h-5 text-blue-400" />
            ) : (
              <Trash2 className="w-5 h-5 text-red-400" />
            )}
          </div>
          <div>
            <h3 className="font-medium text-white">
              {isExport ? 'Data Export Request' : 'Data Deletion Request'}
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Submitted {formatDate(request.createdAt)}
            </p>
            {request.reason && (
              <p className="text-sm text-gray-300 mt-2">
                <span className="text-gray-500">Reason:</span> {request.reason}
              </p>
            )}
            {request.adminNotes && (
              <p className="text-sm text-gray-300 mt-2">
                <span className="text-gray-500">Admin notes:</span> {request.adminNotes}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusColors[request.status]}`}>
            <StatusIcon className="w-3 h-3" />
            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
          </span>

          {canDownload && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors"
            >
              <Download className="w-3 h-3" />
              Download
            </button>
          )}

          {canCancel && (
            <button
              onClick={() => onCancel(request.id)}
              className="text-sm text-gray-400 hover:text-red-400 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {request.processedAt && (
        <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-700">
          Processed {formatDate(request.processedAt)}
        </p>
      )}

      {request.downloadExpiresAt && canDownload && (
        <p className="text-xs text-yellow-500 mt-2">
          Download expires {formatDate(request.downloadExpiresAt)}
        </p>
      )}
    </div>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const { 
    user, 
    isAuthenticated, 
    requests, 
    logout, 
    logoutAll, 
    createRequest, 
    cancelRequest,
    refreshProfile,
    isLoading 
  } = useAuth();
  const { showToast } = useToast();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [exportReason, setExportReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refresh profile data when component mounts to get latest request statuses
  useEffect(() => {
    if (isAuthenticated) {
      refreshProfile();
    }
  }, [isAuthenticated, refreshProfile]);

  if (!isAuthenticated || !user) {
    navigate('/login?returnUrl=/profile');
    return null;
  }

  const handleExportRequest = async () => {
    setIsSubmitting(true);
    try {
      await createRequest('export', exportReason || null);
      setExportReason('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRequest = async () => {
    setIsSubmitting(true);
    try {
      await createRequest('delete', deleteReason || null);
      setDeleteReason('');
      setShowDeleteConfirm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRequest = async (requestId) => {
    await cancelRequest(requestId);
  };

  // Only block new requests if there's a pending or approved (in-progress) request
  // Denied requests should not block new requests
  const pendingExport = requests.find(r => r.type === 'export' && (r.status === 'pending' || r.status === 'approved'));
  const pendingDelete = requests.find(r => r.type === 'delete' && (r.status === 'pending' || r.status === 'approved'));
  
  // Get the most recent denied requests to show a message
  const recentDeniedExport = requests.find(r => r.type === 'export' && r.status === 'denied');
  const recentDeniedDelete = requests.find(r => r.type === 'delete' && r.status === 'denied');

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Profile Header */}
      <div className="bg-twitch-gray rounded-lg p-6 border border-gray-700">
        <div className="flex items-start gap-4">
          {user.profile_image_url ? (
            <img
              src={user.profile_image_url}
              alt={user.display_name}
              className="w-20 h-20 rounded-full border-4 border-twitch-purple"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-twitch-purple flex items-center justify-center">
              <User className="w-10 h-10 text-white" />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">
              {user.display_name || user.username}
            </h1>
            <p className="text-gray-400">@{user.username}</p>
            
            <div className="flex items-center gap-4 mt-4 text-sm text-gray-400">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>Joined {formatDate(user.created_at)}</span>
              </div>
              {user.is_admin && (
                <span className="flex items-center gap-1 text-twitch-purple">
                  <Shield className="w-4 h-4" />
                  Admin
                </span>
              )}
            </div>
          </div>
          
          <a
            href={`https://twitch.tv/${user.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-twitch-purple hover:bg-twitch-purple-dark text-white rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Twitch Profile
          </a>
        </div>
      </div>

      {/* Data Requests Section */}
      <div className="bg-twitch-gray rounded-lg border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Your Data</h2>
          <p className="text-gray-400 mt-1">
            Manage your chat history and data stored in Chatterbox
          </p>
        </div>

        <div className="p-6 grid md:grid-cols-2 gap-6">
          {/* Export Data */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Download className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium text-white">Export Your Data</h3>
                <p className="text-sm text-gray-400 mt-1">
                  Request a copy of all your archived messages and moderation history.
                  An admin will review and approve your request.
                </p>
              </div>
            </div>

            {pendingExport ? (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-400">
                {pendingExport.status === 'approved' 
                  ? 'Your export request has been approved and is being processed'
                  : 'You already have a pending export request'}
              </div>
            ) : (
              <div className="space-y-3">
                {recentDeniedExport && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                    <p className="font-medium">Your previous export request was denied</p>
                    {recentDeniedExport.adminNotes && (
                      <p className="mt-1 text-red-300">Reason: {recentDeniedExport.adminNotes}</p>
                    )}
                    <p className="mt-2 text-gray-400">You may submit a new request.</p>
                  </div>
                )}
                <textarea
                  value={exportReason}
                  onChange={(e) => setExportReason(e.target.value)}
                  placeholder="Reason for export (optional)"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-twitch-purple focus:outline-none"
                  rows={2}
                />
                <button
                  onClick={handleExportRequest}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Request Export
                </button>
              </div>
            )}
          </div>

          {/* Delete Data */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-medium text-white">Delete Your Data</h3>
                <p className="text-sm text-gray-400 mt-1">
                  Request permanent deletion of all your archived messages and history.
                  This action cannot be undone.
                </p>
              </div>
            </div>

            {pendingDelete ? (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-400">
                {pendingDelete.status === 'approved' 
                  ? 'Your deletion request has been approved and is being processed'
                  : 'You already have a pending deletion request'}
              </div>
            ) : !showDeleteConfirm ? (
              <div className="space-y-3">
                {recentDeniedDelete && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                    <p className="font-medium">Your previous deletion request was denied</p>
                    {recentDeniedDelete.adminNotes && (
                      <p className="mt-1 text-red-300">Reason: {recentDeniedDelete.adminNotes}</p>
                    )}
                    <p className="mt-2 text-gray-400">You may submit a new request.</p>
                  </div>
                )}
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Request Deletion
                </button>
              </div>
            ) : (
              <div className="space-y-3 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <div className="flex items-start gap-2 text-red-400">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">
                    This will permanently delete all your messages and moderation history.
                    This cannot be undone.
                  </p>
                </div>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Reason for deletion (optional)"
                  className="w-full px-3 py-2 bg-gray-800 border border-red-500/50 rounded-lg text-white text-sm focus:border-red-500 focus:outline-none"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteRequest}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Confirm Deletion Request
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteReason('');
                    }}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Request History */}
      {requests.length > 0 && (
        <div className="bg-twitch-gray rounded-lg border border-gray-700">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">Request History</h2>
          </div>
          <div className="p-6 space-y-4">
            {requests.map((request) => (
              <RequestCard 
                key={request.id} 
                request={request} 
                onCancel={handleCancelRequest}
              />
            ))}
          </div>
        </div>
      )}

      {/* Account Actions */}
      <div className="bg-twitch-gray rounded-lg border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Account</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-white">Sign Out</h3>
              <p className="text-sm text-gray-400">Sign out of this device</p>
            </div>
            <button
              onClick={logout}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
          
          <div className="flex items-center justify-between pt-4 border-t border-gray-700">
            <div>
              <h3 className="font-medium text-white">Sign Out Everywhere</h3>
              <p className="text-sm text-gray-400">Sign out of all devices</p>
            </div>
            <button
              onClick={logoutAll}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out All Devices
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
