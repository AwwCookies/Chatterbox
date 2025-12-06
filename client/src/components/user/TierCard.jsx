import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { meApi } from '../../services/api';
import {
  Crown,
  Zap,
  Webhook,
  Search,
  Clock,
  Download,
  Wifi,
  ArrowRight,
  Loader2,
  Infinity,
  Shield,
  TrendingUp,
  Activity,
  HelpCircle,
} from 'lucide-react';

// Progress bar with percentage
function UsageBar({ current, max, label, warning = false }) {
  const isUnlimited = max === -1 || max === null;
  const percentage = isUnlimited ? 0 : Math.min((current / max) * 100, 100);
  const isWarning = percentage >= 80;
  const isError = percentage >= 100;

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-400">{label}</span>
        <span className={`font-medium ${
          isUnlimited ? 'text-green-400' :
          isError ? 'text-red-400' :
          isWarning ? 'text-yellow-400' :
          'text-white'
        }`}>
          {isUnlimited ? (
            <span className="flex items-center gap-1"><Infinity className="w-4 h-4" /> Unlimited</span>
          ) : (
            `${current.toLocaleString()} / ${max.toLocaleString()}`
          )}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 bg-twitch-dark rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isError ? 'bg-red-500' :
              isWarning ? 'bg-yellow-500' :
              'bg-twitch-purple'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

// Stat mini card
function StatMini({ icon: Icon, label, value, color = 'text-gray-400' }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`w-4 h-4 ${color}`} />
      <span className="text-gray-400 text-sm">{label}:</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}

export default function TierCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await meApi.getUsageSummary();
        setData(response.data);
      } catch (err) {
        console.error('Failed to fetch tier data:', err);
        setError('Failed to load tier information');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="bg-twitch-gray rounded-xl p-6 border border-gray-700">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-twitch-purple" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-twitch-gray rounded-xl p-6 border border-gray-700">
        <div className="text-center text-gray-400">{error}</div>
      </div>
    );
  }

  const { tier, today, thisWeek, currentUsage, limits, percentages } = data || {};
  const isAdmin = tier?.isAdmin;
  const isUnlimited = tier?.unlimited;

  return (
    <div className={`bg-twitch-gray rounded-xl border overflow-hidden ${
      isAdmin ? 'border-yellow-500/50' : 'border-gray-700'
    }`}>
      {/* Header */}
      <div className={`p-4 ${
        isAdmin ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20' :
        tier?.name === 'enterprise' ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20' :
        tier?.name === 'pro' ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20' :
        'bg-twitch-dark'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isAdmin ? (
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
            ) : (
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                tier?.name === 'enterprise' ? 'bg-gradient-to-br from-purple-500 to-pink-500' :
                tier?.name === 'pro' ? 'bg-gradient-to-br from-blue-500 to-cyan-500' :
                'bg-gradient-to-br from-gray-600 to-gray-700'
              }`}>
                <Crown className="w-5 h-5 text-white" />
              </div>
            )}
            <div>
              <h3 className="font-bold text-white flex items-center gap-2">
                {tier?.displayName || 'Free'}
                {isAdmin && (
                  <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
                    Admin
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-400">
                {isAdmin ? 'Unlimited access to all features' : 
                 isUnlimited ? 'No limits on your usage' :
                 'Your current subscription tier'}
              </p>
            </div>
          </div>
          {!isAdmin && !isUnlimited && (
            <Link
              to="/settings?tab=tier"
              className="text-sm text-twitch-purple hover:text-twitch-purple-light flex items-center gap-1"
            >
              Upgrade <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Usage bars (only for non-unlimited tiers) */}
        {!isUnlimited && limits && (
          <div className="space-y-3">
            <UsageBar
              current={currentUsage?.webhooks || 0}
              max={limits.maxWebhooks}
              label="Webhooks"
            />
            <UsageBar
              current={currentUsage?.apiCallsThisMinute || 0}
              max={limits.maxApiCallsPerMinute}
              label="API Calls (this minute)"
            />
          </div>
        )}

        {/* Quick stats */}
        <div className="pt-3 border-t border-gray-700">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Today's Activity</h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-twitch-dark rounded-lg p-3 group relative">
              <Activity className="w-5 h-5 text-twitch-purple mx-auto mb-1" />
              <div className="text-xl font-bold text-white">{today?.calls || 0}</div>
              <div className="text-xs text-gray-400">API Calls</div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                Total API requests made today
              </div>
            </div>
            <div className="bg-twitch-dark rounded-lg p-3 group relative">
              <Search className="w-5 h-5 text-blue-400 mx-auto mb-1" />
              <div className="text-xl font-bold text-white">{today?.searches || 0}</div>
              <div className="text-xs text-gray-400">Searches</div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                Message & moderation searches
              </div>
            </div>
            <div className="bg-twitch-dark rounded-lg p-3 group relative">
              <Download className="w-5 h-5 text-green-400 mx-auto mb-1" />
              <div className="text-xl font-bold text-white">{today?.exports || 0}</div>
              <div className="text-xs text-gray-400">Exports</div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                Data export requests
              </div>
            </div>
          </div>
        </div>

        {/* This week summary */}
        <div className="pt-3 border-t border-gray-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">This Week</span>
            <div className="flex items-center gap-4">
              <StatMini icon={Activity} label="Calls" value={thisWeek?.calls || 0} color="text-twitch-purple" />
              <StatMini icon={Search} label="Searches" value={thisWeek?.searches || 0} color="text-blue-400" />
            </div>
          </div>
        </div>

        {/* Features (for non-admin users) */}
        {!isAdmin && (
          <div className="pt-3 border-t border-gray-700">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Features</h4>
            <div className="flex flex-wrap gap-2">
              <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 ${
                limits === null || data?.tier?.canExport ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-500'
              }`}>
                <Download className="w-3 h-3" />
                Export
              </span>
              <span className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 ${
                limits === null || data?.tier?.canUseWebsocket ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-500'
              }`}>
                <Wifi className="w-3 h-3" />
                WebSocket
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
