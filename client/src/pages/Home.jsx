import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { statsApi, channelsApi } from '../services/api';
import { useRecentModActions } from '../hooks/useModActions';
import { useWebSocketStore } from '../hooks/useWebSocket';
import wsService from '../services/websocket';
import { 
  MessageSquare, 
  Users, 
  Hash, 
  Radio, 
  Shield,
  TrendingUp,
  Clock,
  Activity,
  Zap,
  BarChart3,
  ArrowUpRight,
  Ban,
  Timer,
  Trash2
} from 'lucide-react';
import { formatNumber, formatRelative } from '../utils/formatters';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ModActionList from '../components/moderation/ModActionList';

function StatCard({ icon: Icon, label, value, subValue, color = 'text-twitch-purple', trend }) {
  return (
    <div className="bg-twitch-gray rounded-lg p-5 border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-lg bg-gray-700/50 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <div className={`flex items-center text-xs ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
            <ArrowUpRight className={`w-3 h-3 ${trend < 0 ? 'rotate-90' : ''}`} />
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-white">{formatNumber(value)}</p>
        <p className="text-sm text-gray-400">{label}</p>
        {subValue && (
          <p className="text-xs text-gray-500 mt-1">{subValue}</p>
        )}
      </div>
    </div>
  );
}

function ActivityIndicator({ isActive, label }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
      <span className={`text-sm ${isActive ? 'text-green-400' : 'text-gray-500'}`}>{label}</span>
    </div>
  );
}

