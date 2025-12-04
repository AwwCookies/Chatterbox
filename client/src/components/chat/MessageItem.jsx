import { formatTime, getBadgeClass } from '../../utils/formatters';
import { Trash2 } from 'lucide-react';
import EmoteRenderer from './EmoteRenderer';
import { parseMessageWithEmotes } from '../../hooks/useEmotes';
import { useProfileCardStore } from '../../stores/profileCardStore';

function MessageItem({ message, showChannel = true, channelId = null }) {
  const openCard = useProfileCardStore(state => state.openCard);
  const badges = message.badges || [];
  
  // Parse message for emotes
  const effectiveChannelId = channelId || message.channel_twitch_id || null;
  const messageParts = parseMessageWithEmotes(
    message.message_text,
    message.emotes || [],
    effectiveChannelId
  );

  const handleUsernameClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openCard(message.username);
  };

  return (
    <div 
      className={`p-3 border-b border-gray-700 hover:bg-gray-800/50 ${
        message.is_deleted ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-xs text-gray-400">
              {formatTime(message.timestamp)}
            </span>
            
            {showChannel && message.channel_name && (
              <span className="text-xs text-twitch-purple">
                #{message.channel_name}
              </span>
            )}

            {badges.map((badge, idx) => (
              <span 
                key={idx} 
                className={`badge text-xs ${getBadgeClass(badge.type)}`}
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

          <p className={`text-white break-words ${message.is_deleted ? 'line-through text-gray-400' : ''}`}>
            <EmoteRenderer parts={messageParts} />
          </p>
        </div>
      </div>
    </div>
  );
}

export default MessageItem;
