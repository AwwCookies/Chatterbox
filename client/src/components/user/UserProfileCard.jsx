import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../services/api';
import { formatNumber, formatRelative, formatTime } from '../../utils/formatters';
import LoadingSpinner from '../common/LoadingSpinner';
import EmoteRenderer from '../chat/EmoteRenderer';
import { parseMessageWithEmotes } from '../../hooks/useEmotes';
import { useWebSocketStore } from '../../hooks/useWebSocket';
import { 
  User as UserIcon, 
  MessageSquare, 
  Shield, 
  Calendar, 
  Hash,
  AlertTriangle,
  X,
  ExternalLink,
  Clock,
  Ban,
  Pin,
  PinOff,
  GripHorizontal,
  RefreshCw,
  ChevronDown
} from 'lucide-react';

function UserProfileCard({ 
  id,
  username, 
  position,
  isPinned,
  zIndex,
  onClose, 
  onUpdatePosition,
  onTogglePin,
  onBringToFront 
}) {
  const cardRef = useRef(null);
  const headerRef = useRef(null);
  const [activeTab, setActiveTab] = useState('messages');
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [liveMessages, setLiveMessages] = useState([]);
  const queryClient = useQueryClient();

  // Fetch user data with auto-refresh
  const { data: user, isLoading, refetch: refetchUser } = useQuery({
    queryKey: ['user', username],
    queryFn: () => usersApi.getByUsername(username).then(res => res.data),
    enabled: !!username,
    refetchInterval: isPinned ? 30000 : false, // Auto-refresh every 30s if pinned
  });

  // Infinite query for messages
  const {
    data: messagesData,
    isLoading: messagesLoading,
    fetchNextPage: fetchNextMessages,
    hasNextPage: hasNextMessages,
    isFetchingNextPage: isFetchingNextMessages,
    refetch: refetchMessages,
  } = useInfiniteQuery({
    queryKey: ['user', username, 'messages', 'infinite', 'card'],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await usersApi.getMessages(username, { limit: 15, offset: pageParam });
      return { ...response.data, _offset: pageParam, _limit: 15 };
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.hasMore) {
        return lastPage._offset + lastPage._limit;
      }
      return undefined;
    },
    initialPageParam: 0,
    enabled: !!username,
    refetchInterval: isPinned ? 10000 : false, // Auto-refresh every 10s if pinned
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
    queryKey: ['user', username, 'mod-actions', 'infinite', 'card'],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await usersApi.getModActions(username, { limit: 15, offset: pageParam });
      return { ...response.data, _offset: pageParam, _limit: 15 };
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.hasMore) {
        return lastPage._offset + lastPage._limit;
      }
      return undefined;
    },
    initialPageParam: 0,
    enabled: !!username,
    refetchInterval: isPinned ? 10000 : false,
  });

  // Flatten messages and mod actions
  const messages = useMemo(() => {
    return messagesData?.pages?.flatMap(page => page.messages || []) || [];
  }, [messagesData]);

  const modActions = useMemo(() => {
    return modActionsData?.pages?.flatMap(page => page.actions || []) || [];
  }, [modActionsData]);

  // Subscribe to live messages for this user
  useEffect(() => {
    const unsubscribe = useWebSocketStore.subscribe((state) => {
      const newMessages = state.messages.filter(
        msg => msg.username?.toLowerCase() === username.toLowerCase()
      );
      if (newMessages.length > 0) {
        setLiveMessages(prev => {
          const combined = [...newMessages.filter(nm => 
            !prev.some(pm => pm.messageId === nm.messageId)
          ), ...prev].slice(0, 5);
          return combined;
        });
      }
    });

    return unsubscribe;
  }, [username]);

  // Dragging handlers
  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('button') || e.target.closest('a')) return;
    
    onBringToFront();
    setIsDragging(true);
    const rect = cardRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, [onBringToFront]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    
    const newX = Math.max(0, Math.min(window.innerWidth - 384, e.clientX - dragOffset.x));
    const newY = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.y));
    
    onUpdatePosition({ x: newX, y: newY });
  }, [isDragging, dragOffset, onUpdatePosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleRefresh = () => {
    refetchUser();
    refetchMessages();
    refetchModActions();
  };

  // Combine live messages with fetched messages for display
  const displayMessages = activeTab === 'messages' ? [
    ...liveMessages.map(m => ({
      ...m,
      message_text: m.messageText || m.message_text,
      channel_name: m.channelName || m.channel_name,
      channel_twitch_id: m.channelTwitchId || m.channel_twitch_id,
      isLive: true,
    })),
    ...messages.filter(m => !liveMessages.some(lm => lm.messageId === m.message_id)),
  ].slice(0, 15) : messages;

  return (
    <div 
      ref={cardRef}
      className={`fixed w-96 max-h-[70vh] bg-twitch-gray border rounded-lg shadow-2xl flex flex-col select-none ${
        isPinned ? 'border-twitch-purple' : 'border-gray-600'
      } ${isDragging ? 'cursor-grabbing' : ''}`}
      style={{ 
        top: position.y, 
        left: position.x, 
        zIndex,
      }}
      onMouseDown={() => onBringToFront()}
    >
      {/* Draggable Header */}
      <div 
        ref={headerRef}
        className={`flex items-center justify-between p-2 border-b border-gray-700 shrink-0 ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center space-x-2">
          <GripHorizontal className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-400">
            {user?.display_name || username}
          </span>
          {liveMessages.length > 0 && (
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-green-400">Live</span>
            </span>
          )}
        </div>
        <div className="flex items-center space-x-1">
          <button 
            onClick={handleRefresh}
            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={onTogglePin}
            className={`p-1 hover:bg-gray-700 rounded ${isPinned ? 'text-twitch-purple' : 'text-gray-400 hover:text-white'}`}
            title={isPinned ? 'Unpin' : 'Pin'}
          >
            {isPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
          </button>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : !user ? (
          <div className="text-center py-4 text-gray-400">
            User not found
          </div>
        ) : (
          <div className="p-3">
            {/* User Info */}
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 bg-twitch-purple rounded-full">
                <UserIcon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white truncate">
                  {user.display_name || user.username}
                </h3>
                <p className="text-xs text-gray-400">@{user.username}</p>
              </div>
              <Link
                to={`/user/${username}`}
                className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white shrink-0"
                title="View full profile"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              <div className="bg-twitch-dark rounded p-1.5 text-center">
                <MessageSquare className="w-3.5 h-3.5 text-twitch-purple mx-auto" />
                <span className="text-xs text-white font-medium block">
                  {formatNumber(user.total_messages || 0)}
                </span>
              </div>
              <div className="bg-twitch-dark rounded p-1.5 text-center">
                <Hash className="w-3.5 h-3.5 text-blue-400 mx-auto" />
                <span className="text-xs text-white font-medium block">
                  {formatNumber(user.channels_count || 0)}
                </span>
              </div>
              <div className="bg-twitch-dark rounded p-1.5 text-center">
                <Shield className="w-3.5 h-3.5 text-red-400 mx-auto" />
                <span className="text-xs text-white font-medium block">
                  {formatNumber(user.ban_count || 0)}
                </span>
              </div>
              <div className="bg-twitch-dark rounded p-1.5 text-center">
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 mx-auto" />
                <span className="text-xs text-white font-medium block">
                  {formatNumber(user.timeout_count || 0)}
                </span>
              </div>
            </div>

            {/* Timestamps */}
            <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
              {user.first_seen && (
                <span>First: {formatRelative(user.first_seen)}</span>
              )}
              {user.last_seen && (
                <span>Last: {formatRelative(user.last_seen)}</span>
              )}
            </div>

            {/* Active Channels */}
            {user.active_channels && user.active_channels.length > 0 && (
              <div className="mb-3">
                <div className="flex flex-wrap gap-1">
                  {user.active_channels.slice(0, 4).map(channel => (
                    <span 
                      key={channel.name}
                      className="px-1.5 py-0.5 bg-gray-700 rounded text-xs"
                    >
                      <span className="text-twitch-purple">#{channel.name}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-gray-700 mb-2">
              <button
                onClick={() => setActiveTab('messages')}
                className={`flex-1 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === 'messages'
                    ? 'border-twitch-purple text-twitch-purple'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                Messages {liveMessages.length > 0 && `(${liveMessages.length} new)`}
              </button>
              <button
                onClick={() => setActiveTab('modactions')}
                className={`flex-1 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === 'modactions'
                    ? 'border-twitch-purple text-twitch-purple'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                Mod Actions
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'messages' && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {messagesLoading && messages.length === 0 ? (
                  <div className="flex justify-center py-4">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : displayMessages.length === 0 ? (
                  <p className="text-center text-gray-400 text-xs py-4">No messages</p>
                ) : (
                  <>
                    {displayMessages.map((msg, idx) => (
                      <div 
                        key={msg.id || msg.messageId || idx} 
                        className={`rounded p-1.5 text-xs ${
                          msg.isLive ? 'bg-green-900/30 border border-green-700/50' : 'bg-twitch-dark'
                        }`}
                      >
                        <div className="flex items-center space-x-1.5 text-gray-400 mb-0.5">
                          <span>{formatTime(msg.timestamp)}</span>
                          <span className="text-twitch-purple">#{msg.channel_name}</span>
                          {msg.isLive && <span className="text-green-400">• Live</span>}
                        </div>
                        <p className="text-white break-words text-xs">
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
                    {hasNextMessages && (
                      <button
                        onClick={() => fetchNextMessages()}
                        disabled={isFetchingNextMessages}
                        className="w-full py-1.5 text-xs text-twitch-purple hover:text-white hover:bg-gray-700 rounded flex items-center justify-center gap-1"
                      >
                        {isFetchingNextMessages ? (
                          <LoadingSpinner size="xs" />
                        ) : (
                          <>
                            <ChevronDown className="w-3 h-3" />
                            Load more
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'modactions' && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {modActionsLoading && modActions.length === 0 ? (
                  <div className="flex justify-center py-4">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : modActions.length === 0 ? (
                  <p className="text-center text-gray-400 text-xs py-4">No mod actions</p>
                ) : (
                  <>
                    {modActions.map((action, idx) => (
                      <div key={action.id || idx} className="bg-twitch-dark rounded p-1.5 text-xs">
                        <div className="flex items-center space-x-1.5 mb-0.5">
                          {action.action_type === 'ban' ? (
                            <Ban className="w-3 h-3 text-red-400" />
                          ) : (
                            <Clock className="w-3 h-3 text-yellow-400" />
                          )}
                          <span className={`font-medium ${
                            action.action_type === 'ban' ? 'text-red-400' : 'text-yellow-400'
                          }`}>
                            {action.action_type === 'ban' ? 'Ban' : `${action.duration}s`}
                          </span>
                          <span className="text-twitch-purple">#{action.channel_name}</span>
                        </div>
                        <div className="text-gray-400">
                          {formatRelative(action.timestamp)}
                          {action.reason && <span className="ml-1">• {action.reason}</span>}
                        </div>
                      </div>
                    ))}
                    {hasNextModActions && (
                      <button
                        onClick={() => fetchNextModActions()}
                        disabled={isFetchingNextModActions}
                        className="w-full py-1.5 text-xs text-twitch-purple hover:text-white hover:bg-gray-700 rounded flex items-center justify-center gap-1"
                      >
                        {isFetchingNextModActions ? (
                          <LoadingSpinner size="xs" />
                        ) : (
                          <>
                            <ChevronDown className="w-3 h-3" />
                            Load more
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default UserProfileCard;
