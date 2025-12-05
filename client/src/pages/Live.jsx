import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWebSocket } from '../hooks/useWebSocket';
import { useEmotes } from '../hooks/useEmotes';
import { channelsApi } from '../services/api';
import LiveFeed from '../components/chat/LiveFeed';
import ModActionList from '../components/moderation/ModActionList';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { Radio, Shield, X } from 'lucide-react';
import { MobileLive } from './mobile';

function Live({ isMobile }) {
  // Render mobile version if on mobile
  if (isMobile) {
    return <MobileLive />;
  }

  const [selectedChannels, setSelectedChannels] = useState([]);
  
  const { data: channelsData, isLoading: channelsLoading } = useQuery({
    queryKey: ['channels', { active: true }],
    queryFn: () => channelsApi.getAll({ active: true }).then(res => res.data),
  });

  // Pre-load emotes for all active channels
  const { loadChannelEmotes } = useEmotes();
  
  useEffect(() => {
    if (channelsData?.channels) {
      channelsData.channels.forEach(channel => {
        if (channel.twitch_id) {
          loadChannelEmotes(channel.twitch_id, channel.name);
        }
      });
    }
  }, [channelsData, loadChannelEmotes]);

  const { 
    isConnected, 
    messages, 
    modActions, 
    clearMessages, 
    clearModActions 
  } = useWebSocket(selectedChannels);

  // Select all channels by default when loaded
  useEffect(() => {
    if (channelsData?.channels && selectedChannels.length === 0) {
      setSelectedChannels(channelsData.channels.map(c => c.name));
    }
  }, [channelsData]);

  const toggleChannel = (channelName) => {
    setSelectedChannels(prev => 
      prev.includes(channelName)
        ? prev.filter(c => c !== channelName)
        : [...prev, channelName]
    );
  };

  const selectAll = () => {
    if (channelsData?.channels) {
      setSelectedChannels(channelsData.channels.map(c => c.name));
    }
  };

  const deselectAll = () => {
    setSelectedChannels([]);
  };

  if (channelsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center">
            <Radio className={`w-6 h-6 mr-2 ${isConnected ? 'text-green-500' : 'text-red-500'}`} />
            Live Feed
          </h1>
          <p className="text-gray-400">
            {isConnected ? 'Connected and receiving messages' : 'Connecting...'}
          </p>
        </div>
      </div>

      {/* Channel Selection */}
      <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-400">Channels</h3>
          <div className="flex items-center space-x-2 text-xs">
            <button 
              onClick={selectAll}
              className="text-twitch-purple hover:underline"
            >
              Select all
            </button>
            <span className="text-gray-600">|</span>
            <button 
              onClick={deselectAll}
              className="text-gray-400 hover:underline"
            >
              Deselect all
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {channelsData?.channels?.map(channel => (
            <button
              key={channel.id}
              onClick={() => toggleChannel(channel.name)}
              className={`px-3 py-1 rounded-full text-sm flex items-center space-x-1 ${
                selectedChannels.includes(channel.name)
                  ? 'bg-twitch-purple text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <span>#{channel.name}</span>
              {selectedChannels.includes(channel.name) && (
                <X className="w-3 h-3" />
              )}
            </button>
          ))}
          {(!channelsData?.channels || channelsData.channels.length === 0) && (
            <p className="text-gray-400 text-sm">No active channels</p>
          )}
        </div>
      </div>

      {/* Live Feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-twitch-gray rounded-lg border border-gray-700 h-[600px]">
          <LiveFeed 
            messages={messages} 
            onClear={clearMessages}
            channels={channelsData?.channels || []}
          />
        </div>

        <div className="bg-twitch-gray rounded-lg border border-gray-700 h-[600px] flex flex-col">
          <div className="p-3 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-red-400" />
              <span className="text-sm text-gray-300">Mod Actions</span>
            </div>
            <button
              onClick={clearModActions}
              className="text-xs text-gray-400 hover:text-white"
            >
              Clear
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {modActions.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                No mod actions yet
              </div>
            ) : (
              <ModActionList actions={modActions} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Live;
