import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { statsApi, channelsApi } from '../services/api';
import { useRecentModActions } from '../hooks/useModActions';
import { useWebSocketStore, useGlobalWebSocket, useGlobalStore } from '../hooks/useWebSocket';
import wsService from '../services/websocket';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { 
  MessageSquare, 
  Users, 
  Hash, 
  Radio, 
  Shield,
  Activity,
  Zap,
  ArrowUpRight,
  Ban,
  Timer,
  Trash2,
  TrendingUp,
  Gauge
} from 'lucide-react';
import { formatNumber, formatRelative } from '../utils/formatters';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ModActionList from '../components/moderation/ModActionList';
import { MobileHome } from './mobile';

// Live Messages Per Second Widget - uses server-side MPS data
function LiveMpsWidget({ mps, mpsHistory, peakMps, isConnected }) {
  const maxValue = Math.max(...mpsHistory.map(d => d.value), 10); // Minimum scale of 10
  const avgMps = mpsHistory.reduce((sum, d) => sum + d.value, 0) / mpsHistory.length;
  
  // Determine color based on activity level
  const getActivityLevel = (mps) => {
    if (mps === 0) return 'idle';
    if (mps < 5) return 'low';
    if (mps < 20) return 'medium';
    if (mps < 50) return 'high';
    return 'extreme';
  };

  const level = getActivityLevel(mps);

  return (
    <div className="bg-twitch-gray rounded-lg border border-gray-700 p-4 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${
            level === 'idle' ? 'bg-gray-700' :
            level === 'low' ? 'bg-green-500/20' :
            level === 'medium' ? 'bg-cyan-500/20' :
            level === 'high' ? 'bg-twitch-purple/20' :
            'bg-pink-500/20'
          }`}>
            <Gauge className={`w-4 h-4 ${
              level === 'idle' ? 'text-gray-500' :
              level === 'low' ? 'text-green-400' :
              level === 'medium' ? 'text-cyan-400' :
              level === 'high' ? 'text-twitch-purple' :
              'text-pink-400'
            }`} />
          </div>
          <span className="text-sm font-medium text-white">Messages/sec</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-500">avg: <span className="text-gray-400">{avgMps.toFixed(1)}</span></span>
          <span className="text-gray-500">peak: <span className="text-yellow-400">{peakMps}</span></span>
        </div>
      </div>

      {/* Main Number Display */}
      <div className="flex items-end gap-2 mb-3 flex-shrink-0">
        <span className={`text-5xl font-bold tabular-nums tracking-tight transition-colors duration-300 ${
          level === 'idle' ? 'text-gray-500' :
          level === 'low' ? 'text-green-400' :
          level === 'medium' ? 'text-cyan-400' :
          level === 'high' ? 'text-twitch-purple' :
          'text-pink-400'
        }`}>
          {mps}
        </span>
        <span className="text-gray-500 text-sm mb-2">msg/s</span>
        {isConnected && mps > 0 && (
          <div className={`ml-auto flex items-center gap-1 px-2 py-1 rounded-full ${
            level === 'low' ? 'bg-green-500/20' :
            level === 'medium' ? 'bg-cyan-500/20' :
            level === 'high' ? 'bg-twitch-purple/20' :
            'bg-pink-500/20'
          }`}>
            <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
            <span className={`text-xs font-medium ${
              level === 'low' ? 'text-green-400' :
              level === 'medium' ? 'text-cyan-400' :
              level === 'high' ? 'text-twitch-purple' :
              'text-pink-400'
            }`}>LIVE</span>
          </div>
        )}
      </div>

      {/* Sparkline Chart - fixed height */}
      <div className="h-16 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={mpsHistory} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="mpsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={
                  level === 'high' || level === 'extreme' ? '#9147ff' : 
                  level === 'medium' ? '#22d3ee' : '#22c55e'
                } stopOpacity={0.4}/>
                <stop offset="100%" stopColor={
                  level === 'high' || level === 'extreme' ? '#9147ff' : 
                  level === 'medium' ? '#22d3ee' : '#22c55e'
                } stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={
                level === 'high' || level === 'extreme' ? '#9147ff' : 
                level === 'medium' ? '#22d3ee' : '#22c55e'
              }
              strokeWidth={2}
              fill="url(#mpsGradient)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Time labels */}
      <div className="flex justify-between text-[10px] text-gray-600 mt-1 flex-shrink-0">
        <span>60s ago</span>
        <span>now</span>
      </div>

      {/* Activity bars at bottom - fixed height */}
      <div className="flex gap-0.5 mt-3 h-4 flex-shrink-0 items-end">
        {mpsHistory.slice(-30).map((d, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm transition-all duration-150"
            style={{
              height: `${Math.max(12.5, (d.value / maxValue) * 100)}%`,
              backgroundColor: d.value === 0 
                ? '#374151' 
                : d.value < 5 
                  ? '#22c55e' 
                  : d.value < 20 
                    ? '#22d3ee' 
                    : '#9147ff',
              opacity: 0.3 + (i / 30) * 0.7
            }}
          />
        ))}
      </div>
    </div>
  );
}

function MiniStatCard({ icon: Icon, label, value, color = 'text-twitch-purple', pulse = false }) {
  return (
    <div className="bg-twitch-gray rounded-lg p-3 border border-gray-700 flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-gray-700/50 ${color}`}>
        <Icon className={`w-4 h-4 ${pulse ? 'animate-pulse' : ''}`} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-white leading-tight">{formatNumber(value)}</p>
        <p className="text-xs text-gray-400 truncate">{label}</p>
      </div>
    </div>
  );
}

