import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useWebSocket, useGlobalWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../hooks/useAuth';
import { authApi, channelsApi } from '../services/api';
import WatchChat from '../components/chat/WatchChat';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { 
  Eye, 
  Clock, 
  Gamepad2, 
  ExternalLink,
  ChevronLeft,
  Maximize2,
  Minimize2,
  Radio,
  MessageSquare
} from 'lucide-react';

// Format viewer count
const formatViewers = (count) => {
  if (!count) return '0';
  if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
  if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
  return count.toString();
};

// Format uptime
const formatUptime = (startedAt) => {
  if (!startedAt) return '';
  const start = new Date(startedAt);
  const now = new Date();
  const diffMs = now - start;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

// Twitch Player Component
function TwitchPlayer({ channel, muted = false, onReady }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    // Load Twitch Embed script if not already loaded
    if (!window.Twitch) {
      const script = document.createElement('script');
      script.src = 'https://player.twitch.tv/js/embed/v1.js';
      script.async = true;
      script.onload = () => initPlayer();
      document.body.appendChild(script);
    } else {
      initPlayer();
    }

    function initPlayer() {
      if (containerRef.current && window.Twitch) {
        // Clear any existing player
        containerRef.current.innerHTML = '';
        
        playerRef.current = new window.Twitch.Player(containerRef.current, {
          channel: channel,
          width: '100%',
          height: '100%',
          muted: muted,
          parent: [window.location.hostname],
        });

        playerRef.current.addEventListener(window.Twitch.Player.READY, () => {
          onReady?.(playerRef.current);
        });
      }
    }

    return () => {
      if (playerRef.current) {
        // Cleanup
        playerRef.current = null;
      }
    };
  }, [channel]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full bg-black"
    />
  );
}

