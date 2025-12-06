import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, MessageSquare, CornerDownRight, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import MessageItem from './MessageItem';
import api from '../../services/api';

/**
 * ThreadView component displays a conversation thread (parent message + replies)
 */
function ThreadView({ messageId, onClose, channelId = null }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const { data, isLoading, error } = useQuery({
    queryKey: ['thread', messageId],
    queryFn: async () => {
      const response = await api.get(`/messages/${messageId}/thread`);
      return response.data;
    },
    enabled: !!messageId,
  });

  if (!messageId) return null;

  return (
    <div className="bg-twitch-dark border border-gray-700 rounded-lg overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-4 h-4 text-twitch-purple" />
          <span className="font-medium text-white">
            Conversation Thread
          </span>
          {data && (
            <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded-full">
              {data.totalReplies} {data.totalReplies === 1 ? 'reply' : 'replies'}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
            title={isExpanded ? 'Collapse thread' : 'Expand thread'}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
              title="Close thread"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-twitch-purple" />
              <span className="ml-2 text-gray-400">Loading thread...</span>
            </div>
          ) : error ? (
            <div className="px-4 py-8 text-center text-red-400">
              <p>Failed to load thread</p>
              <p className="text-sm text-gray-500 mt-1">{error.message}</p>
            </div>
          ) : data ? (
            <div>
              {/* Parent message */}
              {data.parent && (
                <div className="border-l-2 border-twitch-purple bg-gray-800/30">
                  <MessageItem 
                    message={{
                      ...data.parent,
                      timestamp: data.parent.msg_timestamp || data.parent.timestamp,
                      user_display_name: data.parent.display_name,
                    }} 
                    showChannel={false}
                    channelId={channelId}
                  />
                </div>
              )}

              {/* Replies */}
              {data.replies && data.replies.length > 0 && (
                <div className="border-t border-gray-700">
                  {data.replies.map((reply) => (
                    <div 
                      key={reply.message_id || reply.id} 
                      className="flex items-start"
                    >
                      <div className="flex items-center pl-4 pt-4 text-gray-500">
                        <CornerDownRight className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <MessageItem 
                          message={{
                            ...reply,
                            timestamp: reply.msg_timestamp || reply.timestamp,
                            user_display_name: reply.display_name,
                          }} 
                          showChannel={false}
                          channelId={channelId}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* No replies message */}
              {(!data.replies || data.replies.length === 0) && (
                <div className="px-4 py-6 text-center text-gray-500">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No replies yet</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * Compact reply indicator to show on a message
 */
export function ReplyIndicator({ replyToUsername, replyToMessageId, onClick }) {
  if (!replyToUsername) return null;

  return (
    <button
      onClick={onClick}
      className="flex items-center space-x-1 text-xs text-gray-400 hover:text-twitch-purple transition-colors mb-1"
    >
      <CornerDownRight className="w-3 h-3" />
      <span>Replying to</span>
      <span className="text-twitch-purple hover:underline">@{replyToUsername}</span>
    </button>
  );
}

/**
 * Hook to manage thread view state
 */
export function useThreadView() {
  const [activeThread, setActiveThread] = useState(null);

  const openThread = (messageId) => {
    setActiveThread(messageId);
  };

  const closeThread = () => {
    setActiveThread(null);
  };

  return {
    activeThread,
    openThread,
    closeThread,
  };
}

export default ThreadView;
