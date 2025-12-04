import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDateTime, formatDuration, formatTime, formatRelative } from '../../utils/formatters';
import { usersApi } from '../../services/api';
import { useProfileCardStore } from '../../stores/profileCardStore';
import EmoteRenderer from '../chat/EmoteRenderer';
import { parseMessageWithEmotes } from '../../hooks/useEmotes';
import LoadingSpinner from '../common/LoadingSpinner';
import wsService from '../../services/websocket';
import { 
  Ban, 
  Clock, 
  User as UserIcon, 
  MessageSquare, 
  ChevronDown, 
  ChevronUp,
  ExternalLink,
  Hash,
  AlertTriangle
} from 'lucide-react';

function ModActionCard({ action, expanded: defaultExpanded = false }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [queryReady, setQueryReady] = useState(false);
  const queryClient = useQueryClient();
  const openProfileCard = useProfileCardStore(state => state.openCard);
  
  const targetUsername = action.target_username || action.targetUsername;
  const channelName = action.channel_name || action.channelName;
  const channelTwitchId = action.channel_twitch_id || action.channelTwitchId;
  const actionType = action.action_type || action.actionType;
  const duration = action.duration_seconds || action.durationSeconds;

  // Check if this is a recent mod action (within last 10 seconds) - memoize to prevent recalculation
  const isRecentAction = useMemo(() => {
    const actionAge = Date.now() - new Date(action.timestamp).getTime();
    return actionAge < 10000;
  }, [action.timestamp]);

  // Listen for messages_flushed events to refetch when target user's messages are saved
  useEffect(() => {
    if (!isRecentAction || queryReady) return;

    const handleMessagesFlushed = (data) => {
      const flushedUsernames = data.usernames || [];
      if (flushedUsernames.includes(targetUsername?.toLowerCase())) {
        // Our target user's messages were just flushed to DB
        queryClient.invalidateQueries({
          queryKey: ['user', targetUsername, 'messages'],
        });
        setQueryReady(true);
      }
    };

    const unsubscribe = wsService.on('messages_flushed', handleMessagesFlushed);
    
    // Fallback timeout in case flush event doesn't come (e.g., no new messages)
    const fallbackTimer = setTimeout(() => {
      if (!queryReady) {
        setQueryReady(true);
      }
    }, 6000); // Slightly longer than the 5s flush interval

    return () => {
      unsubscribe();
      clearTimeout(fallbackTimer);
    };
  }, [isRecentAction, queryReady, targetUsername, queryClient]);

  // For non-recent actions, enable queries immediately
  useEffect(() => {
    if (!isRecentAction) {
      setQueryReady(true);
    }
  }, [isRecentAction]);

  // Always fetch user's last message for compact view
  const { data: lastMessageData, isLoading: lastMessageLoading } = useQuery({
    queryKey: ['user', targetUsername, 'messages', { limit: 1, channel: channelName }],
    queryFn: () => usersApi.getMessages(targetUsername, { limit: 1, channel: channelName }).then(res => res.data),
    enabled: !!targetUsername && queryReady,
    staleTime: 0, // Always consider stale for mod action cards
  });

  // Fetch more messages when expanded
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['user', targetUsername, 'messages', { limit: 5, channel: channelName }],
    queryFn: () => usersApi.getMessages(targetUsername, { limit: 5, channel: channelName }).then(res => res.data),
    enabled: isExpanded && !!targetUsername && queryReady,
    staleTime: 0, // Always consider stale for mod action cards
  });

  // Fetch user info when expanded
  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ['user', targetUsername],
    queryFn: () => usersApi.getByUsername(targetUsername).then(res => res.data),
    enabled: isExpanded && !!targetUsername,
  });

  const lastMessage = lastMessageData?.messages?.[0];

  const messages = messagesData?.messages || [];
  const user = userData;

  const getActionIcon = () => {
    switch (actionType) {
      case 'ban':
        return <Ban className="w-5 h-5 text-red-500" />;
      case 'timeout':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
    }
  };

  const getActionColor = () => {
    switch (actionType) {
      case 'ban':
        return 'border-red-500/50 bg-red-500/10';
      case 'timeout':
        return 'border-yellow-500/50 bg-yellow-500/10';
      default:
        return 'border-orange-500/50 bg-orange-500/10';
    }
  };

  const getActionText = () => {
    switch (actionType) {
      case 'ban':
        return 'Permanently Banned';
      case 'timeout':
        return `Timed out for ${formatDuration(duration)}`;
      case 'clear':
        return 'Chat Cleared';
      case 'delete':
        return 'Message Deleted';
      default:
        return actionType;
    }
  };

  return (
    <div className={`rounded-lg border ${getActionColor()} overflow-hidden`}>
      {/* Header - Always visible */}
      <div 
        className="p-3 cursor-pointer hover:bg-gray-800/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            {getActionIcon()}
            <div className="flex-1 min-w-0">
              <div className="flex items-center flex-wrap gap-2 mb-1">
                <span className={`font-semibold ${
                  actionType === 'ban' ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {getActionText()}
                </span>
                <span className="text-twitch-purple text-sm">#{channelName}</span>
                <span className="text-xs text-gray-500">
                  {formatRelative(action.timestamp)}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openProfileCard(targetUsername);
                  }}
                  className="text-white font-medium hover:text-twitch-purple hover:underline"
                >
                  {action.target_display_name || targetUsername}
                </button>
                <span className="text-gray-500 text-sm">@{targetUsername}</span>
              </div>

              {action.reason && (
                <p className="text-sm text-gray-400 mt-1">
                  <span className="text-gray-500">Reason:</span> {action.reason}
                </p>
              )}

              {action.moderator_username && (
                <p className="text-xs text-gray-500 mt-1">
                  by <span className="text-green-400">{action.moderator_username}</span>
                </p>
              )}

              {/* Last Message - Always visible in compact view */}
              {!isExpanded && (
                <div className="mt-2 pt-2 border-t border-gray-700/50">
                  {(!queryReady || lastMessageLoading) ? (
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <MessageSquare className="w-3 h-3" />
                      <span>Loading last message...</span>
                    </div>
                  ) : lastMessage ? (
                    <div className="text-xs">
                      <div className="flex items-center space-x-1 text-gray-500 mb-0.5">
                        <MessageSquare className="w-3 h-3" />
                        <span>Last message ({formatRelative(lastMessage.timestamp)}):</span>
                      </div>
                      <p className="text-gray-300 line-clamp-2 break-words">
                        <EmoteRenderer 
                          parts={parseMessageWithEmotes(
                            lastMessage.message_text, 
                            lastMessage.emotes || [], 
                            lastMessage.channel_twitch_id || channelTwitchId
                          )} 
                        />
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <MessageSquare className="w-3 h-3" />
                      <span>No messages found in #{channelName}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <button className="p-1 text-gray-400 hover:text-white">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-700 bg-twitch-dark/50">
          {/* User Stats */}
          {userLoading ? (
            <div className="p-4 flex justify-center">
              <LoadingSpinner size="sm" />
            </div>
          ) : user ? (
            <div className="p-3 border-b border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 font-medium">User Profile</span>
                <Link
                  to={`/user/${targetUsername}`}
                  className="text-xs text-twitch-purple hover:underline flex items-center space-x-1"
                >
                  <span>Full Profile</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-gray-800 rounded p-2 text-center">
                  <MessageSquare className="w-3.5 h-3.5 text-twitch-purple mx-auto mb-1" />
                  <span className="text-xs text-white font-medium block">{user.total_messages || 0}</span>
                  <span className="text-xs text-gray-500">Messages</span>
                </div>
                <div className="bg-gray-800 rounded p-2 text-center">
                  <Hash className="w-3.5 h-3.5 text-blue-400 mx-auto mb-1" />
                  <span className="text-xs text-white font-medium block">{user.channels_count || 0}</span>
                  <span className="text-xs text-gray-500">Channels</span>
                </div>
                <div className="bg-gray-800 rounded p-2 text-center">
                  <Ban className="w-3.5 h-3.5 text-red-400 mx-auto mb-1" />
                  <span className="text-xs text-white font-medium block">{user.ban_count || 0}</span>
                  <span className="text-xs text-gray-500">Bans</span>
                </div>
                <div className="bg-gray-800 rounded p-2 text-center">
                  <Clock className="w-3.5 h-3.5 text-yellow-400 mx-auto mb-1" />
                  <span className="text-xs text-white font-medium block">{user.timeout_count || 0}</span>
                  <span className="text-xs text-gray-500">Timeouts</span>
                </div>
              </div>
              {user.first_seen && (
                <div className="mt-2 text-xs text-gray-500">
                  First seen: {formatRelative(user.first_seen)} • Last seen: {formatRelative(user.last_seen)}
                </div>
              )}
            </div>
          ) : null}

          {/* Recent Messages */}
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 font-medium">
                Recent Messages in #{channelName}
              </span>
            </div>
            
            {messagesLoading ? (
              <div className="flex justify-center py-4">
                <LoadingSpinner size="sm" />
              </div>
            ) : messages.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-4">
                No recent messages found in this channel
              </p>
            ) : (
              <div className="space-y-2">
                {messages.map((msg, idx) => (
                  <div 
                    key={msg.id || idx} 
                    className="bg-gray-800 rounded p-2"
                  >
                    <div className="flex items-center space-x-2 text-xs text-gray-500 mb-1">
                      <span>{formatTime(msg.timestamp)}</span>
                      <span>{formatRelative(msg.timestamp)}</span>
                    </div>
                    <p className="text-sm text-white break-words">
                      <EmoteRenderer 
                        parts={parseMessageWithEmotes(
                          msg.message_text, 
                          msg.emotes || [], 
                          msg.channel_twitch_id
                        )} 
                      />
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Metadata */}
          <div className="p-3 border-t border-gray-700 text-xs text-gray-500">
            <div className="flex items-center justify-between">
              <span>Action ID: {action.id || 'N/A'}</span>
              <span>{formatDateTime(action.timestamp)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ModActionCard;
