import { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { channelsApi, messagesApi, modActionsApi } from '../../services/api';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useEmotes } from '../../hooks/useEmotes';
import { formatNumber, formatRelative } from '../../utils/formatters';
import { MobileMessageItem, MobileModActionCard, MobileLiveFeed, MobileScrollableTabs, PullToRefresh } from '../../components/mobile';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import InfiniteScroll from '../../components/common/InfiniteScroll';
import { Hash, MessageSquare, Shield, Users, Radio, ArrowLeft, Clock, ExternalLink } from 'lucide-react';

function MobileChannel() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('live');

  const { data: channel, isLoading, error, refetch } = useQuery({
    queryKey: ['channel', name],
    queryFn: () => channelsApi.getByName(name).then(res => res.data),
  });

  // WebSocket for live messages - subscribe to this channel only
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

  // Infinite query for messages
  const {
    data: messagesData,
    isLoading: messagesLoading,
    fetchNextPage: fetchNextMessages,
    hasNextPage: hasNextMessages,
    isFetchingNextPage: isFetchingNextMessages,
    refetch: refetchMessages,
  } = useInfiniteQuery({
    queryKey: ['channelMessages', name, 'infinite', 'mobile'],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await messagesApi.getAll({ channel: name, limit: 30, offset: pageParam });
      return { ...response.data, _offset: pageParam, _limit: 30 };
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.hasMore) {
        return lastPage._offset + lastPage._limit;
      }
      return undefined;
    },
    initialPageParam: 0,
    enabled: !!channel,
  });

  // Infinite query for mod actions
  const {
    data: modActionsData,
    isLoading: modActionsLoading,
    fetchNextPage: fetchNextModActions,
    hasNextPage: hasNextModActions,
    isFetchingNextPage: isFetchingNextModActions,
    refetch: refetchModActions,
  } = useInfiniteQuery({
    queryKey: ['channelModActions', name, 'infinite', 'mobile'],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await modActionsApi.getAll({ channel: name, limit: 30, offset: pageParam });
      return { ...response.data, _offset: pageParam, _limit: 30 };
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.hasMore) {
        return lastPage._offset + lastPage._limit;
      }
      return undefined;
    },
    initialPageParam: 0,
    enabled: !!channel,
  });

  // Flatten messages and mod actions
  const messages = useMemo(() => {
    return messagesData?.pages?.flatMap(page => page.messages || []) || [];
  }, [messagesData]);

  const modActions = useMemo(() => {
    return modActionsData?.pages?.flatMap(page => page.actions || []) || [];
  }, [modActionsData]);

  const { data: statsData } = useQuery({
    queryKey: ['channelStats', name],
    queryFn: () => channelsApi.getStats(channel.id).then(res => res.data),
    enabled: !!channel?.id,
  });

  const handleRefresh = async () => {
    await Promise.all([refetch(), refetchMessages(), refetchModActions()]);
  };

  const tabs = [
    { 
      id: 'live', 
      label: 'Live', 
      icon: Radio, 
      badge: liveMessages.length > 0 ? liveMessages.length : undefined,
      dotColor: isConnected ? 'bg-green-500' : 'bg-red-500'
    },
    { id: 'messages', label: 'Messages', icon: MessageSquare, badge: messagesData?.pages?.[0]?.total },
    { id: 'modActions', label: 'Mod Actions', icon: Shield, badge: modActionsData?.pages?.[0]?.total },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !channel) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 p-4">
        <Hash className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-center">Channel not found</p>
        <button 
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-twitch-purple text-white rounded-lg"
        >
          Go back
        </button>
      </div>
    );
  }

  const stats = statsData || {};

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)]">
      {/* Header */}
      <div className="px-4 py-3 bg-twitch-gray border-b border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-gray-400 active:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white">#{channel.display_name || channel.name}</h1>
              {channel.is_active && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 rounded-full">
                  <Radio className="w-3 h-3 text-green-400" />
                  <span className="text-xs text-green-400">Active</span>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-400">Twitch ID: {channel.twitch_id}</p>
          </div>
          <a
            href={`https://twitch.tv/${channel.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-3 bg-twitch-purple/20 rounded-full text-twitch-purple"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-twitch-dark rounded-lg p-3 text-center">
            <MessageSquare className="w-4 h-4 text-twitch-purple mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{formatNumber(stats.total_messages || 0)}</p>
            <p className="text-[10px] text-gray-400">Messages</p>
          </div>
          <div className="bg-twitch-dark rounded-lg p-3 text-center">
            <Users className="w-4 h-4 text-blue-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{formatNumber(stats.unique_users || 0)}</p>
            <p className="text-[10px] text-gray-400">Users</p>
          </div>
          <div className="bg-twitch-dark rounded-lg p-3 text-center">
            <Shield className="w-4 h-4 text-red-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{formatNumber(stats.mod_actions || 0)}</p>
            <p className="text-[10px] text-gray-400">Mod Actions</p>
          </div>
        </div>

        {/* Timestamps */}
        <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Added: {formatRelative(channel.created_at)}
          </span>
          {stats.last_message_at && (
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              Last: {formatRelative(stats.last_message_at)}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <MobileScrollableTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Content */}
      {activeTab === 'live' ? (
        <MobileLiveFeed
          messages={liveMessages}
          onClear={clearMessages}
          isConnected={isConnected}
          showChannel={false}
          channelId={channel?.twitch_id}
        />
      ) : (
        <PullToRefresh onRefresh={handleRefresh} className="flex-1 overflow-y-auto">
          {activeTab === 'messages' ? (
            messagesLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-center">No messages yet</p>
                <p className="text-sm text-gray-500 mt-2 text-center">
                  Messages will appear here once archived
                </p>
              </div>
            ) : (
              <InfiniteScroll
                hasNextPage={hasNextMessages}
                fetchNextPage={fetchNextMessages}
                isFetchingNextPage={isFetchingNextMessages}
                loadingText="Loading messages..."
              >
                {messages.map(message => (
                  <MobileMessageItem 
                    key={message.id} 
                    message={message}
                    showChannel={false}
                    channelId={channel.twitch_id}
                  />
                ))}
              </InfiniteScroll>
            )
          ) : (
            modActionsLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : modActions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Shield className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-center">No mod actions</p>
              </div>
            ) : (
              <InfiniteScroll
                hasNextPage={hasNextModActions}
                fetchNextPage={fetchNextModActions}
                isFetchingNextPage={isFetchingNextModActions}
                loadingText="Loading mod actions..."
              >
                {modActions.map(action => (
                  <MobileModActionCard 
                    key={action.id} 
                    action={action}
                    showChannel={false}
                  />
                ))}
              </InfiniteScroll>
            )
          )}
        </PullToRefresh>
      )}
    </div>
  );
}

export default MobileChannel;
