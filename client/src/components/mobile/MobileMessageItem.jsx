import { formatTime, getBadgeClass } from '../../utils/formatters';
import { Trash2, MoreVertical, Copy, User, Flag, ChevronRight } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import EmoteRenderer from '../chat/EmoteRenderer';
import { parseMessageWithEmotes } from '../../hooks/useEmotes';
import { useProfileCardStore } from '../../stores/profileCardStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useNavigate } from 'react-router-dom';

function MobileMessageItem({ message, showChannel = true, channelId = null, onLongPress }) {
  const navigate = useNavigate();
  const [showActions, setShowActions] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const longPressTimer = useRef(null);
  const actionsRef = useRef(null);
  
  const openCard = useProfileCardStore(state => state.openCard);
  
  // Get display settings
  const showTimestamps = useSettingsStore(state => state.showTimestamps);
  const timestampFormat = useSettingsStore(state => state.timestampFormat);
  const showBadges = useSettingsStore(state => state.showBadges);
  const showEmotes = useSettingsStore(state => state.showEmotes);
  const showDeletedMessages = useSettingsStore(state => state.showDeletedMessages);
  
  const badges = message.badges || [];
  
  // If message is deleted and user doesn't want to see deleted messages, return null
  if (message.is_deleted && !showDeletedMessages) {
    return null;
  }
  
  // Parse message for emotes
  const effectiveChannelId = channelId || message.channel_twitch_id || null;
  const messageParts = showEmotes 
    ? parseMessageWithEmotes(
        message.message_text,
        message.emotes || [],
        effectiveChannelId
      )
    : [{ type: 'text', text: message.message_text }];

  // Format timestamp based on user preference
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    if (timestampFormat === '24h') {
      return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  // Long press handling
  const handleTouchStart = () => {
    setIsPressed(true);
    longPressTimer.current = setTimeout(() => {
      setShowActions(true);
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500);
  };

  const handleTouchEnd = () => {
    setIsPressed(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleTouchMove = () => {
    setIsPressed(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  // Close actions sheet when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target)) {
        setShowActions(false);
      }
    };

    if (showActions) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showActions]);

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.message_text);
    setShowActions(false);
  };

  const handleViewUser = () => {
    navigate(`/user/${message.username}`);
    setShowActions(false);
  };

  const handleViewChannel = () => {
    if (message.channel_name) {
      navigate(`/channel/${message.channel_name}`);
    }
    setShowActions(false);
  };

  return (
    <>
      <div 
        className={`p-3 border-b border-gray-700/50 transition-colors ${
          message.is_deleted ? 'opacity-50 bg-red-900/10' : ''
        } ${isPressed ? 'bg-gray-800/80' : 'active:bg-gray-800/50'}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowActions(true);
        }}
      >
        {/* Header row */}
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          {showTimestamps && (
            <span className="text-xs text-gray-500">
              {formatTimestamp(message.timestamp)}
            </span>
          )}
          
          {showChannel && message.channel_name && (
            <button 
              onClick={handleViewChannel}
              className="text-xs text-twitch-purple font-medium"
            >
              #{message.channel_name}
            </button>
          )}

          {showBadges && badges.length > 0 && (
            <div className="flex gap-1">
              {badges.slice(0, 3).map((badge, idx) => (
                <span 
                  key={idx} 
                  className={`badge text-[10px] px-1 py-0.5 ${getBadgeClass(badge.type)}`}
                >
                  {badge.type}
                </span>
              ))}
            </div>
          )}

          <button
            onClick={handleViewUser}
            className="font-semibold text-twitch-purple text-sm"
          >
            {message.user_display_name || message.username}
          </button>

          {message.is_deleted && (
            <span className="flex items-center text-xs text-red-400 ml-auto">
              <Trash2 className="w-3 h-3 mr-1" />
              Deleted
            </span>
          )}
        </div>

        {/* Message content */}
        <p className={`text-white text-sm leading-relaxed break-words ${
          message.is_deleted ? 'line-through text-gray-400' : ''
        }`}>
          <EmoteRenderer parts={messageParts} />
        </p>
      </div>

      {/* Action Sheet */}
      {showActions && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-50 bg-black/60"
            onClick={() => setShowActions(false)}
          />
          
          {/* Actions */}
          <div 
            ref={actionsRef}
            className="fixed bottom-0 left-0 right-0 z-50 bg-twitch-gray rounded-t-2xl safe-area-bottom animate-slide-up"
          >
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>

            {/* Message preview */}
            <div className="px-4 pb-3 border-b border-gray-700">
              <p className="text-sm text-gray-400 line-clamp-2">{message.message_text}</p>
              <p className="text-xs text-gray-500 mt-1">
                by {message.user_display_name || message.username}
                {message.channel_name && ` in #${message.channel_name}`}
              </p>
            </div>

            {/* Action buttons */}
            <div className="py-2">
              <button
                onClick={handleCopyMessage}
                className="w-full flex items-center gap-4 px-4 py-3 text-white active:bg-gray-700"
              >
                <Copy className="w-5 h-5 text-gray-400" />
                <span>Copy message</span>
              </button>

              <button
                onClick={handleViewUser}
                className="w-full flex items-center gap-4 px-4 py-3 text-white active:bg-gray-700"
              >
                <User className="w-5 h-5 text-gray-400" />
                <span>View user profile</span>
                <ChevronRight className="w-4 h-4 text-gray-500 ml-auto" />
              </button>

              {showChannel && message.channel_name && (
                <button
                  onClick={handleViewChannel}
                  className="w-full flex items-center gap-4 px-4 py-3 text-white active:bg-gray-700"
                >
                  <Flag className="w-5 h-5 text-gray-400" />
                  <span>View in #{message.channel_name}</span>
                  <ChevronRight className="w-4 h-4 text-gray-500 ml-auto" />
                </button>
              )}
            </div>

            {/* Cancel */}
            <div className="p-4 border-t border-gray-700">
              <button
                onClick={() => setShowActions(false)}
                className="w-full py-3 rounded-xl bg-gray-700 text-white font-medium active:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default MobileMessageItem;