function ActivityIndicator({ isActive, label }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
      <span className={`text-xs ${isActive ? 'text-green-400' : 'text-gray-500'}`}>{label}</span>
    </div>
  );
}

function Home({ isMobile }) {
  if (isMobile) {
    return <MobileHome />;
  }

  const queryClient = useQueryClient();
  
  // Use global WebSocket for real-time updates
  const { isConnected, stats: wsStats, globalModActions, mps, mpsHistory, peakMps } = useGlobalWebSocket();
  
  // Initial load from API, then rely on WebSocket for updates
  const { data: initialStats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => statsApi.getOverview().then(res => res.data),
    refetchInterval: 30000, // Fallback: refresh every 30s instead of 5s
    staleTime: 10000,
  });

  // Merge WebSocket stats with initial API stats
  const stats = useMemo(() => {
    if (wsStats) {
      return { ...initialStats, ...wsStats };
    }
    return initialStats;
  }, [initialStats, wsStats]);

  const { data: channelsData } = useQuery({
    queryKey: ['channels', { active: true }],
    queryFn: () => channelsApi.getAll({ active: true }).then(res => res.data),
    refetchInterval: 30000, // Fallback refresh
    staleTime: 10000,
  });

  // Use real-time global mod actions if available, otherwise fall back to API
  const { data: modActionsData, isLoading: modActionsLoading } = useRecentModActions(10);
  const liveMessages = useWebSocketStore(state => state.messages);

  // Listen for messages_flushed to know when to refresh chart data
  useEffect(() => {
    const handleFlushed = () => {
      // Invalidate stats to get fresh chart data
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    };
    
    const unsub = wsService.on('messages_flushed', handleFlushed);
    return () => unsub();
  }, [queryClient]);

  // Prepare chart data - fill in missing hours
  const chartData = useMemo(() => {
    const now = new Date();
    const hours = [];
    
    // Generate last 24 hours
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now);
      hour.setHours(hour.getHours() - i, 0, 0, 0);
      hours.push({
        hour: hour.toISOString(),
        time: hour.getHours().toString().padStart(2, '0') + ':00',
        count: 0
      });
    }
    
    // Fill in actual data
    if (stats?.messagesLast24h) {
      stats.messagesLast24h.forEach(item => {
        const itemHour = new Date(item.hour);
        const idx = hours.findIndex(h => {
          const hDate = new Date(h.hour);
          return hDate.getHours() === itemHour.getHours() && 
                 hDate.getDate() === itemHour.getDate();
        });
        if (idx !== -1) {
          hours[idx].count = item.count;
        }
      });
    }
    
    return hours;
  }, [stats?.messagesLast24h]);

  // Calculate messages in last 24h
  const messages24h = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.count, 0);
  }, [chartData]);

  // Mod action stats - combine global WS mod actions with API data
  const allModActions = useMemo(() => {
    // Prefer real-time global mod actions, but use API data as fallback
    if (globalModActions.length > 0) {
      return globalModActions.slice(0, 10);
    }
    return modActionsData?.actions || [];
  }, [globalModActions, modActionsData?.actions]);

  const modStats = allModActions.reduce((acc, action) => {
    const actionType = action.action_type || action.actionType;
    acc[actionType] = (acc[actionType] || 0) + 1;
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
  const liveChannels = activeChannels.filter(c => c.is_live); // Actually streaming on Twitch
  const joinedChannels = activeChannels.filter(c => c.is_joined); // Connected to IRC

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-gray-400">
            {isConnected ? (
              <span className="text-green-400">● Real-time updates</span>
            ) : (
              <span className="text-yellow-400">○ Polling mode</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <ActivityIndicator isActive={isConnected} label={isConnected ? 'WebSocket' : 'Disconnected'} />
          <ActivityIndicator 
            isActive={(stats?.archiveBuffer?.bufferedMessages || 0) > 0}
            label={`${stats?.archiveBuffer?.bufferedMessages || 0} buffered`}
          />
        </div>
      </div>

      {/* Main Grid - 2 rows */}
      <div className="grid grid-cols-12 gap-4">
        {/* Stats Row */}
        <div className="col-span-12 grid grid-cols-6 gap-3">
          <MiniStatCard icon={MessageSquare} label="Total Messages" value={stats?.totalMessages || 0} />
          <MiniStatCard icon={Users} label="Users" value={stats?.totalUsers || 0} color="text-blue-400" />
          <MiniStatCard icon={Hash} label="Channels" value={stats?.activeChannels || 0} color="text-green-400" />
          <MiniStatCard icon={Radio} label="Streaming" value={liveChannels.length} color="text-red-400" />
          <MiniStatCard icon={Activity} label="IRC Joined" value={joinedChannels.length} color="text-cyan-400" />
          <MiniStatCard icon={Zap} label="Live Session" value={liveMessages.length} color="text-yellow-400" />
        </div>

        {/* Live MPS Widget */}
        <div className="col-span-4">
          <LiveMpsWidget mps={mps} mpsHistory={mpsHistory} peakMps={peakMps} isConnected={isConnected} />
        </div>

        {/* Chart */}
        <div className="col-span-8 bg-twitch-gray rounded-lg border border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-twitch-purple" />
              <span className="font-medium text-white text-sm">Messages (24h)</span>
            </div>
            <span className="text-lg font-bold text-twitch-purple">{formatNumber(messages24h)}</span>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9147ff" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#9147ff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="time" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  interval={3}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f1f23', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  labelStyle={{ color: '#9ca3af' }}
                  formatter={(value) => [formatNumber(value), 'Messages']}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#9147ff" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorMessages)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Side Panel - Mod Stats + Live Channels */}
        <div className="col-span-4 flex flex-col gap-3">
          {/* Mod Stats Row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-twitch-gray border border-gray-700 rounded-lg">
              <Ban className="w-4 h-4 text-red-400 mx-auto mb-1" />
              <p className="text-sm font-bold text-white">{modStats.ban || 0}</p>
              <p className="text-[10px] text-gray-500">Bans</p>
            </div>
            <div className="text-center p-2 bg-twitch-gray border border-gray-700 rounded-lg">
              <Timer className="w-4 h-4 text-orange-400 mx-auto mb-1" />
              <p className="text-sm font-bold text-white">{modStats.timeout || 0}</p>
              <p className="text-[10px] text-gray-500">Timeouts</p>
            </div>
            <div className="text-center p-2 bg-twitch-gray border border-gray-700 rounded-lg">
              <Trash2 className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
              <p className="text-sm font-bold text-white">{modStats.delete || 0}</p>
              <p className="text-[10px] text-gray-500">Deleted</p>
            </div>
          </div>

          {/* Live Channels */}
          <div className="bg-twitch-gray rounded-lg border border-gray-700 p-3 flex-1 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-red-400" />
                <span className="font-medium text-white text-sm">Streaming Now</span>
              </div>
              <Link to="/channels" className="text-xs text-twitch-purple hover:underline">Manage</Link>
            </div>
            {liveChannels.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-2">No channels streaming</p>
            ) : (
              <div className="space-y-1 max-h-[100px] overflow-y-auto">
                {liveChannels.slice(0, 5).map(channel => (
                  <Link
                    key={channel.id}
                    to={`/channel/${channel.name}`}
                    className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                      <span className="text-xs text-white truncate">{channel.display_name || channel.name}</span>
                    </div>
                    {channel.viewer_count != null && (
                      <span className="text-[10px] text-gray-400 flex-shrink-0">{formatNumber(channel.viewer_count)}</span>
                    )}
                  </Link>
                ))}
                {liveChannels.length > 5 && (
                  <p className="text-[10px] text-gray-500 text-center">+{liveChannels.length - 5} more</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Recent Mod Actions List */}
        <div className="col-span-8 bg-twitch-gray rounded-lg border border-gray-700">
          <div className="p-3 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-400" />
              <span className="font-medium text-white text-sm">Recent Mod Actions</span>
              {globalModActions.length > 0 && (
                <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">LIVE</span>
              )}
            </div>
            <Link to="/moderation" className="text-xs text-twitch-purple hover:underline flex items-center gap-1">
              View all
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="max-h-[140px] overflow-y-auto">
            <ModActionList 
              actions={allModActions}
              isLoading={modActionsLoading && globalModActions.length === 0}
              emptyMessage="No recent mod actions"
              compact
            />
          </div>
        </div>

        {/* Active Channels List */}
        <div className="col-span-4 bg-twitch-gray rounded-lg border border-gray-700 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-green-400" />
              <span className="font-medium text-white text-sm">Monitoring ({activeChannels.length})</span>
            </div>
          </div>
          {activeChannels.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-2">No channels</p>
          ) : (
            <div className="flex flex-wrap gap-1 max-h-[100px] overflow-y-auto">
              {activeChannels.map(channel => (
                <Link
                  key={channel.id}
                  to={`/channel/${channel.name}`}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                    channel.is_live 
                      ? 'border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20' 
                      : channel.is_joined
                        ? 'border-green-600/50 bg-green-700/20 text-green-300 hover:bg-green-600/30'
                        : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                  }`}
                  title={channel.is_live ? `${channel.game_name || 'Streaming'} - ${channel.viewer_count || 0} viewers` : channel.is_joined ? 'IRC Connected' : 'Not connected'}
                >
                  {channel.is_live && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1 animate-pulse" />}
                  {channel.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Row - Quick Actions */}
        <div className="col-span-12 grid grid-cols-4 gap-3">
          <Link 
            to="/live"
            className="flex items-center gap-3 p-3 bg-twitch-gray rounded-lg border border-gray-700 hover:border-green-500/50 hover:bg-green-500/5 transition-all group"
          >
            <div className="p-2 rounded-lg bg-green-500/10 text-green-400 group-hover:bg-green-500/20">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Live Feed</p>
              <p className="text-xs text-gray-400">Real-time</p>
            </div>
          </Link>

          <Link 
            to="/messages"
            className="flex items-center gap-3 p-3 bg-twitch-gray rounded-lg border border-gray-700 hover:border-twitch-purple/50 hover:bg-twitch-purple/5 transition-all group"
          >
            <div className="p-2 rounded-lg bg-twitch-purple/10 text-twitch-purple group-hover:bg-twitch-purple/20">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Messages</p>
              <p className="text-xs text-gray-400">Search</p>
            </div>
          </Link>

          <Link 
            to="/moderation"
            className="flex items-center gap-3 p-3 bg-twitch-gray rounded-lg border border-gray-700 hover:border-red-500/50 hover:bg-red-500/5 transition-all group"
          >
            <div className="p-2 rounded-lg bg-red-500/10 text-red-400 group-hover:bg-red-500/20">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Moderation</p>
              <p className="text-xs text-gray-400">Actions</p>
            </div>
          </Link>

          <Link 
            to="/channels"
            className="flex items-center gap-3 p-3 bg-twitch-gray rounded-lg border border-gray-700 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group"
          >
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20">
              <Hash className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Channels</p>
              <p className="text-xs text-gray-400">Manage</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Home;
