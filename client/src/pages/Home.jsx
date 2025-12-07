import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { statsApi, channelsApi } from '../services/api';
import { useRecentModActions } from '../hooks/useModActions';
import { useWebSocketStore, useGlobalWebSocket, useGlobalStore } from '../hooks/useWebSocket';
import wsService from '../services/websocket';
import { 
  MessageSquare, 
  Users, 
  Hash, 
  Radio, 
  Shield,
  Activity,
  Zap,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Clock,
  Calendar,
  Sparkles,
  Database,
  BarChart3,
  PieChart,
  Layers
} from 'lucide-react';
import { formatNumber, formatRelative } from '../utils/formatters';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { MobileHome } from './mobile';

// Import dashboard components
import {
  HeroStatCard,
  MiniStatCard,
  SparklineStatCard,
  MessagesAreaChart,
  ChannelActivityChart,
  ModActionsPieChart,
  PeakHoursChart,
  LiveMpsWidget,
  LiveChannelsWidget,
  MonitoringChannelsWidget,
  RecentModActionsWidget,
  TopChattersWidget,
  ChannelActivityWidget
} from '../components/dashboard';

// Quick navigation cards
function QuickNavCard({ to, icon: Icon, title, subtitle, color, bgColor }) {
  return (
    <Link 
      to={to}
      className={`flex items-center gap-3 p-4 bg-twitch-gray rounded-xl border border-gray-700/50 hover:border-${color}/50 hover:bg-${color}/5 transition-all group`}
    >
      <div className={`p-3 rounded-xl ${bgColor} group-hover:scale-110 transition-transform`}>
        <Icon className={`w-5 h-5 text-${color}`} />
      </div>
      <div className="flex-1">
        <p className="font-medium text-white">{title}</p>
        <p className="text-xs text-gray-400">{subtitle}</p>
      </div>
      <ArrowUpRight className={`w-4 h-4 text-gray-500 group-hover:text-${color} transition-colors`} />
    </Link>
  );
}

