import { useEffect, useRef, useState, useMemo } from 'react';
import { Pause, Play, Trash2 } from 'lucide-react';
import MessageItem from './MessageItem';
import { useEmotes } from '../../hooks/useEmotes';

function LiveFeed({ messages = [], onClear, channels = [], showChannelName = true }) {
  const [isPaused, setIsPaused] = useState(false);
  const [displayMessages, setDisplayMessages] = useState([]);
  const containerRef = useRef(null);
  const { isLoaded, loadChannelEmotes } = useEmotes();

  // Build channel name to twitch_id lookup
  const channelIdMap = useMemo(() => {
    const map = {};
    channels.forEach(ch => {
      if (ch.twitch_id) {
        map[ch.name.toLowerCase()] = ch.twitch_id;
      }
    });
    return map;
  }, [channels]);

  // Load channel emotes when we receive messages with channel IDs
  useEffect(() => {
    const loadedChannels = new Set();
    messages.forEach(msg => {
      const channelName = msg.channelName || msg.channel_name;
      const channelId = msg.channelTwitchId || msg.channel_twitch_id || 
                        (channelName ? channelIdMap[channelName.toLowerCase()] : null);
      if (channelId && !loadedChannels.has(channelId)) {
        loadedChannels.add(channelId);
        loadChannelEmotes(channelId, channelName);
      }
    });
  }, [messages, loadChannelEmotes, channelIdMap]);

  useEffect(() => {
    if (!isPaused) {
      setDisplayMessages(messages);
    }
  }, [messages, isPaused]);

  useEffect(() => {
    if (!isPaused && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [displayMessages, isPaused]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 bg-twitch-gray border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-green-500'}`} />
          <span className="text-sm text-gray-300">
            {isPaused ? 'Paused' : 'Live'} • {displayMessages.length} messages
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-white"
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>

          <button
            onClick={onClear}
            className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-white"
            title="Clear messages"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto"
      >
        {displayMessages.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            {isLoaded ? 'Waiting for messages...' : 'Loading emotes...'}
          </div>
        ) : (
          displayMessages.map((message, index) => {
            const channelName = message.channelName || message.channel_name;
            const channelTwitchId = message.channelTwitchId || message.channel_twitch_id || 
                                    (channelName ? channelIdMap[channelName.toLowerCase()] : null);
            return (
              <MessageItem 
                key={message.messageId || index} 
                message={{
                  ...message,
                  username: message.username,
                  user_display_name: message.displayName || message.user_display_name,
                  channel_name: channelName,
                  message_text: message.messageText || message.message_text,
                  emotes: message.emotes || [],
                  channel_twitch_id: channelTwitchId,
                }}
                showChannel={showChannelName}
                channelId={channelTwitchId}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

export default LiveFeed;
