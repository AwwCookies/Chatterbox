import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useChannel, useChannelStats, useChannelTopUsers } from '../hooks/useChannels';
import { useInfiniteChannelMessages, useInfiniteChannelModActions, useInfiniteChannelLinks } from '../hooks/useInfiniteData';
import { useWebSocket } from '../hooks/useWebSocket';
import { useEmotes } from '../hooks/useEmotes';
import { useProfileCardStore } from '../stores/profileCardStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useChannelSettingsStore } from '../stores/channelSettingsStore';
import { useMobile } from '../hooks/useMobile';
import { MobileChannel } from './mobile';
import { formatDateTime, formatNumber, formatRelative } from '../utils/formatters';
import LoadingSpinner from '../components/common/LoadingSpinner';
import InfiniteScroll, { InfiniteScrollLoader, InfiniteScrollEmpty } from '../components/common/InfiniteScroll';
import LiveFeed from '../components/chat/LiveFeed';
import LinkPanel from '../components/chat/LinkPanel';
import LinkPreview from '../components/chat/LinkPreview';
import LinksTab from '../components/chat/LinksTab';
import MessageList from '../components/chat/MessageList';
import ModActionList from '../components/moderation/ModActionList';
import ChannelSettingsTab from '../components/channel/ChannelSettingsTab';
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
  Settings
} from 'lucide-react';

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
  const { data: channel, isLoading: channelLoading, error: channelError } = useChannel(name);
  const { data: statsData, isLoading: statsLoading } = useChannelStats(name);
  const { data: topUsersData, isLoading: topUsersLoading } = useChannelTopUsers(name, { limit: 10 });

  // Infinite scroll data
  const {
    data: messagesData,
    isLoading: messagesLoading,
    hasNextPage: hasMoreMessages,
    fetchNextPage: fetchMoreMessages,
    isFetchingNextPage: isFetchingMoreMessages,
  } = useInfiniteChannelMessages(name, { limit: 50 });

  const {
    data: modActionsData,
    isLoading: modActionsLoading,
    hasNextPage: hasMoreModActions,
    fetchNextPage: fetchMoreModActions,
    isFetchingNextPage: isFetchingMoreModActions,
  } = useInfiniteChannelModActions(name, { limit: 50 });

  const {
    data: linksData,
    isLoading: linksLoading,
    hasNextPage: hasMoreLinks,
    fetchNextPage: fetchMoreLinks,
    isFetchingNextPage: isFetchingMoreLinks,
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

  return (
    <div className="space-y-6">
      {/* Channel Header */}
      <div className="bg-twitch-gray rounded-lg p-6 border border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <div className="p-4 bg-twitch-purple rounded-full">
              <Hash className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-white">
                  #{channel.display_name || channel.name}
                </h1>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  channel.is_active 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {channel.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <div className="flex items-center space-x-4 mt-2">
                <a 
                  href={`https://twitch.tv/${channel.name}`}
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
                  <span>{isConnected ? 'Live Connected' : 'Connecting...'}</span>
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

        <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-3">
            <Activity className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-xl font-bold text-white">{liveMessages.length}</p>
              <p className="text-xs text-gray-400">Live Queue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-700">
        <nav className="flex space-x-4">
          {[
            { id: 'live', label: 'Live Feed', icon: Radio },
            { id: 'messages', label: 'Message History', icon: MessageSquare },
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
      <div className={activeTab === 'live' ? 'flex gap-6' : 'grid grid-cols-1 lg:grid-cols-3 gap-6'}>
        {/* Links Panel - Only on Live tab */}
        {activeTab === 'live' && (
          <LinkPanel 
            messages={liveMessages}
            isCollapsed={linkPanelCollapsed}
            onToggle={() => setLinkPanelCollapsed(!linkPanelCollapsed)}
          />
        )}

        {/* Main Content */}
        <div className={activeTab === 'live' ? 'flex-1 min-w-0' : 'lg:col-span-2'}>
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
            <div className="bg-twitch-gray rounded-lg border border-gray-700">
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white flex items-center">
                  <MessageSquare className="w-5 h-5 mr-2 text-twitch-purple" />
                  Message History
                </h2>
                <Link 
                  to={`/messages?channel=${name}`}
                  className="text-sm text-twitch-purple hover:underline"
                >
                  View all & search
                </Link>
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

          {activeTab === 'moderation' && (
            <div className="bg-twitch-gray rounded-lg border border-gray-700">
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-red-400" />
                  Mod Actions
                </h2>
                <Link 
                  to={`/moderation?channel=${name}`}
                  className="text-sm text-twitch-purple hover:underline"
                >
                  View all
                </Link>
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
            <div className="bg-twitch-gray rounded-lg border border-gray-700 p-4">
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
            <div className="bg-twitch-gray rounded-lg border border-gray-700">
              <div className="p-4 border-b border-gray-700">
                <h2 className="text-lg font-semibold text-white flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-green-400" />
                  Top Chatters
                </h2>
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
          <div className="lg:col-span-3">
            <ChannelSettingsTab channelName={name} />
          </div>
        )}
      </div>
    </div>
  );
}

export default Channel;
