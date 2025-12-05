import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Trash2, ChevronUp } from 'lucide-react';
import MobileMessageItem from './MobileMessageItem';
import { useSettingsStore } from '../../stores/settingsStore';
import { useEmotes } from '../../hooks/useEmotes';

function MobileLiveFeed({ messages = [], onClear, channels = [], showChannelName = true }) {
  // Get settings
  const autoScroll = useSettingsStore(state => state.autoScroll);
  const maxLiveMessages = useSettingsStore(state => state.maxLiveMessages);
  
  const [isPaused, setIsPaused] = useState(false);
  const [displayMessages, setDisplayMessages] = useState([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const containerRef = useRef(null);
  const { isLoaded, loadChannelEmotes } = useEmotes();

  // Build channel name to twitch_id lookup
  const channelIdMap = {};
  channels.forEach(ch => {
    if (ch.twitch_id) {
      channelIdMap[ch.name.toLowerCase()] = ch.twitch_id;
    }
  });

  // Load channel emotes
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
  }, [messages, loadChannelEmotes]);

  // Update display messages
  useEffect(() => {
    if (!isPaused) {
      const limitedMessages = messages.slice(0, maxLiveMessages);
      setDisplayMessages(limitedMessages);
      setNewMessageCount(0);
    } else {
      // Count new messages while paused
      const newCount = messages.length - displayMessages.length;
      if (newCount > 0) {
        setNewMessageCount(prev => prev + newCount);
      }
    }
  }, [messages, isPaused, maxLiveMessages]);

  // Auto-scroll to top when new messages arrive
  useEffect(() => {
    if (autoScroll && !isPaused && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [displayMessages, isPaused, autoScroll]);

  // Track scroll position
  const handleScroll = () => {
    if (containerRef.current) {
      setShowScrollTop(containerRef.current.scrollTop > 500);
    }
  };

  const scrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    setIsPaused(false);
  };

  const handleResume = () => {
    setIsPaused(false);
    const limitedMessages = messages.slice(0, maxLiveMessages);
    setDisplayMessages(limitedMessages);
    setNewMessageCount(0);
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-twitch-gray border-b border-gray-700 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-green-500 animate-pulse'}`} />
          <span className="text-sm text-gray-300">
            {isPaused ? 'Paused' : 'Live'} • {displayMessages.length} msgs
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => isPaused ? handleResume() : setIsPaused(true)}
            className="p-2 rounded-lg bg-gray-700 active:bg-gray-600 text-white"
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
          <button
            onClick={onClear}
            className="p-2 rounded-lg bg-gray-700 active:bg-gray-600 text-white"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* New messages indicator */}
      {isPaused && newMessageCount > 0 && (
        <button
          onClick={handleResume}
          className="sticky top-12 z-10 mx-4 mt-2 py-2 px-4 rounded-full bg-twitch-purple text-white text-sm font-medium shadow-lg active:bg-twitch-purple-dark"
        >
          {newMessageCount} new message{newMessageCount > 1 ? 's' : ''} • Tap to resume
        </button>
      )}

      {/* Messages */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto overscroll-contain"
        onScroll={handleScroll}
      >
        {displayMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
            <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            </div>
            <p className="text-center">
              {isLoaded ? 'Waiting for messages...' : 'Loading emotes...'}
            </p>
            <p className="text-sm text-gray-500 mt-2 text-center">
              Messages will appear here as they come in
            </p>
          </div>
        ) : (
          displayMessages.map((message, index) => {
            const channelName = message.channelName || message.channel_name;
            const channelTwitchId = message.channelTwitchId || message.channel_twitch_id || 
                                    (channelName ? channelIdMap[channelName.toLowerCase()] : null);
            return (
              <MobileMessageItem 
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

      {/* Scroll to top button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="absolute bottom-4 right-4 p-3 rounded-full bg-twitch-purple text-white shadow-lg active:bg-twitch-purple-dark z-20"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

export default MobileLiveFeed;
