import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useEmotes } from '../../hooks/useEmotes';
import { channelsApi } from '../../services/api';
import { MobileLiveFeed, MobileScrollableTabs, PullToRefresh } from '../../components/mobile';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { Radio, Shield, MessageSquare, Filter, Check } from 'lucide-react';

function MobileLive() {
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [showChannelFilter, setShowChannelFilter] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  
  const { data: channelsData, isLoading: channelsLoading } = useQuery({
    queryKey: ['channels', { active: true }],
    queryFn: () => channelsApi.getAll({ active: true }).then(res => res.data),
  });

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

  // Select all channels by default
  useEffect(() => {
    if (channelsData?.channels && selectedChannels.length === 0) {
      setSelectedChannels(channelsData.channels.map(c => c.name));
    }
  }, [channelsData]);

  const toggleChannel = useCallback((channelName) => {
    setSelectedChannels(prev => 
      prev.includes(channelName)
        ? prev.filter(c => c !== channelName)
        : [...prev, channelName]
    );
  }, []);

  const selectAll = useCallback(() => {
    if (channelsData?.channels) {
      setSelectedChannels(channelsData.channels.map(c => c.name));
    }
  }, [channelsData]);

  const deselectAll = useCallback(() => {
    setSelectedChannels([]);
  }, []);

  const tabs = [
    { id: 'chat', label: 'Chat', icon: MessageSquare, badge: messages.length > 0 ? messages.length : undefined },
    { id: 'mod', label: 'Mod Actions', icon: Shield, badge: modActions.length > 0 ? modActions.length : undefined },
  ];

  if (channelsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const allChannels = channelsData?.channels || [];

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)]">
      {/* Header */}
      <div className="px-4 py-3 bg-twitch-gray border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Radio className={`w-5 h-5 ${isConnected ? 'text-green-500' : 'text-red-500'}`} />
            <h1 className="text-lg font-bold text-white">Live Feed</h1>
          </div>
          <button
            onClick={() => setShowChannelFilter(!showChannelFilter)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              showChannelFilter ? 'bg-twitch-purple text-white' : 'bg-gray-700 text-gray-300'
            }`}
          >
            <Filter className="w-4 h-4" />
            {selectedChannels.length}/{allChannels.length}
          </button>
        </div>

        {/* Channel filter */}
        {showChannelFilter && (
          <div className="space-y-2 animate-slide-up">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Filter channels</span>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-twitch-purple">Select all</button>
                <span>|</span>
                <button onClick={deselectAll} className="text-twitch-purple">Clear</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {allChannels.map(channel => (
                <button
                  key={channel.id}
                  onClick={() => toggleChannel(channel.name)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                    selectedChannels.includes(channel.name)
                      ? 'bg-twitch-purple text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  {selectedChannels.includes(channel.name) && <Check className="w-3 h-3" />}
                  #{channel.display_name || channel.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <MobileScrollableTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' ? (
          <MobileLiveFeed
            messages={messages}
            onClear={clearMessages}
            channels={allChannels}
            showChannelName={selectedChannels.length > 1}
          />
        ) : (
          <div className="h-full overflow-y-auto">
            {modActions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
                <Shield className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-center">No mod actions yet</p>
                <p className="text-sm text-gray-500 mt-2 text-center">
                  Mod actions will appear here in real-time
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-700/50">
                {modActions.map((action, index) => (
                  <div key={index} className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        action.actionType === 'ban' ? 'bg-red-500/20 text-red-400' :
                        action.actionType === 'timeout' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {action.actionType}
                      </span>
                      {action.duration && (
                        <span className="text-xs text-gray-500">{action.duration}s</span>
                      )}
                    </div>
                    <p className="text-sm text-white">
                      <span className="text-red-400">{action.targetUsername}</span>
                      <span className="text-gray-400"> by </span>
                      <span className="text-twitch-purple">{action.moderatorUsername}</span>
                    </p>
                    {action.reason && (
                      <p className="text-xs text-gray-500 mt-1">{action.reason}</p>
                    )}
                    <p className="text-xs text-gray-600 mt-1">#{action.channelName}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MobileLive;
