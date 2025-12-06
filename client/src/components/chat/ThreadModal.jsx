import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X, MessageSquare, CornerDownRight, Loader2, ExternalLink } from 'lucide-react';
import MessageItem from './MessageItem';
import api from '../../services/api';

/**
 * ThreadModal - A popup modal for viewing conversation threads
 */
function ThreadModal({ messageId, onClose, channelId = null }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['thread', messageId],
    queryFn: async () => {
      const response = await api.get(`/messages/${messageId}/thread`);
      return response.data;
    },
    enabled: !!messageId,
  });

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  if (!messageId) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      
      {/* Modal */}
      <div 
        className="relative bg-twitch-dark border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gray-800/80 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-twitch-purple/20 rounded-lg">
              <MessageSquare className="w-5 h-5 text-twitch-purple" />
            </div>
            <div>
              <h2 className="font-semibold text-white text-lg">
                Conversation Thread
              </h2>
              {data && (
                <p className="text-sm text-gray-400">
                  {data.totalReplies} {data.totalReplies === 1 ? 'reply' : 'replies'}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-twitch-purple mb-3" />
              <span className="text-gray-400">Loading thread...</span>
            </div>
          ) : error ? (
            <div className="px-6 py-16 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-red-400 font-medium">Failed to load thread</p>
              <p className="text-sm text-gray-500 mt-2">{error.message}</p>
            </div>
          ) : data ? (
            <div className="divide-y divide-gray-700/50">
              {/* Parent message */}
              {data.parent && (
                <div className="bg-twitch-purple/5 border-l-4 border-twitch-purple">
                  <div className="px-2">
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
                </div>
              )}

              {/* Replies */}
              {data.replies && data.replies.length > 0 ? (
                <div className="bg-gray-800/20">
                  <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-700/50">
                    Replies
                  </div>
                  {data.replies.map((reply, index) => (
                    <div 
                      key={reply.message_id || reply.id} 
                      className={`flex items-start hover:bg-gray-800/30 transition-colors ${
                        index < data.replies.length - 1 ? 'border-b border-gray-700/30' : ''
                      }`}
                    >
                      <div className="flex items-center pl-4 pt-5 text-gray-600">
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
              ) : (
                <div className="px-6 py-12 text-center">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                  <p className="text-gray-500">No replies to this message yet</p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {data?.parent && (
          <div className="px-5 py-3 bg-gray-800/50 border-t border-gray-700 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Thread ID: {data.parent.message_id?.slice(0, 8)}...
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default ThreadModal;
