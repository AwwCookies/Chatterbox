import { useParams, Link } from 'react-router-dom';
import { useUser, useUserMessages, useUserModActions } from '../hooks/useUsers';
import { formatDateTime, formatNumber, formatRelative } from '../utils/formatters';
import LoadingSpinner from '../components/common/LoadingSpinner';
import MessageList from '../components/chat/MessageList';
import ModActionList from '../components/moderation/ModActionList';
import { User as UserIcon, MessageSquare, Shield, Calendar, Hash, AlertTriangle } from 'lucide-react';

function User() {
  const { username } = useParams();
  const { data: user, isLoading, error } = useUser(username);
  const { data: messagesData, isLoading: messagesLoading } = useUserMessages(username, { limit: 20 });
  const { data: modActionsData, isLoading: modActionsLoading } = useUserModActions(username, { limit: 20 });

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

      {/* Messages & Mod Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-twitch-gray rounded-lg border border-gray-700">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center">
              <MessageSquare className="w-5 h-5 mr-2 text-twitch-purple" />
              Recent Messages
            </h2>
            <Link 
              to={`/messages?user=${username}`}
              className="text-sm text-twitch-purple hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <MessageList 
              messages={messagesData?.messages || []}
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
            </h2>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <ModActionList 
              actions={modActionsData?.actions || []}
              isLoading={modActionsLoading}
              emptyMessage="No mod actions found"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default User;
