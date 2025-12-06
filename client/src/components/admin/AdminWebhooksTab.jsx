import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Webhook, 
  Plus, 
  Trash2, 
  TestTube, 
  Check, 
  X, 
  AlertCircle,
  UserPlus,
  Database,
  Server,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Eye,
  EyeOff,
  ExternalLink
} from 'lucide-react';
import { webhooksApi } from '../../services/api';
import { useToastStore } from '../../stores/toastStore';

const WEBHOOK_TYPES = {
  user_signup: {
    label: 'User Signup',
    description: 'Triggered when a new user signs up via OAuth',
    icon: UserPlus,
    color: 'text-green-400'
  },
  data_request: {
    label: 'Data Request',
    description: 'Triggered when a user requests data export or deletion',
    icon: Database,
    color: 'text-blue-400'
  },
  system_event: {
    label: 'System Event',
    description: 'Important system events like server starts, migrations, etc.',
    icon: Server,
    color: 'text-purple-400'
  },
  error_alert: {
    label: 'Error Alert',
    description: 'Critical errors that require attention',
    icon: AlertTriangle,
    color: 'text-red-400'
  }
};

function WebhookCard({ webhook, onDelete, onTest }) {
  const [showUrl, setShowUrl] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);
  
  const typeConfig = WEBHOOK_TYPES[webhook.webhook_type] || {
    label: webhook.webhook_type,
    icon: Webhook,
    color: 'text-gray-400'
  };
  const TypeIcon = typeConfig.icon;
  
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;
    setDeleting(true);
    try {
      await onDelete(webhook.id);
    } finally {
      setDeleting(false);
    }
  };
  
  const handleTest = async () => {
    setTesting(true);
    try {
      await onTest(webhook.id);
    } finally {
      setTesting(false);
    }
  };
  
  return (
    <div className={`bg-gray-800 rounded-lg p-4 border ${webhook.enabled ? 'border-gray-700' : 'border-red-900/50'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg bg-gray-700 ${typeConfig.color}`}>
            <TypeIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="font-medium text-white">{webhook.name}</h4>
              {!webhook.enabled && (
                <span className="px-2 py-0.5 text-xs bg-red-900/50 text-red-400 rounded">
                  Disabled
                </span>
              )}
              {webhook.consecutive_failures > 0 && (
                <span className="px-2 py-0.5 text-xs bg-yellow-900/50 text-yellow-400 rounded">
                  {webhook.consecutive_failures} failures
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400">{typeConfig.label}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handleTest}
            disabled={testing || !webhook.enabled}
            className="p-2 text-gray-400 hover:text-green-400 hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
            title="Test webhook"
          >
            {testing ? (
              <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <TestTube className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
            title="Delete webhook"
          >
            {deleting ? (
              <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
      
      {/* Webhook URL (masked) */}
      <div className="mt-3 flex items-center space-x-2">
        <code className="flex-1 text-xs bg-gray-900 text-gray-400 px-2 py-1 rounded font-mono overflow-hidden">
          {showUrl ? webhook.webhook_url : webhook.webhook_url?.replace(/\/[\w-]+$/, '/••••••••')}
        </code>
        <button
          onClick={() => setShowUrl(!showUrl)}
          className="p-1 text-gray-500 hover:text-gray-300"
          title={showUrl ? 'Hide URL' : 'Show URL'}
        >
          {showUrl ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      
      {/* Stats */}
      {webhook.last_triggered_at && (
        <p className="mt-2 text-xs text-gray-500">
          Last triggered: {new Date(webhook.last_triggered_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function WebhookModal({ isOpen, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    name: '',
    webhookType: 'user_signup',
    webhookUrl: '',
    enabled: true
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  if (!isOpen) return null;
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validate Discord webhook URL
    const discordWebhookRegex = /^https:\/\/(discord\.com|discordapp\.com|canary\.discord\.com|ptb\.discord\.com)\/api\/webhooks\/\d+\/[\w-]+$/;
    if (!discordWebhookRegex.test(formData.webhookUrl)) {
      setError('Please enter a valid Discord webhook URL');
      return;
    }
    
    setSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
      setFormData({ name: '', webhookType: 'user_signup', webhookUrl: '', enabled: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create webhook');
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-lg mx-4 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Add Admin Webhook</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-400 text-sm flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Webhook Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Admin Alerts"
              required
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-twitch-purple focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Event Type
            </label>
            <select
              value={formData.webhookType}
              onChange={(e) => setFormData({ ...formData, webhookType: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-twitch-purple focus:border-transparent"
            >
              {Object.entries(WEBHOOK_TYPES).map(([value, { label, description }]) => (
                <option key={value} value={value}>
                  {label} - {description}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Discord Webhook URL
            </label>
            <input
              type="url"
              value={formData.webhookUrl}
              onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
              placeholder="https://discord.com/api/webhooks/..."
              required
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-twitch-purple focus:border-transparent font-mono text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Get this from Discord: Server Settings → Integrations → Webhooks
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-600 text-twitch-purple focus:ring-twitch-purple focus:ring-offset-gray-800"
            />
            <label htmlFor="enabled" className="text-sm text-gray-300">
              Enable webhook
            </label>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-twitch-purple hover:bg-twitch-purple-dark text-white rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {submitting && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              <span>Create Webhook</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminWebhooksTab() {
  const [modalOpen, setModalOpen] = useState(false);
  const [helpExpanded, setHelpExpanded] = useState(false);
  const queryClient = useQueryClient();
  const addToast = useToastStore(state => state.addToast);
  
  const { data: webhooks = [], isLoading, error } = useQuery({
    queryKey: ['admin-webhooks'],
    queryFn: () => webhooksApi.adminGetAll().then(res => res.data.webhooks)
  });
  
  const createMutation = useMutation({
    mutationFn: (data) => webhooksApi.adminCreate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-webhooks'] });
      addToast('Webhook created successfully', 'success');
    }
  });
  
  const deleteMutation = useMutation({
    mutationFn: (id) => webhooksApi.adminDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-webhooks'] });
      addToast('Webhook deleted', 'success');
    },
    onError: (err) => {
      addToast(err.response?.data?.error || 'Failed to delete webhook', 'error');
    }
  });
  
  const testMutation = useMutation({
    mutationFn: (id) => webhooksApi.adminTest(id),
    onSuccess: () => {
      addToast('Test notification sent!', 'success');
    },
    onError: (err) => {
      addToast(err.response?.data?.error || 'Test failed', 'error');
    }
  });
  
  // Group webhooks by type
  const webhooksByType = webhooks.reduce((acc, webhook) => {
    const type = webhook.webhook_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(webhook);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Admin Webhooks</h2>
          <p className="text-gray-400 text-sm mt-1">
            Receive Discord notifications for important server events
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-twitch-purple hover:bg-twitch-purple-dark text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Webhook</span>
        </button>
      </div>
      
      {/* Help Section */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700">
        <button
          onClick={() => setHelpExpanded(!helpExpanded)}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div className="flex items-center space-x-2 text-gray-300">
            <HelpCircle className="w-5 h-5" />
            <span className="font-medium">How to set up admin webhooks</span>
          </div>
          {helpExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </button>
        
        {helpExpanded && (
          <div className="px-4 pb-4 space-y-4 text-sm text-gray-400">
            <div>
              <h4 className="font-medium text-gray-300 mb-2">Creating a Discord Webhook:</h4>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Open your Discord server settings</li>
                <li>Navigate to Integrations → Webhooks</li>
                <li>Click "New Webhook" and configure it</li>
                <li>Copy the Webhook URL</li>
              </ol>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-300 mb-2">Event Types:</h4>
              <ul className="space-y-2 ml-2">
                {Object.entries(WEBHOOK_TYPES).map(([type, config]) => (
                  <li key={type} className="flex items-start space-x-2">
                    <config.icon className={`w-4 h-4 mt-0.5 ${config.color}`} />
                    <div>
                      <span className="text-gray-300">{config.label}:</span>{' '}
                      {config.description}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            
            <a
              href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 text-twitch-purple hover:underline"
            >
              <span>Discord Webhook Documentation</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
      
      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-twitch-purple border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      
      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-400 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5" />
          <span>Failed to load webhooks: {error.message}</span>
        </div>
      )}
      
      {/* Empty State */}
      {!isLoading && !error && webhooks.length === 0 && (
        <div className="text-center py-12">
          <Webhook className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-300">No webhooks configured</h3>
          <p className="text-gray-500 mt-1 mb-4">
            Set up webhooks to receive Discord notifications for server events
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-twitch-purple hover:bg-twitch-purple-dark text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Webhook</span>
          </button>
        </div>
      )}
      
      {/* Webhooks List */}
      {!isLoading && webhooks.length > 0 && (
        <div className="space-y-6">
          {Object.entries(WEBHOOK_TYPES).map(([type, config]) => {
            const typeWebhooks = webhooksByType[type] || [];
            if (typeWebhooks.length === 0) return null;
            
            return (
              <div key={type}>
                <h3 className={`text-sm font-medium ${config.color} mb-3 flex items-center space-x-2`}>
                  <config.icon className="w-4 h-4" />
                  <span>{config.label}</span>
                  <span className="text-gray-500">({typeWebhooks.length})</span>
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {typeWebhooks.map(webhook => (
                    <WebhookCard
                      key={webhook.id}
                      webhook={webhook}
                      onDelete={(id) => deleteMutation.mutateAsync(id)}
                      onTest={(id) => testMutation.mutateAsync(id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Create Modal */}
      <WebhookModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={(data) => createMutation.mutateAsync(data)}
      />
    </div>
  );
}

export default AdminWebhooksTab;