export default function Watch() {
  const { channel } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  
  // WebSocket for live chat and mod actions
  const { messages, modActions, isConnected } = useWebSocket([channel]);
  const { channelStatuses } = useGlobalWebSocket();
  
  // Player state
  const [player, setPlayer] = useState(null);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  
  // Get channel status from WebSocket (live data)
  const liveStatus = channelStatuses[channel?.toLowerCase()] || {};
  
  // Fetch channel data from our database (for twitch_id needed by emotes)
  const { data: channelData } = useQuery({
    queryKey: ['channel', channel],
    queryFn: async () => {
      const response = await channelsApi.getByName(channel);
      return response.data;
    },
    enabled: !!channel,
    staleTime: 60000,
  });

  // Fetch stream data from Twitch API via our backend
  const { data: streamData, isLoading: streamLoading } = useQuery({
    queryKey: ['stream-info', channel],
    queryFn: async () => {
      // Try to get from followed streams if authenticated
      if (isAuthenticated) {
        try {
          const response = await authApi.getFollowedStreams();
          const streams = response.data?.streams || [];
          const stream = streams.find(s => s.userLogin?.toLowerCase() === channel?.toLowerCase());
          if (stream) return stream;
        } catch (e) {
          // Fall back to channel status
        }
      }
      return null;
    },
    enabled: !!channel,
    staleTime: 30000,
  });

  // Merge live WebSocket data with API data
  const streamInfo = {
    userLogin: channel,
    userDisplayName: liveStatus.display_name || streamData?.userDisplayName || channel,
    title: liveStatus.stream_title || streamData?.title || 'Stream',
    gameName: liveStatus.game_name || streamData?.gameName || '',
    viewerCount: liveStatus.viewer_count || streamData?.viewerCount || 0,
    startedAt: liveStatus.started_at || streamData?.startedAt,
    profileImageUrl: liveStatus.profile_image_url || streamData?.profileImageUrl,
    isLive: liveStatus.is_live !== undefined ? liveStatus.is_live : true,
    tags: streamData?.tags || [],
  };

  // Handle player ready
  const handlePlayerReady = (playerInstance) => {
    setPlayer(playerInstance);
  };

  // Toggle mute
  const toggleMute = () => {
    if (player) {
      if (isMuted) {
        player.setMuted(false);
      } else {
        player.setMuted(true);
      }
      setIsMuted(!isMuted);
    }
  };

  if (!channel) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-gray-400">No channel specified</p>
      </div>
    );
  }

  return (
    <div className={`h-[calc(100vh-3.5rem)] flex flex-col ${isTheaterMode ? 'fixed inset-0 z-50 bg-twitch-dark pt-0' : ''}`}>
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-twitch-gray border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            {streamInfo.profileImageUrl && (
              <img 
                src={streamInfo.profileImageUrl} 
                alt={streamInfo.userDisplayName}
                className="w-8 h-8 rounded-full"
              />
            )}
            <div>
              <h1 className="font-semibold text-white">{streamInfo.userDisplayName}</h1>
              {streamInfo.isLive && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="flex items-center gap-1 text-red-500">
                    <Radio className="w-3 h-3" />
                    LIVE
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {formatViewers(streamInfo.viewerCount)}
                  </span>
                  {streamInfo.startedAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatUptime(streamInfo.startedAt)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChatCollapsed(!chatCollapsed)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title={chatCollapsed ? 'Show chat' : 'Hide chat'}
          >
            <MessageSquare className={`w-5 h-5 ${chatCollapsed ? 'text-gray-500' : 'text-twitch-purple'}`} />
          </button>
          <button
            onClick={() => setIsTheaterMode(!isTheaterMode)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title={isTheaterMode ? 'Exit theater mode' : 'Theater mode'}
          >
            {isTheaterMode ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          <a
            href={`https://twitch.tv/${channel}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title="Open on Twitch"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Player */}
        <div className={`flex-1 flex flex-col bg-black ${chatCollapsed ? '' : 'min-w-0'}`}>
          {/* Player */}
          <div className="flex-1 relative">
            <TwitchPlayer 
              channel={channel} 
              muted={isMuted}
              onReady={handlePlayerReady}
            />
          </div>
          
          {/* Stream Info Bar */}
          <div className="bg-twitch-gray p-4 border-t border-gray-700">
            <div className="flex items-start gap-4">
              {/* Profile Image */}
              {streamInfo.profileImageUrl && (
                <img 
                  src={streamInfo.profileImageUrl} 
                  alt={streamInfo.userDisplayName}
                  className="w-16 h-16 rounded-full flex-shrink-0"
                />
              )}
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-white truncate" title={streamInfo.title}>
                  {streamInfo.title}
                </h2>
                <div className="flex items-center gap-4 mt-1 text-sm">
                  <Link 
                    to={`/channel/${channel}`}
                    className="text-twitch-purple hover:underline font-medium"
                  >
                    {streamInfo.userDisplayName}
                  </Link>
                  {streamInfo.gameName && (
                    <span className="flex items-center gap-1 text-gray-400">
                      <Gamepad2 className="w-4 h-4" />
                      {streamInfo.gameName}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-gray-400">
                    <Eye className="w-4 h-4" />
                    {formatViewers(streamInfo.viewerCount)} viewers
                  </span>
                </div>
                
                {/* Tags */}
                {streamInfo.tags && streamInfo.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {streamInfo.tags.slice(0, 5).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded hover:bg-gray-600 cursor-pointer"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  to={`/channel/${channel}`}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  View Logs
                </Link>
                <a
                  href={`https://twitch.tv/${channel}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-twitch-purple hover:bg-twitch-purple-dark text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Twitch
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Panel */}
        {!chatCollapsed && (
          <div className="w-96 flex-shrink-0 flex flex-col border-l border-gray-700">
            <WatchChat
              messages={messages}
              modActions={modActions}
              channelName={channel}
              channelData={channelData}
              isConnected={isConnected}
            />
          </div>
        )}
      </div>
    </div>
  );
}
