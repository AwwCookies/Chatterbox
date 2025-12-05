import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { usersApi } from '../../services/api';
import { useUser } from '../../hooks/useUsers';
import { formatDateTime, formatNumber, formatRelative } from '../../utils/formatters';
import { MobileMessageItem, MobileModActionCard, MobileScrollableTabs, PullToRefresh } from '../../components/mobile';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import InfiniteScroll from '../../components/common/InfiniteScroll';
import { User as UserIcon, MessageSquare, Shield, Calendar, Hash, AlertTriangle, ArrowLeft, ChevronRight } from 'lucide-react';

function MobileUser() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('messages');
  
  const { data: user, isLoading, error, refetch } = useUser(username);

  // Infinite query for messages
  const {
    data: messagesData,
    isLoading: messagesLoading,
    fetchNextPage: fetchNextMessages,
    hasNextPage: hasNextMessages,
    isFetchingNextPage: isFetchingNextMessages,
    refetch: refetchMessages,
  } = useInfiniteQuery({
    queryKey: ['user', username, 'messages', 'infinite', 'mobile'],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await usersApi.getMessages(username, { limit: 30, offset: pageParam });
      return { ...response.data, _offset: pageParam, _limit: 30 };
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.hasMore) {
        return lastPage._offset + lastPage._limit;
      }
      return undefined;
    },
    initialPageParam: 0,
    enabled: !!username,
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
    queryKey: ['user', username, 'mod-actions', 'infinite', 'mobile'],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await usersApi.getModActions(username, { limit: 30, offset: pageParam });
      return { ...response.data, _offset: pageParam, _limit: 30 };
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.hasMore) {
        return lastPage._offset + lastPage._limit;
      }
      return undefined;
    },
    initialPageParam: 0,
    enabled: !!username,
  });

  // Flatten messages and mod actions
  const messages = useMemo(() => {
    return messagesData?.pages?.flatMap(page => page.messages || []) || [];
  }, [messagesData]);

  const modActions = useMemo(() => {
    return modActionsData?.pages?.flatMap(page => page.actions || []) || [];
  }, [modActionsData]);

  const handleRefresh = async () => {
    await Promise.all([refetch(), refetchMessages(), refetchModActions()]);
  };

  const tabs = [
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

  if (error || !user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 p-4">
        <UserIcon className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-center">User not found</p>
        <button 
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-twitch-purple text-white rounded-lg"
        >
          Go back
        </button>
      </div>
    );
  }

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
            <h1 className="text-lg font-bold text-white">{user.display_name || user.username}</h1>
            <p className="text-sm text-gray-400">@{user.username}</p>
          </div>
          <div className="p-3 bg-twitch-purple/20 rounded-full">
            <UserIcon className="w-6 h-6 text-twitch-purple" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-twitch-dark rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-white">{formatNumber(user.total_messages)}</p>
            <p className="text-[10px] text-gray-400">Messages</p>
          </div>
          <div className="bg-twitch-dark rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-blue-400">{formatNumber(user.channels_count)}</p>
            <p className="text-[10px] text-gray-400">Channels</p>
          </div>
          <div className="bg-twitch-dark rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-red-400">{formatNumber(user.ban_count)}</p>
            <p className="text-[10px] text-gray-400">Bans</p>
          </div>
          <div className="bg-twitch-dark rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-yellow-400">{formatNumber(user.timeout_count)}</p>
            <p className="text-[10px] text-gray-400">Timeouts</p>
          </div>
        </div>

        {/* Timestamps */}
        <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            First: {formatRelative(user.first_seen)}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Last: {formatRelative(user.last_seen)}
          </span>
        </div>

        {/* Active channels */}
        {user.active_channels && user.active_channels.length > 0 && (
          <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
            {user.active_channels.map(channel => (
              <button
                key={channel.name}
                onClick={() => navigate(`/channel/${channel.name}`)}
                className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-twitch-dark rounded-full text-sm"
              >
                <Hash className="w-3 h-3 text-twitch-purple" />
                <span className="text-gray-300">{channel.name}</span>
                <span className="text-gray-500">{formatNumber(channel.message_count)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <MobileScrollableTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Content */}
      <PullToRefresh onRefresh={handleRefresh} className="flex-1 overflow-y-auto">
        {activeTab === 'messages' ? (
          messagesLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-center">No messages found</p>
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
                  showChannel={true}
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
              <p className="text-center">No mod actions found</p>
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
                  showChannel={true}
                />
              ))}
            </InfiniteScroll>
          )
        )}
      </PullToRefresh>
    </div>
  );
}

export default MobileUser;