function Home() {
  const [isConnected, setIsConnected] = useState(false);
  
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => statsApi.getOverview().then(res => res.data),
    refetchInterval: 30000,
  });

  const { data: channelsData } = useQuery({
    queryKey: ['channels', { active: true }],
    queryFn: () => channelsApi.getAll({ active: true }).then(res => res.data),
    staleTime: 60000,
  });

  const { data: modActionsData, isLoading: modActionsLoading } = useRecentModActions(10);
  
  // Get live messages from store without subscribing
  const liveMessages = useWebSocketStore(state => state.messages);

  // Check connection status
  useEffect(() => {
    const checkConnection = () => {
      setIsConnected(wsService.isConnected());
    };
    const interval = setInterval(checkConnection, 1000);
    checkConnection();
    return () => clearInterval(interval);
  }, []);

  // Calculate mod action stats
  const modStats = (modActionsData?.actions || []).reduce((acc, action) => {
    acc[action.action_type] = (acc[action.action_type] || 0) + 1;
    return acc;
  }, {});

  if (statsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const activeChannels = channelsData?.channels || [];

  return (
    <div className="space-y-6">
      {/* Header with status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
          <p className="text-gray-400">Overview of your Twitch chat archive</p>
        </div>
        <div className="flex items-center gap-4">
          <ActivityIndicator isActive={isConnected} label={isConnected ? 'Connected' : 'Disconnected'} />
          {stats?.archiveBuffer && (
            <ActivityIndicator 
              isActive={stats.archiveBuffer.bufferedMessages > 0}
              label={`${stats.archiveBuffer.bufferedMessages} buffered`}
            />
          )}
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={MessageSquare} 
          label="Total Messages" 
          value={stats?.totalMessages || 0}
          subValue="All time"
        />
        <StatCard 
          icon={Users} 
          label="Unique Users" 
          value={stats?.totalUsers || 0}
          color="text-blue-400"
          subValue="Tracked users"
        />
        <StatCard 
          icon={Hash} 
          label="Active Channels" 
          value={stats?.activeChannels || 0}
          color="text-green-400"
          subValue={`${activeChannels.filter(c => c.is_live).length} live now`}
        />
        <StatCard 
          icon={Zap} 
          label="Live Messages" 
          value={liveMessages.length}
          color="text-yellow-400"
          subValue="Current session"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700 text-center">
          <Ban className="w-5 h-5 text-red-400 mx-auto mb-2" />
          <p className="text-xl font-bold text-white">{formatNumber(modStats.ban || 0)}</p>
          <p className="text-xs text-gray-400">Bans</p>
        </div>
        <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700 text-center">
          <Timer className="w-5 h-5 text-orange-400 mx-auto mb-2" />
          <p className="text-xl font-bold text-white">{formatNumber(modStats.timeout || 0)}</p>
          <p className="text-xs text-gray-400">Timeouts</p>
        </div>
        <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700 text-center">
          <Trash2 className="w-5 h-5 text-yellow-400 mx-auto mb-2" />
          <p className="text-xl font-bold text-white">{formatNumber(modStats.delete || 0)}</p>
          <p className="text-xs text-gray-400">Deleted</p>
        </div>
        <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700 text-center">
          <Radio className="w-5 h-5 text-purple-400 mx-auto mb-2" />
          <p className="text-xl font-bold text-white">{stats?.connectedClients || 0}</p>
          <p className="text-xs text-gray-400">Clients</p>
        </div>
        <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700 text-center">
          <BarChart3 className="w-5 h-5 text-cyan-400 mx-auto mb-2" />
          <p className="text-xl font-bold text-white">{activeChannels.length}</p>
          <p className="text-xs text-gray-400">Channels</p>
        </div>
        <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700 text-center">
          <Activity className="w-5 h-5 text-green-400 mx-auto mb-2" />
          <p className="text-xl font-bold text-white">{activeChannels.filter(c => c.is_live).length}</p>
          <p className="text-xs text-gray-400">Live</p>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Mod Actions */}
        <div className="xl:col-span-2 bg-twitch-gray rounded-lg border border-gray-700">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center">
              <Shield className="w-5 h-5 mr-2 text-red-400" />
              Recent Mod Actions
            </h2>
            <Link 
              to="/moderation"
              className="text-sm text-twitch-purple hover:underline flex items-center gap-1"
            >
              View all
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <ModActionList 
              actions={modActionsData?.actions || []}
              isLoading={modActionsLoading}
              emptyMessage="No recent mod actions"
              compact
            />
          </div>
        </div>

        {/* Active Channels */}
        <div className="bg-twitch-gray rounded-lg border border-gray-700">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center">
              <Hash className="w-5 h-5 mr-2 text-green-400" />
              Active Channels
            </h2>
            <Link 
              to="/channels"
              className="text-sm text-twitch-purple hover:underline flex items-center gap-1"
            >
              Manage
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-2 max-h-80 overflow-y-auto">
            {activeChannels.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Hash className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No active channels</p>
                <Link to="/channels" className="text-twitch-purple text-sm hover:underline mt-2 block">
                  Add a channel
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                {activeChannels.map(channel => (
                  <Link
                    key={channel.id}
                    to={`/channel/${channel.name}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-700/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${channel.is_live ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                      <div>
                        <p className="text-white font-medium group-hover:text-twitch-purple transition-colors">
                          {channel.display_name || channel.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {channel.is_live ? 'LIVE' : 'Monitoring'}
                        </p>
                      </div>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-gray-600 group-hover:text-twitch-purple transition-colors" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link 
          to="/live"
          className="flex items-center gap-4 p-4 bg-twitch-gray rounded-lg border border-gray-700 hover:border-green-500/50 hover:bg-green-500/5 transition-all group"
        >
          <div className="p-3 rounded-lg bg-green-500/10 text-green-400 group-hover:bg-green-500/20">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium text-white">Live Feed</p>
            <p className="text-sm text-gray-400">Watch in real-time</p>
          </div>
        </Link>

        <Link 
          to="/messages"
          className="flex items-center gap-4 p-4 bg-twitch-gray rounded-lg border border-gray-700 hover:border-twitch-purple/50 hover:bg-twitch-purple/5 transition-all group"
        >
          <div className="p-3 rounded-lg bg-twitch-purple/10 text-twitch-purple group-hover:bg-twitch-purple/20">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium text-white">Search Messages</p>
            <p className="text-sm text-gray-400">Browse archives</p>
          </div>
        </Link>

        <Link 
          to="/moderation"
          className="flex items-center gap-4 p-4 bg-twitch-gray rounded-lg border border-gray-700 hover:border-red-500/50 hover:bg-red-500/5 transition-all group"
        >
          <div className="p-3 rounded-lg bg-red-500/10 text-red-400 group-hover:bg-red-500/20">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium text-white">Moderation</p>
            <p className="text-sm text-gray-400">View mod actions</p>
          </div>
        </Link>

        <Link 
          to="/channels"
          className="flex items-center gap-4 p-4 bg-twitch-gray rounded-lg border border-gray-700 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group"
        >
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20">
            <Hash className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium text-white">Channels</p>
            <p className="text-sm text-gray-400">Manage channels</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

export default Home;
