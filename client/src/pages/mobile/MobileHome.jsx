import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { statsApi, channelsApi } from '../../services/api';
import { useRecentModActions } from '../../hooks/useModActions';
import { useWebSocketStore } from '../../hooks/useWebSocket';
import wsService from '../../services/websocket';
import { 
  MessageSquare, 
  Users, 
  Hash, 
  Radio, 
  Shield,
  Zap,
  ArrowRight,
  Ban,
  Timer,
  Trash2,
  RefreshCw,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { formatNumber, formatRelative } from '../../utils/formatters';
import { MobileStatCard, MobileModActionCard, PullToRefresh } from '../../components/mobile';
import LoadingSpinner from '../../components/common/LoadingSpinner';

function MobileHome() {
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => statsApi.getOverview().then(res => res.data),
    refetchInterval: 30000,
  });

  const { data: channelsData, refetch: refetchChannels } = useQuery({
    queryKey: ['channels', { active: true }],
    queryFn: () => channelsApi.getAll({ active: true }).then(res => res.data),
    staleTime: 60000,
  });

  const { data: modActionsData, isLoading: modActionsLoading, refetch: refetchModActions } = useRecentModActions(5);
  
  const liveMessages = useWebSocketStore(state => state.messages);

  useEffect(() => {
    const checkConnection = () => {
      setIsConnected(wsService.isConnected());
    };
    const interval = setInterval(checkConnection, 1000);
    checkConnection();
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchStats(), refetchChannels(), refetchModActions()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const modStats = (modActionsData?.actions || []).reduce((acc, action) => {
    acc[action.action_type] = (acc[action.action_type] || 0) + 1;
    return acc;
  }, {});

  const activeChannels = channelsData?.channels || [];

  if (statsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh} className="min-h-full">
      <div className="px-4 py-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Dashboard</h1>
            <p className="text-sm text-gray-400">Chat archive overview</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
            <span className={`text-sm ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <MobileStatCard 
            icon={MessageSquare} 
            label="Messages" 
            value={stats?.totalMessages || 0}
            onClick={() => navigate('/messages')}
          />
          <MobileStatCard 
            icon={Users} 
            label="Users" 
            value={stats?.totalUsers || 0}
            color="text-blue-400"
          />
          <MobileStatCard 
            icon={Hash} 
            label="Channels" 
            value={stats?.activeChannels || 0}
            color="text-green-400"
            onClick={() => navigate('/channels')}
          />
          <MobileStatCard 
            icon={Zap} 
            label="Live" 
            value={liveMessages.length}
            color="text-yellow-400"
            onClick={() => navigate('/live')}
          />
        </div>

        {/* Quick Mod Stats */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
          <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-red-500/10 rounded-full">
            <Ban className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400 font-medium">{modStats.ban || 0} bans</span>
          </div>
          <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-orange-500/10 rounded-full">
            <Timer className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-orange-400 font-medium">{modStats.timeout || 0} timeouts</span>
          </div>
          <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-yellow-500/10 rounded-full">
            <Trash2 className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-yellow-400 font-medium">{modStats.delete || 0} deleted</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/live"
            className="flex flex-col items-center justify-center p-4 bg-twitch-gray rounded-xl border border-gray-700 active:bg-gray-700"
          >
            <div className="p-3 rounded-full bg-green-500/10 mb-2">
              <Radio className="w-6 h-6 text-green-400" />
            </div>
            <span className="text-sm font-medium text-white">Live Feed</span>
            <span className="text-xs text-gray-500">Real-time</span>
          </Link>

          <Link
            to="/messages"
            className="flex flex-col items-center justify-center p-4 bg-twitch-gray rounded-xl border border-gray-700 active:bg-gray-700"
          >
            <div className="p-3 rounded-full bg-twitch-purple/10 mb-2">
              <MessageSquare className="w-6 h-6 text-twitch-purple" />
            </div>
            <span className="text-sm font-medium text-white">Search</span>
            <span className="text-xs text-gray-500">Messages</span>
          </Link>

          <Link
            to="/moderation"
            className="flex flex-col items-center justify-center p-4 bg-twitch-gray rounded-xl border border-gray-700 active:bg-gray-700"
          >
            <div className="p-3 rounded-full bg-red-500/10 mb-2">
              <Shield className="w-6 h-6 text-red-400" />
            </div>
            <span className="text-sm font-medium text-white">Moderation</span>
            <span className="text-xs text-gray-500">Actions</span>
          </Link>

          <Link
            to="/channels"
            className="flex flex-col items-center justify-center p-4 bg-twitch-gray rounded-xl border border-gray-700 active:bg-gray-700"
          >
            <div className="p-3 rounded-full bg-blue-500/10 mb-2">
              <Hash className="w-6 h-6 text-blue-400" />
            </div>
            <span className="text-sm font-medium text-white">Channels</span>
            <span className="text-xs text-gray-500">Manage</span>
          </Link>
        </div>

        {/* Active Channels Section */}
        {activeChannels.length > 0 && (
          <div className="bg-twitch-gray rounded-xl border border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Hash className="w-4 h-4 text-green-400" />
                Active Channels
              </h2>
              <Link to="/channels" className="text-sm text-twitch-purple">
                View all
              </Link>
            </div>
            <div className="divide-y divide-gray-700/50">
              {activeChannels.slice(0, 5).map(channel => (
                <Link
                  key={channel.id}
                  to={`/channel/${channel.name}`}
                  className="flex items-center justify-between p-4 active:bg-gray-700/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-twitch-purple font-bold">
                        {(channel.display_name || channel.name).charAt(0).toUpperCase()}
                      </div>
                      <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-twitch-gray ${
                        channel.is_live ? 'bg-red-500' : 'bg-green-500'
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium text-white">{channel.display_name || channel.name}</p>
                      <p className="text-xs text-gray-500">{channel.is_live ? 'LIVE' : 'Monitoring'}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recent Mod Actions */}
        <div className="bg-twitch-gray rounded-xl border border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-400" />
              Recent Mod Actions
            </h2>
            <Link to="/moderation" className="text-sm text-twitch-purple">
              View all
            </Link>
          </div>
          {modActionsLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : (modActionsData?.actions || []).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No recent mod actions</p>
            </div>
          ) : (
            <div>
              {(modActionsData?.actions || []).slice(0, 5).map(action => (
                <MobileModActionCard key={action.id} action={action} />
              ))}
            </div>
          )}
        </div>

        {/* Bottom padding for nav */}
        <div className="h-4" />
      </div>
    </PullToRefresh>
  );
}

export default MobileHome;