// Section header component
function SectionHeader({ icon: Icon, title, action, actionTo }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-twitch-purple" />
        <h2 className="font-semibold text-white">{title}</h2>
      </div>
      {action && (
        <Link to={actionTo} className="text-xs text-twitch-purple hover:underline flex items-center gap-1">
          {action} <ArrowUpRight className="w-3 h-3" />
        </Link>
      )}
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
  
  // Fetch dashboard data (public endpoint)
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => statsApi.getDashboard().then(res => res.data),
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });

  // Initial stats from API, then rely on WebSocket for updates
  const { data: initialStats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => statsApi.getOverview().then(res => res.data),
    refetchInterval: 30000,
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
    refetchInterval: 30000,
    staleTime: 10000,
  });

  // Use real-time global mod actions if available, otherwise fall back to API
  const { data: modActionsData, isLoading: modActionsLoading } = useRecentModActions(10);
  const liveMessages = useWebSocketStore(state => state.messages);

  // Listen for messages_flushed to refresh chart data
  useEffect(() => {
    const handleFlushed = () => {
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    };
    
    const unsub = wsService.on('messages_flushed', handleFlushed);
    return () => unsub();
  }, [queryClient]);

  // Prepare hourly chart data - fill in missing hours
  const chartData = useMemo(() => {
    const now = new Date();
    const hours = [];
    
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now);
      hour.setHours(hour.getHours() - i, 0, 0, 0);
      hours.push({
        hour: hour.toISOString(),
        time: hour.getHours().toString().padStart(2, '0') + ':00',
        count: 0
      });
    }
    
    // Use dashboard data if available, otherwise stats
    const hourlyData = dashboardData?.charts?.messagesHourly || stats?.messagesLast24h || [];
    hourlyData.forEach(item => {
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
    
    return hours;
  }, [dashboardData?.charts?.messagesHourly, stats?.messagesLast24h]);

  // Calculate messages in last 24h
  const messages24h = useMemo(() => {
    return dashboardData?.overview?.messagesLast24h || chartData.reduce((sum, item) => sum + item.count, 0);
  }, [dashboardData?.overview?.messagesLast24h, chartData]);

  // Mod actions - combine global WS with API data
  const allModActions = useMemo(() => {
    if (globalModActions.length > 0) {
      return globalModActions.slice(0, 10);
    }
    return dashboardData?.moderation?.recent || modActionsData?.actions || [];
  }, [globalModActions, dashboardData?.moderation?.recent, modActionsData?.actions]);

  // Prepare peak hours data (0-23)
  const peakHoursData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
    const data = dashboardData?.charts?.peakHours || [];
    data.forEach(d => {
      if (d.hour >= 0 && d.hour < 24) {
        hours[d.hour].count = d.count;
      }
    });
    return hours;
  }, [dashboardData?.charts?.peakHours]);

  // Loading state
  if (statsLoading && dashboardLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="text-gray-400 mt-4">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const activeChannels = channelsData?.channels || [];
  const liveChannels = activeChannels.filter(c => c.is_live);
  const joinedChannels = activeChannels.filter(c => c.is_joined);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-twitch-purple" />
            Dashboard
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {isConnected ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-green-400">Real-time updates active</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-yellow-400">Polling mode (WebSocket disconnected)</span>
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-sm">
            <p className="text-gray-500">Server uptime</p>
            <p className="text-white font-medium">{stats?.archiveBuffer?.bufferedMessages || 0} buffered</p>
          </div>
        </div>
      </div>

      {/* Hero Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <HeroStatCard
          icon={MessageSquare}
          label="Total Messages"
          value={dashboardData?.overview?.totalMessages || stats?.totalMessages || 0}
          gradient="from-twitch-purple to-indigo-600"
          trend={dashboardData?.overview?.messageGrowth}
          trendLabel="vs yesterday"
        />
        <HeroStatCard
          icon={Users}
          label="Total Users"
          value={dashboardData?.overview?.totalUsers || stats?.totalUsers || 0}
          subValue={dashboardData?.overview?.newUsersToday ? `+${dashboardData.overview.newUsersToday} today` : null}
          gradient="from-blue-500 to-cyan-500"
        />
        <HeroStatCard
          icon={Hash}
          label="Channels"
          value={dashboardData?.overview?.activeChannels || stats?.activeChannels || 0}
          subValue={`${liveChannels.length} streaming`}
          gradient="from-green-500 to-emerald-600"
        />
        <HeroStatCard
          icon={Activity}
          label="Messages (24h)"
          value={messages24h}
          gradient="from-orange-500 to-red-500"
          trend={dashboardData?.overview?.messageGrowth}
          trendLabel="vs yesterday"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left Column - Live Stats & Charts */}
        <div className="col-span-8 flex flex-col gap-4">
          {/* Live Throughput + Messages Chart */}
          <div className="grid grid-cols-5 gap-4">
            <div className="col-span-2">
              <LiveMpsWidget 
                mps={mps} 
                mpsHistory={mpsHistory} 
                peakMps={peakMps} 
                isConnected={isConnected} 
              />
            </div>
            <div className="col-span-3 bg-twitch-gray rounded-xl border border-gray-700/50 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-twitch-purple" />
                  <span className="font-medium text-white">Message Volume</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-gray-500">24 hours</span>
                  <span className="text-2xl font-bold text-twitch-purple">{formatNumber(messages24h)}</span>
                </div>
              </div>
              <MessagesAreaChart data={chartData} height={200} />
            </div>
          </div>

          {/* Analytics Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Peak Hours */}
            <div className="bg-twitch-gray rounded-xl border border-gray-700/50 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-cyan-400" />
                  <span className="font-medium text-white">Peak Hours</span>
                </div>
                <span className="text-xs text-gray-500">30-day average</span>
              </div>
              <PeakHoursChart data={peakHoursData} height={100} />
            </div>

            {/* Mod Actions Breakdown */}
            <div className="bg-twitch-gray rounded-xl border border-gray-700/50 p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-red-400" />
                  <span className="font-medium text-white">Mod Actions</span>
                </div>
                <span className="text-xs text-gray-500">Last 24h</span>
              </div>
              {(dashboardData?.moderation?.breakdown?.length > 0) ? (
                <ModActionsPieChart 
                  data={dashboardData.moderation.breakdown} 
                  height={120} 
                />
              ) : (
                <div className="h-[120px] flex items-center justify-center text-gray-500 text-sm">
                  No mod actions in the last 24h
                </div>
              )}
            </div>
          </div>

          {/* Recent Mod Actions - fixed height */}
          <RecentModActionsWidget 
            actions={allModActions} 
            isLoading={modActionsLoading && globalModActions.length === 0}
            className="h-[350px]"
          />
        </div>

        {/* Right Column - Widgets */}
        <div className="col-span-4 space-y-4">
          {/* Secondary Stats */}
          <div className="grid grid-cols-2 gap-3">
            <MiniStatCard 
              icon={Radio} 
              label="Streaming" 
              value={liveChannels.length} 
              color="text-red-400"
              bgColor="bg-red-500/10"
              pulse={liveChannels.length > 0}
            />
            <MiniStatCard 
              icon={Activity} 
              label="IRC Connected" 
              value={joinedChannels.length} 
              color="text-green-400"
              bgColor="bg-green-500/10"
            />
            <MiniStatCard 
              icon={Zap} 
              label="Live Session" 
              value={liveMessages.length} 
              color="text-yellow-400"
              bgColor="bg-yellow-500/10"
            />
            <MiniStatCard 
              icon={Database} 
              label="Buffered" 
              value={stats?.archiveBuffer?.bufferedMessages || 0} 
              color="text-blue-400"
              bgColor="bg-blue-500/10"
            />
          </div>

          {/* Live Channels */}
          <LiveChannelsWidget channels={activeChannels} />

          {/* Top Chatters */}
          <TopChattersWidget chatters={dashboardData?.leaderboards?.topChatters || []} />

          {/* Channel Activity */}
          <ChannelActivityWidget channels={dashboardData?.leaderboards?.channelActivity || []} />
        </div>
      </div>

      {/* Quick Navigation */}
      <div>
        <SectionHeader icon={Layers} title="Quick Access" />
        <div className="grid grid-cols-4 gap-4">
          <QuickNavCard
            to="/live"
            icon={Radio}
            title="Live Feed"
            subtitle="Real-time messages"
            color="green-400"
            bgColor="bg-green-500/10"
          />
          <QuickNavCard
            to="/messages"
            icon={MessageSquare}
            title="Messages"
            subtitle="Search & filter"
            color="twitch-purple"
            bgColor="bg-twitch-purple/10"
          />
          <QuickNavCard
            to="/moderation"
            icon={Shield}
            title="Moderation"
            subtitle="Actions & bans"
            color="red-400"
            bgColor="bg-red-500/10"
          />
          <QuickNavCard
            to="/channels"
            icon={Hash}
            title="Channels"
            subtitle="Manage channels"
            color="blue-400"
            bgColor="bg-blue-500/10"
          />
        </div>
      </div>

      {/* Monitoring Channels */}
      <MonitoringChannelsWidget channels={activeChannels} />
    </div>
  );
}

export default Home;
