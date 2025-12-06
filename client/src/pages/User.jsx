import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { usersApi } from '../services/api';
import { useUser } from '../hooks/useUsers';
import { formatDateTime, formatNumber, formatRelative } from '../utils/formatters';
import LoadingSpinner from '../components/common/LoadingSpinner';
import MessageList from '../components/chat/MessageList';
import ModActionList from '../components/moderation/ModActionList';
import InfiniteScroll from '../components/common/InfiniteScroll';
import UserAnalyticsTab from '../components/user/UserAnalyticsTab';
import { User as UserIcon, MessageSquare, Shield, Calendar, Hash, AlertTriangle, BarChart3 } from 'lucide-react';
import { MobileUser } from './mobile';

function User({ isMobile }) {
  // Render mobile version if on mobile
  if (isMobile) {
    return <MobileUser />;
  }

  const { username } = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  const { data: user, isLoading, error } = useUser(username);
  
  // Infinite query for messages
  const {
    data: messagesData,
    isLoading: messagesLoading,
    fetchNextPage: fetchNextMessages,
    hasNextPage: hasNextMessages,
    isFetchingNextPage: isFetchingNextMessages,
  } = useInfiniteQuery({
    queryKey: ['user', username, 'messages', 'infinite'],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await usersApi.getMessages(username, { limit: 20, offset: pageParam });
      return { ...response.data, _offset: pageParam, _limit: 20 };
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
  } = useInfiniteQuery({
    queryKey: ['user', username, 'mod-actions', 'infinite'],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await usersApi.getModActions(username, { limit: 20, offset: pageParam });
      return { ...response.data, _offset: pageParam, _limit: 20 };
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400">User not found</p>
        <Link to="/messages" className="text-twitch-purple hover:underline mt-2 block">
          Back to messages
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Header */}
      <div className="bg-twitch-gray rounded-lg p-6 border border-gray-700">
        <div className="flex items-start space-x-4">
          <div className="p-4 bg-twitch-purple rounded-full">
            <UserIcon className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">
              {user.display_name || user.username}
            </h1>
            <p className="text-gray-400">@{user.username}</p>
            
            <div className="flex flex-wrap gap-4 mt-4">
              <div className="flex items-center space-x-2 text-sm text-gray-300">
                <Calendar className="w-4 h-4" />
                <span>First seen: {formatDateTime(user.first_seen)}</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-300">
                <Calendar className="w-4 h-4" />
                <span>Last seen: {formatRelative(user.last_seen)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-3">
            <MessageSquare className="w-5 h-5 text-twitch-purple" />
            <div>
              <p className="text-xl font-bold text-white">{formatNumber(user.total_messages)}</p>
              <p className="text-xs text-gray-400">Total Messages</p>
            </div>
          </div>
        </div>

        <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-3">
            <Hash className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-xl font-bold text-white">{formatNumber(user.channels_count)}</p>
              <p className="text-xs text-gray-400">Channels</p>
            </div>
          </div>
        </div>

        <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-3">
            <Shield className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-xl font-bold text-white">{formatNumber(user.ban_count)}</p>
              <p className="text-xs text-gray-400">Bans</p>
            </div>
          </div>
        </div>

        <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <div>
              <p className="text-xl font-bold text-white">{formatNumber(user.timeout_count)}</p>
              <p className="text-xs text-gray-400">Timeouts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Channels */}
      {user.active_channels && user.active_channels.length > 0 && (
        <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Most Active Channels</h3>
          <div className="flex flex-wrap gap-2">
            {user.active_channels.map(channel => (
              <div 
                key={channel.name}
                className="px-3 py-1 bg-gray-700 rounded-full text-sm"
              >
                <span className="text-twitch-purple">#{channel.name}</span>
                <span className="text-gray-400 ml-2">
                  {formatNumber(channel.message_count)} msgs
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-700">
        <nav className="flex space-x-4">
          {[
            { id: 'overview', label: 'Overview', icon: UserIcon },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            { id: 'messages', label: 'Messages', icon: MessageSquare },
            { id: 'moderation', label: 'Mod Actions', icon: Shield },
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
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-twitch-gray rounded-lg border border-gray-700">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center">
                <MessageSquare className="w-5 h-5 mr-2 text-twitch-purple" />
                Recent Messages
                {messagesData?.pages?.[0]?.total > 0 && (
                  <span className="text-sm text-gray-400 font-normal ml-2">
                    ({formatNumber(messagesData.pages[0].total)})
                  </span>
                )}
              </h2>
              <button 
                onClick={() => setActiveTab('messages')}
                className="text-sm text-twitch-purple hover:underline"
              >
                View all
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <MessageList 
                messages={messages.slice(0, 10)}
                isLoading={messagesLoading}
                emptyMessage="No messages found"
              />
            </div>
          </div>

          <div className="bg-twitch-gray rounded-lg border border-gray-700">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center">
                <Shield className="w-5 h-5 mr-2 text-red-400" />
                Mod Actions
                {modActionsData?.pages?.[0]?.total > 0 && (
                  <span className="text-sm text-gray-400 font-normal ml-2">
                    ({formatNumber(modActionsData.pages[0].total)})
                  </span>
                )}
              </h2>
              <button 
                onClick={() => setActiveTab('moderation')}
                className="text-sm text-twitch-purple hover:underline"
              >
                View all
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <ModActionList 
                actions={modActions.slice(0, 10)}
                isLoading={modActionsLoading}
                emptyMessage="No mod actions found"
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <UserAnalyticsTab username={username} />
      )}

      {activeTab === 'messages' && (
        <div className="bg-twitch-gray rounded-lg border border-gray-700">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white flex items-center">
              <MessageSquare className="w-5 h-5 mr-2 text-twitch-purple" />
              All Messages
              {messagesData?.pages?.[0]?.total > 0 && (
                <span className="text-sm text-gray-400 font-normal ml-2">
                  ({formatNumber(messagesData.pages[0].total)})
                </span>
              )}
            </h2>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            <InfiniteScroll
              hasNextPage={hasNextMessages}
              fetchNextPage={fetchNextMessages}
              isFetchingNextPage={isFetchingNextMessages}
              loadingText="Loading messages..."
              className="p-0"
            >
              <MessageList 
                messages={messages}
                isLoading={messagesLoading}
                emptyMessage="No messages found"
              />
            </InfiniteScroll>
          </div>
        </div>
      )}

      {activeTab === 'moderation' && (
        <div className="bg-twitch-gray rounded-lg border border-gray-700">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white flex items-center">
              <Shield className="w-5 h-5 mr-2 text-red-400" />
              All Mod Actions
              {modActionsData?.pages?.[0]?.total > 0 && (
                <span className="text-sm text-gray-400 font-normal ml-2">
                  ({formatNumber(modActionsData.pages[0].total)})
                </span>
              )}
            </h2>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            <InfiniteScroll
              hasNextPage={hasNextModActions}
              fetchNextPage={fetchNextModActions}
              isFetchingNextPage={isFetchingNextModActions}
              loadingText="Loading mod actions..."
              className="p-0"
            >
              <ModActionList 
                actions={modActions}
                isLoading={modActionsLoading}
                emptyMessage="No mod actions found"
              />
            </InfiniteScroll>
          </div>
        </div>
      )}
    </div>
  );
}

export default User;
