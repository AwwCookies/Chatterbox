import { useState } from 'react';
import { 
  RefreshCw, 
  Unlink, 
  HelpCircle, 
  ExternalLink,
  Server,
  Hash,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

// Discord brand color
const DISCORD_COLOR = '#5865F2';

/**
 * Discord Integration Card - Shows connection status and controls
 */
export function DiscordIntegrationCard({ 
  status, 
  loading, 
  onConnect, 
  onDisconnect, 
  onRefresh,
  guildsCount = 0,
}) {
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [deleteWebhooks, setDeleteWebhooks] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await onDisconnect(deleteWebhooks);
    } finally {
      setDisconnecting(false);
      setShowDisconnectConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-twitch-gray rounded-lg border border-gray-700 p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          <span className="text-gray-400">Loading Discord status...</span>
        </div>
      </div>
    );
  }

  if (status?.expired) {
    return (
      <div className="bg-twitch-gray rounded-lg border border-yellow-600/50 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-yellow-500/10">
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white mb-1">Discord Session Expired</h3>
            <p className="text-gray-400 text-sm mb-4">
              Your Discord session has expired. Please reconnect to continue using Discord integration.
            </p>
            <button
              onClick={onConnect}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
              style={{ backgroundColor: DISCORD_COLOR }}
            >
              <DiscordLogo className="w-5 h-5" />
              Reconnect Discord
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <div className="bg-twitch-gray rounded-lg border border-gray-700 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg" style={{ backgroundColor: `${DISCORD_COLOR}20` }}>
            <DiscordLogo className="w-6 h-6" style={{ color: DISCORD_COLOR }} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-white">Discord Integration</h3>
              <a 
                href="https://discord.com/developers/docs/topics/oauth2" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-400"
              >
                <HelpCircle className="w-4 h-4" />
              </a>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Connect your Discord account to automatically create webhooks in your servers 
              without copying URLs. You'll be able to browse your servers and channels directly.
            </p>
            <button
              onClick={onConnect}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-all hover:brightness-110"
              style={{ backgroundColor: DISCORD_COLOR }}
            >
              <DiscordLogo className="w-5 h-5" />
              Connect Discord Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Connected state
  return (
    <div className="bg-twitch-gray rounded-lg border border-gray-700 p-6">
      <div className="flex items-start gap-4">
        <div className="relative">
          {status.avatarUrl ? (
            <img 
              src={status.avatarUrl} 
              alt={status.username}
              className="w-12 h-12 rounded-full"
            />
          ) : (
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: DISCORD_COLOR }}
            >
              <DiscordLogo className="w-6 h-6 text-white" />
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-twitch-gray" />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-white">Discord Connected</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
              Active
            </span>
          </div>
          
          <p className="text-gray-300 text-sm">
            {status.username}
            {status.discriminator && status.discriminator !== '0' && (
              <span className="text-gray-500">#{status.discriminator}</span>
            )}
          </p>
          
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Server className="w-3 h-3" />
              {guildsCount} server{guildsCount !== 1 ? 's' : ''} with webhook access
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh connection"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowDisconnectConfirm(true)}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Disconnect Discord"
          >
            <Unlink className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Disconnect confirmation modal */}
      {showDisconnectConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-twitch-dark rounded-lg border border-gray-700 p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-white mb-2">Disconnect Discord?</h3>
            <p className="text-gray-400 text-sm mb-4">
              This will remove the Discord connection from your account.
            </p>
            
            <label className="flex items-center gap-2 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={deleteWebhooks}
                onChange={(e) => setDeleteWebhooks(e.target.checked)}
                className="rounded border-gray-600 bg-twitch-gray text-twitch-purple focus:ring-twitch-purple"
              />
              <span className="text-sm text-gray-300">
                Also delete webhooks created via Discord OAuth
              </span>
            </label>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDisconnectConfirm(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {disconnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Unlink className="w-4 h-4" />
                )}
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Discord Logo SVG component
 */
function DiscordLogo({ className, style }) {
  return (
    <svg 
      className={className} 
      style={style}
      viewBox="0 0 24 24" 
      fill="currentColor"
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  );
}

export default DiscordIntegrationCard;
