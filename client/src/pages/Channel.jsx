import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useChannel, useChannelStats, useChannelTopUsers } from '../hooks/useChannels';
import { useInfiniteChannelMessages, useInfiniteChannelModActions, useInfiniteChannelLinks } from '../hooks/useInfiniteData';
import { useWebSocket, useGlobalWebSocket, useChannelMps } from '../hooks/useWebSocket';
import { useEmotes } from '../hooks/useEmotes';
import { useProfileCardStore } from '../stores/profileCardStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useChannelSettingsStore } from '../stores/channelSettingsStore';
import { useMobile } from '../hooks/useMobile';
import { MobileChannel } from './mobile';
import { formatDateTime, formatNumber, formatRelative, formatDuration } from '../utils/formatters';
import LoadingSpinner from '../components/common/LoadingSpinner';
import InfiniteScroll, { InfiniteScrollLoader, InfiniteScrollEmpty } from '../components/common/InfiniteScroll';
import RefreshControl from '../components/common/RefreshControl';
import LiveFeed from '../components/chat/LiveFeed';
import LinkPanel from '../components/chat/LinkPanel';
import LinkPreview from '../components/chat/LinkPreview';
import LinksTab from '../components/chat/LinksTab';
import MessageList from '../components/chat/MessageList';
import ModActionList from '../components/moderation/ModActionList';
import ChannelSettingsTab from '../components/channel/ChannelSettingsTab';
import ChannelAnalyticsTab from '../components/chat/ChannelAnalyticsTab';
import ChannelMonetizationTab from '../components/channel/ChannelMonetizationTab';
import { 
  Radio, 
  Hash, 
  MessageSquare, 
  Shield, 
  Users, 
  Calendar,
  TrendingUp,
  Clock,
  Ban,
  AlertTriangle,
  ExternalLink,
  Activity,
  ChevronLeft,
  ChevronRight,
  Link as LinkIcon,
  Settings,
  BarChart3,
  Eye,
  Gamepad2,
  Zap,
  DollarSign
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

function Channel() {
  const { name } = useParams();
  const { isMobile } = useMobile();
  const openProfileCard = useProfileCardStore(state => state.openCard);
  const resultsPerPage = useSettingsStore(state => state.resultsPerPage);
  const { getChannelSettings } = useChannelSettingsStore();
  
  // Get channel-specific settings
  const channelSettings = getChannelSettings(name);
  
  const [activeTab, setActiveTab] = useState(channelSettings.defaultTab || 'live');
  const [linkPanelCollapsed, setLinkPanelCollapsed] = useState(channelSettings.linkPanelCollapsed);
  const [modPanelCollapsed, setModPanelCollapsed] = useState(channelSettings.modPanelCollapsed);

  // Mobile view
  if (isMobile) {
    return <MobileChannel />;
  }
  
  // Fetch channel data
  const { data: channel, isLoading: channelLoading, error: channelError, refetch: refetchChannel } = useChannel(name);
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useChannelStats(name);
  const { data: topUsersData, isLoading: topUsersLoading, refetch: refetchTopUsers } = useChannelTopUsers(name, { limit: 10 });

  // Subscribe to global WebSocket for real-time channel status updates
  const { channelStatuses } = useGlobalWebSocket();
  
  // Get channel-specific MPS data
  const { mps: channelMps, mpsHistory: channelMpsHistory, peakMps: channelPeakMps } = useChannelMps(name);
  
  // Merge API data with real-time WebSocket updates
  const liveChannelStatus = channelStatuses[name?.toLowerCase()] || {};
  const channelData = useMemo(() => {
    if (!channel) return null;
    return {
      ...channel,
      // Override with real-time data if available
      is_live: liveChannelStatus.is_live ?? channel.is_live,
      viewer_count: liveChannelStatus.viewer_count ?? channel.viewer_count,
      stream_title: liveChannelStatus.stream_title ?? channel.stream_title,
      game_name: liveChannelStatus.game_name ?? channel.game_name,
      started_at: liveChannelStatus.started_at ?? channel.started_at,
      profile_image_url: liveChannelStatus.profile_image_url ?? channel.profile_image_url,
    };
  }, [channel, liveChannelStatus]);

  // Infinite scroll data
  const {
    data: messagesData,
    isLoading: messagesLoading,
    hasNextPage: hasMoreMessages,
    fetchNextPage: fetchMoreMessages,
    isFetchingNextPage: isFetchingMoreMessages,
    refetch: refetchMessages,
    isFetching: isRefetchingMessages,
  } = useInfiniteChannelMessages(name, { limit: 50 });

  const {
    data: modActionsData,
    isLoading: modActionsLoading,
    hasNextPage: hasMoreModActions,
    fetchNextPage: fetchMoreModActions,
    isFetchingNextPage: isFetchingMoreModActions,
    refetch: refetchModActions,
    isFetching: isRefetchingModActions,
  } = useInfiniteChannelModActions(name, { limit: 50 });

  const {
    data: linksData,
    isLoading: linksLoading,
    hasNextPage: hasMoreLinks,
    fetchNextPage: fetchMoreLinks,
    isFetchingNextPage: isFetchingMoreLinks,
    refetch: refetchLinks,
    isFetching: isRefetchingLinks,
  } = useInfiniteChannelLinks(name, { limit: resultsPerPage });

  // Flatten paginated data
  const allMessages = useMemo(() => 
    messagesData?.pages?.flatMap(page => page.messages || []) || [], 
    [messagesData]
  );
  const allModActions = useMemo(() => 
    modActionsData?.pages?.flatMap(page => page.actions || []) || [], 
    [modActionsData]
  );
  const allLinkMessages = useMemo(() => 
    linksData?.pages?.flatMap(page => page.messages || []) || [], 
    [linksData]
  );
  const totalLinks = linksData?.pages?.[0]?.total || 0;

  // Live feed
  const { 
    isConnected, 
    messages: liveMessages, 
    modActions: liveModActions,
    clearMessages,
    clearModActions 
  } = useWebSocket([name]);

  // Load emotes for this channel
  const { loadChannelEmotes } = useEmotes();
  
  useEffect(() => {
    if (channel?.twitch_id) {
      loadChannelEmotes(channel.twitch_id, channel.name);
    }
  }, [channel, loadChannelEmotes]);

  // Force re-render every minute to update uptime display
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!channelData?.is_live) return;
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, [channelData?.is_live]);

  // Parse mod action stats
  const modStats = useMemo(() => {
    if (!statsData?.stats?.mod_actions) return { bans: 0, timeouts: 0, deletes: 0 };
    
    const actions = statsData.stats.mod_actions;
    return {
      bans: actions.find(a => a.action_type === 'ban')?.count || 0,
      timeouts: actions.find(a => a.action_type === 'timeout')?.count || 0,
      deletes: actions.find(a => a.action_type === 'delete')?.count || 0,
    };
  }, [statsData]);

  // Refresh callbacks for tabs (memoized to prevent infinite loops)
  const [analyticsKey, setAnalyticsKey] = useState(0);
  const [monetizationKey, setMonetizationKey] = useState(0);
  
  const handleRefreshMessages = useCallback(() => {
    refetchMessages();
  }, [refetchMessages]);
  
  const handleRefreshModActions = useCallback(() => {
    refetchModActions();
  }, [refetchModActions]);
  
  const handleRefreshLinks = useCallback(() => {
    refetchLinks();
  }, [refetchLinks]);
  
  const handleRefreshUsers = useCallback(() => {
    refetchTopUsers();
  }, [refetchTopUsers]);
  
  const handleRefreshAnalytics = useCallback(() => {
    refetchStats();
    setAnalyticsKey(k => k + 1);
  }, [refetchStats]);
  
  const handleRefreshMonetization = useCallback(() => {
    setMonetizationKey(k => k + 1);
  }, []);

  if (channelLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (channelError || !channel) {
    return (
      <div className="text-center py-8">
        <Hash className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p className="text-red-400 text-lg">Channel not found</p>
        <p className="text-gray-500 mt-2">The channel "{name}" doesn't exist or hasn't been added yet.</p>
        <Link to="/channels" className="text-twitch-purple hover:underline mt-4 block">
          View all channels
        </Link>
      </div>
    );
  }

  const stats = statsData?.stats || {};

  // Calculate stream uptime
  const getStreamUptime = () => {
    if (!channelData?.started_at) return null;
    const started = new Date(channelData.started_at);
    const now = new Date();
    const diffMs = now - started;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Channel Header */}
      <div className="bg-twitch-gray rounded-lg p-6 border border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            {/* Profile Picture */}
            {channelData.profile_image_url ? (
              <img 
                src={channelData.profile_image_url} 
                alt={channelData.display_name || channelData.name}
                className={`w-16 h-16 rounded-full border-2 ${
                  channelData.is_live ? 'border-red-500 ring-2 ring-red-500/50' : 'border-gray-600'
                }`}
              />
            ) : (
              <div className={`p-4 rounded-full ${channelData.is_live ? 'bg-red-500' : 'bg-twitch-purple'}`}>
                <Hash className="w-8 h-8 text-white" />
              </div>
            )}
            
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <a href={`/watch/${channelData.name}`}><h1 className="text-2xl font-bold text-white">
                  {channelData.display_name || channelData.name}
                </h1>
                </a>
                {channelData.is_live && (
                  <span className="flex items-center space-x-1 px-2 py-0.5 rounded bg-red-500 text-white text-xs font-medium animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-white" />
                    <span>LIVE</span>
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  channelData.is_active 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {channelData.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              {/* Stream Info (when live) */}
              {channelData.is_live && (
                <div className="mt-2 space-y-1">
                  {channelData.stream_title && (
                    <p className="text-white text-sm line-clamp-1" title={channelData.stream_title}>
                      {channelData.stream_title}
                    </p>
                  )}
                  <div className="flex items-center space-x-4 text-sm text-gray-400">
                    {channelData.game_name && (
                      <span className="flex items-center space-x-1">
                        <Gamepad2 className="w-3.5 h-3.5" />
                        <span>{channelData.game_name}</span>
                      </span>
                    )}
                    {channelData.viewer_count != null && (
                      <span className="flex items-center space-x-1 text-red-400">
                        <Eye className="w-3.5 h-3.5" />
                        <span>{formatNumber(channelData.viewer_count)} viewers</span>
                      </span>
                    )}
                    {channelData.started_at && (
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Uptime: {getStreamUptime()}</span>
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              <div className="flex items-center space-x-4 mt-2">
                <a 
                  href={`https://twitch.tv/${channelData.name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-twitch-purple hover:underline text-sm"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>View on Twitch</span>
                </a>
                <span className="text-gray-500">•</span>
                <span className={`flex items-center space-x-1 text-sm ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                  <Radio className="w-3 h-3" />
                  <span>{isConnected ? 'IRC Connected' : 'Connecting...'}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-3">
            <MessageSquare className="w-5 h-5 text-twitch-purple" />
            <div>
              <p className="text-xl font-bold text-white">{formatNumber(stats.total_messages || 0)}</p>
              <p className="text-xs text-gray-400">Messages</p>
            </div>
          </div>
        </div>

        <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-3">
            <Users className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-xl font-bold text-white">{formatNumber(stats.unique_users || 0)}</p>
              <p className="text-xs text-gray-400">Unique Users</p>
            </div>
          </div>
        </div>

        <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-3">
            <Ban className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-xl font-bold text-white">{formatNumber(modStats.bans)}</p>
              <p className="text-xs text-gray-400">Bans</p>
            </div>
          </div>
        </div>

        <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-3">
            <Clock className="w-5 h-5 text-yellow-400" />
            <div>
              <p className="text-xl font-bold text-white">{formatNumber(modStats.timeouts)}</p>
              <p className="text-xs text-gray-400">Timeouts</p>
            </div>
          </div>
        </div>

        <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
            <div>
              <p className="text-xl font-bold text-white">{formatNumber(stats.deleted_messages || 0)}</p>
              <p className="text-xs text-gray-400">Deleted</p>
            </div>
          </div>
        </div>

        {/* Live MPS with mini sparkline */}
        <div className="bg-twitch-gray rounded-lg p-3 border border-gray-700 relative overflow-hidden">
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center space-x-2">
              <Zap className={`w-5 h-5 ${channelMps > 0 ? 'text-yellow-400 animate-pulse' : 'text-gray-500'}`} />
              <div>
                <p className={`text-xl font-bold ${channelMps > 0 ? 'text-white' : 'text-gray-400'}`}>
                  {channelMps.toFixed(1)}
                </p>
                <p className="text-xs text-gray-400">msg/sec</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">peak</p>
              <p className="text-sm font-semibold text-twitch-purple">{channelPeakMps.toFixed(1)}</p>
            </div>
          </div>
          {/* Mini sparkline background */}
          <div className="absolute inset-0 opacity-30">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={channelMpsHistory} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="channelMpsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9147ff" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#9147ff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#9147ff" 
                  strokeWidth={1}
                  fill="url(#channelMpsGradient)" 
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-700">
        <nav className="flex space-x-4">
          {[
            { id: 'live', label: 'Live Feed', icon: Radio },
            { id: 'messages', label: 'Message History', icon: MessageSquare },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            { id: 'monetization', label: 'Monetization', icon: DollarSign },
            { id: 'links', label: 'Links', icon: LinkIcon, count: totalLinks },
            { id: 'moderation', label: 'Mod Actions', icon: Shield },
            { id: 'users', label: 'Top Users', icon: TrendingUp },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-twitch-purple text-twitch-purple'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="text-xs bg-gray-700 px-1.5 py-0.5 rounded-full">
                  {formatNumber(tab.count)}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className={activeTab === 'live' ? 'flex gap-6' : ''}>
        {/* Links Panel - Only on Live tab */}
        {activeTab === 'live' && (
          <LinkPanel 
            messages={liveMessages}
            isCollapsed={linkPanelCollapsed}
            onToggle={() => setLinkPanelCollapsed(!linkPanelCollapsed)}
          />
        )}

        {/* Main Content */}
        <div className={activeTab === 'live' ? 'flex-1 min-w-0' : 'w-full'}>
          {activeTab === 'live' && (
            <div className="bg-twitch-gray rounded-lg border border-gray-700 h-[600px]">
              <LiveFeed 
                messages={liveMessages} 
                onClear={clearMessages}
                channels={[channel]}
                showChannelName={false}
              />
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="bg-twitch-gray rounded-lg border border-gray-700 max-w-5xl mx-auto">
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white flex items-center">
                  <MessageSquare className="w-5 h-5 mr-2 text-twitch-purple" />
                  Message History
                </h2>
                <div className="flex items-center gap-4">
                  <RefreshControl
                    onRefresh={handleRefreshMessages}
                    isLoading={isRefetchingMessages}
                    storageKey={`channel_${name}_messages`}
                  />
                  <Link 
                    to={`/messages?channel=${name}`}
                    className="text-sm text-twitch-purple hover:underline"
                  >
                    View all & search
                  </Link>
                </div>
              </div>
              <div className="max-h-[550px] overflow-y-auto">
                {messagesLoading ? (
                  <InfiniteScrollLoader />
                ) : allMessages.length > 0 ? (
                  <InfiniteScroll
                    hasNextPage={hasMoreMessages}
                    isFetchingNextPage={isFetchingMoreMessages}
                    fetchNextPage={fetchMoreMessages}
                    isLoading={messagesLoading}
                    endMessage="No more messages"
                  >
                    <MessageList 
                      messages={allMessages}
                      isLoading={false}
                      emptyMessage="No messages archived yet"
                      showChannel={false}
                    />
                  </InfiniteScroll>
                ) : (
                  <InfiniteScrollEmpty 
                    icon={MessageSquare}
                    message="No messages archived yet"
                  />
                )}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="w-full">
              <div className="flex items-center justify-end mb-4">
                <RefreshControl
                  onRefresh={handleRefreshAnalytics}
                  isLoading={statsLoading}
                  storageKey={`channel_${name}_analytics`}
                />
              </div>
              <ChannelAnalyticsTab key={analyticsKey} channelName={name} />
            </div>
          )}

          {activeTab === 'monetization' && (
            <div className="w-full">
              <div className="flex items-center justify-end mb-4">
                <RefreshControl
                  onRefresh={handleRefreshMonetization}
                  isLoading={false}
                  storageKey={`channel_${name}_monetization`}
                />
              </div>
              <ChannelMonetizationTab key={monetizationKey} channelName={name} />
            </div>
          )}

          {activeTab === 'moderation' && (
            <div className="bg-twitch-gray rounded-lg border border-gray-700 max-w-5xl mx-auto">
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-red-400" />
                  Mod Actions
                </h2>
                <div className="flex items-center gap-4">
                  <RefreshControl
                    onRefresh={handleRefreshModActions}
                    isLoading={isRefetchingModActions}
                    storageKey={`channel_${name}_moderation`}
                  />
                  <Link 
                    to={`/moderation?channel=${name}`}
                    className="text-sm text-twitch-purple hover:underline"
                  >
                    View all
                  </Link>
                </div>
              </div>
              <div className="max-h-[550px] overflow-y-auto p-4">
                {modActionsLoading ? (
                  <InfiniteScrollLoader />
                ) : allModActions.length > 0 ? (
                  <InfiniteScroll
                    hasNextPage={hasMoreModActions}
                    isFetchingNextPage={isFetchingMoreModActions}
                    fetchNextPage={fetchMoreModActions}
                    isLoading={modActionsLoading}
                    endMessage="No more mod actions"
                  >
                    <ModActionList 
                      actions={allModActions}
                      isLoading={false}
                      emptyMessage="No mod actions recorded"
                    />
                  </InfiniteScroll>
                ) : (
                  <InfiniteScrollEmpty 
                    icon={Shield}
                    message="No mod actions recorded"
                  />
                )}
              </div>
            </div>
          )}

          {activeTab === 'links' && (
            <div className="bg-twitch-gray rounded-lg border border-gray-700 p-4 max-w-5xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center">
                  <LinkIcon className="w-5 h-5 mr-2 text-blue-400" />
                  Links ({formatNumber(totalLinks)})
                </h2>
                <RefreshControl
                  onRefresh={handleRefreshLinks}
                  isLoading={isRefetchingLinks}
                  storageKey={`channel_${name}_links`}
                />
              </div>
              <InfiniteScroll
                hasNextPage={hasMoreLinks}
                isFetchingNextPage={isFetchingMoreLinks}
                fetchNextPage={fetchMoreLinks}
                isLoading={linksLoading}
                endMessage="No more links"
              >
                <LinksTab 
                  messages={allLinkMessages}
                  isLoading={linksLoading}
                  totalCount={totalLinks}
                  channelName={name}
                />
              </InfiniteScroll>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="bg-twitch-gray rounded-lg border border-gray-700 max-w-3xl mx-auto">
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-green-400" />
                  Top Chatters
                </h2>
                <RefreshControl
                  onRefresh={handleRefreshUsers}
                  isLoading={topUsersLoading}
                  storageKey={`channel_${name}_users`}
                />
              </div>
              <div className="p-4">
                {topUsersLoading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : topUsersData?.users?.length > 0 ? (
                  <div className="space-y-2">
                    {topUsersData.users.map((user, index) => (
                      <div 
                        key={user.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                            index === 0 ? 'bg-yellow-500 text-black' :
                            index === 1 ? 'bg-gray-400 text-black' :
                            index === 2 ? 'bg-amber-600 text-black' :
                            'bg-gray-700 text-gray-300'
                          }`}>
                            {index + 1}
                          </span>
                          <button
                            onClick={() => openProfileCard(user.username)}
                            className="font-medium text-white hover:text-twitch-purple hover:underline"
                          >
                            {user.display_name || user.username}
                          </button>
                        </div>
                        <div className="flex items-center space-x-4 text-sm">
                          <span className="text-gray-400">
                            {formatNumber(user.message_count)} messages
                          </span>
                          <span className="text-gray-500 text-xs">
                            Last: {formatRelative(user.last_message_at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-400 py-8">No user data available</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Live Mod Actions (Collapsible) */}
        {activeTab === 'live' && (
          <div className={`bg-twitch-gray rounded-lg border border-gray-700 h-[600px] flex flex-col transition-all duration-300 ${
            modPanelCollapsed ? 'w-12' : 'w-96'
          }`}>
            {modPanelCollapsed ? (
              // Collapsed state
              <div className="flex flex-col items-center py-3 h-full">
                <button
                  onClick={() => setModPanelCollapsed(false)}
                  className="p-1.5 hover:bg-gray-700 rounded transition-colors mb-3"
                  title="Expand mod actions"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-400" />
                </button>
                <div className="flex flex-col items-center space-y-2">
                  <Shield className="w-5 h-5 text-red-400" />
                  {liveModActions.length > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                      {liveModActions.length}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              // Expanded state
              <>
                <div className="p-3 border-b border-gray-700 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setModPanelCollapsed(true)}
                      className="p-1 hover:bg-gray-700 rounded transition-colors"
                      title="Collapse mod actions"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                    <Shield className="w-4 h-4 text-red-400" />
                    <span className="text-sm text-gray-300">Live Mod Actions</span>
                    {liveModActions.length > 0 && (
                      <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                        {liveModActions.length}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={clearModActions}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {liveModActions.length > 0 ? (
                    <ModActionList 
                      actions={liveModActions}
                      isLoading={false}
                      compact={true}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <Shield className="w-8 h-8 mb-2" />
                      <p className="text-sm">No recent mod actions</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="w-full max-w-4xl mx-auto">
            <ChannelSettingsTab channelName={name} />
          </div>
        )}
      </div>
    </div>
  );
}

export default Channel;
