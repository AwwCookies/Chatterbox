import { Link } from 'react-router-dom';
import { 
  Radio, 
  Hash, 
  Shield, 
  TrendingUp,
  ArrowUpRight,
  Users,
  MessageSquare,
  Crown
} from 'lucide-react';
import { formatNumber, formatRelative } from '../../utils/formatters';
import ModActionList from '../moderation/ModActionList';

// Live streaming channels widget
export function LiveChannelsWidget({ channels = [], className = '' }) {
  const liveChannels = channels.filter(c => c.is_live);
  const totalViewers = liveChannels.reduce((sum, c) => sum + (c.viewer_count || 0), 0);

  return (
    <div className={`bg-twitch-gray rounded-xl border border-gray-700/50 ${className}`}>
      <div className="p-4 border-b border-gray-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/20">
              <Radio className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <span className="font-medium text-white text-sm">Streaming Now</span>
              <p className="text-xs text-gray-500">{formatNumber(totalViewers)} total viewers</p>
            </div>
          </div>
          <span className="text-2xl font-bold text-white">{liveChannels.length}</span>
        </div>
      </div>
      
      <div className="max-h-[180px] overflow-y-auto">
        {liveChannels.length === 0 ? (
          <div className="p-6 text-center">
            <Radio className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No channels streaming</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700/50">
            {liveChannels.slice(0, 6).map(channel => (
              <Link
                key={channel.id}
                to={`/channel/${channel.name}`}
                className="flex items-center gap-3 p-3 hover:bg-gray-700/30 transition-colors"
              >
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-white font-bold text-xs">
                    {(channel.display_name || channel.name)[0].toUpperCase()}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-twitch-gray animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{channel.display_name || channel.name}</p>
                  <p className="text-xs text-gray-500 truncate">{channel.game_name || 'Streaming'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{formatNumber(channel.viewer_count || 0)}</p>
                  <p className="text-xs text-gray-500">viewers</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      
      {liveChannels.length > 6 && (
        <div className="p-2 border-t border-gray-700/50">
          <Link to="/channels" className="text-xs text-twitch-purple hover:underline flex items-center justify-center gap-1">
            View all {liveChannels.length} channels <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  );
}

// Active channels monitoring list
export function MonitoringChannelsWidget({ channels = [], className = '' }) {
  const activeChannels = channels.filter(c => c.is_active !== false);
  const joinedCount = activeChannels.filter(c => c.is_joined).length;

  return (
    <div className={`bg-twitch-gray rounded-xl border border-gray-700/50 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-green-400" />
          <span className="font-medium text-white text-sm">Monitoring</span>
        </div>
        <div className="text-xs text-gray-500">
          <span className="text-green-400 font-medium">{joinedCount}</span> / {activeChannels.length} connected
        </div>
      </div>
      
      {activeChannels.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-4">No channels configured</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto">
          {activeChannels.map(channel => (
            <Link
              key={channel.id}
              to={`/channel/${channel.name}`}
              className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                channel.is_live 
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30' 
                  : channel.is_joined
                    ? 'bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30'
                    : 'bg-gray-700/50 text-gray-400 border border-gray-600 hover:bg-gray-700'
              }`}
            >
              {channel.is_live && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
              {channel.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// Recent mod actions widget
export function RecentModActionsWidget({ actions = [], isLoading = false, className = '' }) {
  const stats = actions.reduce((acc, action) => {
    const type = action.action_type || action.actionType;
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className={`bg-twitch-gray rounded-xl border border-gray-700/50 flex flex-col overflow-hidden ${className}`}>
      <div className="p-4 border-b border-gray-700/50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/20">
              <Shield className="w-4 h-4 text-red-400" />
            </div>
            <span className="font-medium text-white text-sm">Mod Actions</span>
          </div>
          <Link to="/moderation" className="text-xs text-twitch-purple hover:underline flex items-center gap-1">
            View all <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
        
        {/* Quick stats */}
        <div className="flex gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-xs text-gray-400">Bans: <span className="text-white font-medium">{stats.ban || 0}</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-xs text-gray-400">Timeouts: <span className="text-white font-medium">{stats.timeout || 0}</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-xs text-gray-400">Deleted: <span className="text-white font-medium">{stats.delete || 0}</span></span>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <ModActionList 
          actions={actions}
          isLoading={isLoading}
          emptyMessage="No recent mod actions"
          compact
        />
      </div>
    </div>
  );
}// Top chatters leaderboard
export function TopChattersWidget({ chatters = [], className = '' }) {
  return (
    <div className={`bg-twitch-gray rounded-xl border border-gray-700/50 ${className}`}>
      <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-yellow-500/20">
            <Crown className="w-4 h-4 text-yellow-400" />
          </div>
          <span className="font-medium text-white text-sm">Top Chatters</span>
        </div>
        <span className="text-xs text-gray-500">Last 24h</span>
      </div>
      
      <div className="divide-y divide-gray-700/30">
        {chatters.slice(0, 5).map((chatter, i) => (
          <Link
            key={chatter.username}
            to={`/user/${chatter.username}`}
            className="flex items-center gap-3 p-3 hover:bg-gray-700/30 transition-colors"
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              i === 0 ? 'bg-yellow-500 text-yellow-900' :
              i === 1 ? 'bg-gray-400 text-gray-900' :
              i === 2 ? 'bg-orange-700 text-orange-100' :
              'bg-gray-700 text-gray-300'
            }`}>
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{chatter.displayName || chatter.username}</p>
            </div>
            <div className="flex items-center gap-1 text-gray-400">
              <MessageSquare className="w-3 h-3" />
              <span className="text-sm font-medium">{formatNumber(chatter.messageCount)}</span>
            </div>
          </Link>
        ))}
        
        {chatters.length === 0 && (
          <div className="p-6 text-center">
            <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No chatter data</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Channel activity leaderboard
export function ChannelActivityWidget({ channels = [], className = '' }) {
  const maxMessages = Math.max(...channels.map(c => c.messageCount), 1);

  return (
    <div className={`bg-twitch-gray rounded-xl border border-gray-700/50 ${className}`}>
      <div className="p-4 border-b border-gray-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-twitch-purple/20">
            <TrendingUp className="w-4 h-4 text-twitch-purple" />
          </div>
          <span className="font-medium text-white text-sm">Channel Activity</span>
        </div>
        <span className="text-xs text-gray-500">Last 24h</span>
      </div>
      
      <div className="p-3 space-y-3">
        {channels.slice(0, 5).map((channel, i) => (
          <Link
            key={channel.name}
            to={`/channel/${channel.name}`}
            className="block group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-white group-hover:text-twitch-purple transition-colors">
                {channel.displayName || channel.name}
              </span>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">
                  <Users className="w-3 h-3 inline mr-0.5" />
                  {formatNumber(channel.uniqueUsers)}
                </span>
                <span className="text-twitch-purple font-medium">{formatNumber(channel.messageCount)}</span>
              </div>
            </div>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-twitch-purple to-indigo-500 rounded-full transition-all"
                style={{ width: `${(channel.messageCount / maxMessages) * 100}%` }}
              />
            </div>
          </Link>
        ))}
        
        {channels.length === 0 && (
          <div className="py-4 text-center">
            <p className="text-sm text-gray-500">No activity data</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default {
  LiveChannelsWidget,
  MonitoringChannelsWidget,
  RecentModActionsWidget,
  TopChattersWidget,
  ChannelActivityWidget
};
