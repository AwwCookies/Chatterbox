import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  X, 
  MessageSquare, 
  CornerDownRight, 
  Loader2, 
  Pin, 
  PinOff, 
  GripHorizontal,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import MessageItem from './MessageItem';
import api from '../../services/api';
import { useWebSocketStore } from '../../hooks/useWebSocket';

function ThreadCard({ 
  id,
  messageId, 
  channelId,
  position,
  isPinned,
  zIndex,
  onClose, 
  onUpdatePosition,
  onTogglePin,
  onBringToFront 
}) {
  const cardRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [liveReplies, setLiveReplies] = useState([]);
  const [showNewIndicator, setShowNewIndicator] = useState(false);
  const queryClient = useQueryClient();

  // Fetch thread data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['thread', messageId],
    queryFn: async () => {
      const response = await api.get(`/messages/${messageId}/thread`);
      return response.data;
    },
    enabled: !!messageId,
    refetchInterval: isPinned ? 15000 : false, // Auto-refresh every 15s if pinned
  });

  // Get the root message ID for tracking replies
  const rootMessageId = useMemo(() => {
    if (data?.parent) {
      return data.parent.message_id;
    }
    return messageId;
  }, [data, messageId]);

  // Subscribe to live messages that are replies to this thread
  useEffect(() => {
    const unsubscribe = useWebSocketStore.subscribe((state) => {
      // Find messages that are replies to the root message
      const newReplies = state.messages.filter(
        msg => msg.reply_to_message_id === rootMessageId || 
               msg.replyToMessageId === rootMessageId
      );
      
      if (newReplies.length > 0) {
        setLiveReplies(prev => {
          const newOnes = newReplies.filter(nr => 
            !prev.some(pr => (pr.messageId || pr.message_id) === (nr.messageId || nr.message_id))
          );
          if (newOnes.length > 0) {
            setShowNewIndicator(true);
            setTimeout(() => setShowNewIndicator(false), 3000);
          }
          return [...newOnes, ...prev];
        });
      }
    });

    return unsubscribe;
  }, [rootMessageId]);

  // Combine live replies with fetched replies
  const allReplies = useMemo(() => {
    const fetchedReplies = data?.replies || [];
    const normalizedLive = liveReplies.map(r => ({
      ...r,
      id: r.id || r.messageId,
      message_id: r.message_id || r.messageId,
      message_text: r.message_text || r.messageText,
      timestamp: r.timestamp || new Date().toISOString(),
      username: r.username,
      display_name: r.displayName || r.user_display_name || r.display_name,
      user_display_name: r.displayName || r.user_display_name || r.display_name,
      reply_to_message_id: r.reply_to_message_id || r.replyToMessageId,
      reply_to_username: r.reply_to_username || r.replyToUsername,
      badges: r.badges || [],
      emotes: r.emotes || [],
      isLive: true,
    }));
    
    // Filter out duplicates
    const combined = [
      ...normalizedLive,
      ...fetchedReplies.filter(fr => 
        !normalizedLive.some(lr => lr.message_id === fr.message_id)
      )
    ];
    
    // Sort by timestamp
    return combined.sort((a, b) => 
      new Date(a.msg_timestamp || a.timestamp) - new Date(b.msg_timestamp || b.timestamp)
    );
  }, [data?.replies, liveReplies]);

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
    
    const newX = Math.max(0, Math.min(window.innerWidth - 448, e.clientX - dragOffset.x));
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
    setLiveReplies([]);
    refetch();
  };

  const totalReplies = allReplies.length;

  return (
    <div 
      ref={cardRef}
      className={`fixed w-[448px] max-h-[70vh] bg-twitch-dark border rounded-lg shadow-2xl flex flex-col select-none ${
        isPinned ? 'border-twitch-purple border-2' : 'border-gray-600'
      } ${isDragging ? 'cursor-grabbing' : ''}`}
      style={{ 
        top: position.y, 
        left: position.x, 
        zIndex,
      }}
      onMouseDown={() => onBringToFront()}
    >
      {/* Header - Draggable */}
      <div 
        className={`flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700 rounded-t-lg ${
          !isDragging ? 'cursor-grab' : 'cursor-grabbing'
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          <GripHorizontal className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <div className="p-1.5 bg-twitch-purple/20 rounded">
            <MessageSquare className="w-4 h-4 text-twitch-purple" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-white text-sm truncate">
                Thread
              </span>
              {showNewIndicator && (
                <span className="flex items-center text-xs text-green-400 animate-pulse">
                  <Sparkles className="w-3 h-3 mr-1" />
                  New
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400">
              {totalReplies} {totalReplies === 1 ? 'reply' : 'replies'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-1">
          <button
            onClick={handleRefresh}
            className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
            title="Refresh thread"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onTogglePin}
            className={`p-1.5 hover:bg-gray-700 rounded transition-colors ${
              isPinned ? 'text-twitch-purple' : 'text-gray-400 hover:text-white'
            }`}
            title={isPinned ? 'Unpin thread' : 'Pin thread (auto-refresh)'}
          >
            {isPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && !data ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-twitch-purple mb-2" />
            <span className="text-sm text-gray-400">Loading thread...</span>
          </div>
        ) : error ? (
          <div className="px-4 py-12 text-center">
            <X className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-400 text-sm">Failed to load thread</p>
            <p className="text-xs text-gray-500 mt-1">{error.message}</p>
          </div>
        ) : data ? (
          <div className="divide-y divide-gray-700/50">
            {/* Parent message */}
            {data.parent && (
              <div className="bg-twitch-purple/5 border-l-2 border-twitch-purple">
                <MessageItem 
                  message={{
                    ...data.parent,
                    timestamp: data.parent.msg_timestamp || data.parent.timestamp,
                    user_display_name: data.parent.display_name,
                  }} 
                  showChannel={true}
                  channelId={channelId}
                />
              </div>
            )}

            {/* Replies */}
            {allReplies.length > 0 ? (
              <div>
                <div className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide bg-gray-800/50">
                  Replies
                </div>
                {allReplies.map((reply, index) => (
                  <div 
                    key={reply.message_id || reply.id || index} 
                    className={`flex items-start transition-colors ${
                      reply.isLive ? 'bg-green-500/5 animate-pulse-once' : 'hover:bg-gray-800/30'
                    }`}
                  >
                    <div className="flex items-center pl-3 pt-4 text-gray-600">
                      <CornerDownRight className="w-3 h-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <MessageItem 
                        message={{
                          ...reply,
                          timestamp: reply.msg_timestamp || reply.timestamp,
                          user_display_name: reply.display_name || reply.user_display_name,
                        }} 
                        showChannel={false}
                        channelId={channelId}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                <p className="text-sm text-gray-500">No replies yet</p>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Footer */}
      {isPinned && (
        <div className="px-3 py-2 bg-gray-800/50 border-t border-gray-700 text-center">
          <span className="text-xs text-twitch-purple">
            📌 Pinned - Auto-refreshing every 15s
          </span>
        </div>
      )}
    </div>
  );
}

export default ThreadCard;
