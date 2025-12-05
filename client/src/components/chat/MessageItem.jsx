import { formatTime, getBadgeClass } from '../../utils/formatters';
import { Trash2 } from 'lucide-react';
import EmoteRenderer from './EmoteRenderer';
import LinkPreview from './LinkPreview';
import { parseMessageWithEmotes } from '../../hooks/useEmotes';
import { useProfileCardStore } from '../../stores/profileCardStore';
import { useSettingsStore } from '../../stores/settingsStore';

function MessageItem({ message, showChannel = true, channelId = null }) {
  const openCard = useProfileCardStore(state => state.openCard);
  
  // Get display settings
  const showTimestamps = useSettingsStore(state => state.showTimestamps);
  const timestampFormat = useSettingsStore(state => state.timestampFormat);
  const showBadges = useSettingsStore(state => state.showBadges);
  const showEmotes = useSettingsStore(state => state.showEmotes);
  const showDeletedMessages = useSettingsStore(state => state.showDeletedMessages);
  const highlightMentions = useSettingsStore(state => state.highlightMentions);
  
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

  const handleUsernameClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openCard(message.username);
  };

  // Format timestamp based on user preference
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    if (timestampFormat === '24h') {
      return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  // Check if message contains a mention (starts with @)
  const hasMention = highlightMentions && message.message_text?.includes('@');

  return (
    <div 
      className={`message-item p-3 border-b border-gray-700 hover:bg-gray-800/50 ${
        message.is_deleted ? 'opacity-50' : ''
      } ${hasMention ? 'bg-yellow-500/10 border-l-2 border-l-yellow-500' : ''}`}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-1 min-w-0">
          <div className="message-content flex items-center space-x-2 mb-1">
            {showTimestamps && (
              <span className="text-xs text-gray-400">
                {formatTimestamp(message.timestamp)}
              </span>
            )}
            
            {showChannel && message.channel_name && (
              <span className="text-xs text-twitch-purple">
                #{message.channel_name}
              </span>
            )}

            {showBadges && badges.map((badge, idx) => (
              <span 
                key={idx} 
                className={`message-badges badge text-xs ${getBadgeClass(badge.type)}`}
              >
                {badge.type}
              </span>
            ))}

            <button
              onClick={handleUsernameClick}
              className="font-semibold text-twitch-purple hover:underline cursor-pointer"
            >
              {message.user_display_name || message.username}
            </button>

            {message.is_deleted && (
              <span className="flex items-center text-xs text-red-400">
                <Trash2 className="w-3 h-3 mr-1" />
                Deleted
              </span>
            )}
          </div>

          <p className={`message-text text-white break-words ${message.is_deleted ? 'line-through text-gray-400' : ''}`}>
            <EmoteRenderer parts={messageParts} />
          </p>

          {/* Link previews */}
          {!message.is_deleted && (
            <LinkPreview text={message.message_text} />
          )}
        </div>
      </div>
    </div>
  );
}

export default MessageItem;
