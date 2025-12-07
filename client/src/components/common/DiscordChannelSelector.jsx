import { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronDown, 
  ChevronRight,
  Hash, 
  Volume2,
  Megaphone,
  Loader2,
  RefreshCw,
  AlertCircle,
  Check,
  Server,
  FolderOpen,
} from 'lucide-react';

/**
 * Discord Channel Selector - Browse guilds and channels to create webhooks
 */
export function DiscordChannelSelector({
  guilds,
  guildsLoading,
  channels,
  channelsLoading,
  onFetchChannels,
  onSelectChannel,
  onRefreshGuilds,
  onCancel,
  webhookData, // { name, webhookType, config, ... }
  creating,
}) {
  const [selectedGuild, setSelectedGuild] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [selectedChannel, setSelectedChannel] = useState(null);

  // Get channels for selected guild
  const guildChannels = selectedGuild ? channels[selectedGuild.id] : null;

  // Handle guild selection
  const handleGuildSelect = async (guild) => {
    setSelectedGuild(guild);
    setSelectedChannel(null);
    
    // Fetch channels if not already cached
    if (!channels[guild.id]) {
      await onFetchChannels(guild.id);
    }
  };

  // Handle channel selection
  const handleChannelClick = (channel) => {
    setSelectedChannel(channel);
  };

  // Handle confirm selection
  const handleConfirm = () => {
    if (selectedGuild && selectedChannel) {
      onSelectChannel(selectedGuild, selectedChannel);
    }
  };

  // Toggle category expansion
  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  // Channel type icons
  const getChannelIcon = (type) => {
    switch (type) {
      case 5: // GUILD_ANNOUNCEMENT
        return <Megaphone className="w-4 h-4 text-gray-400" />;
      case 2: // GUILD_VOICE
        return <Volume2 className="w-4 h-4 text-gray-400" />;
      default: // GUILD_TEXT
        return <Hash className="w-4 h-4 text-gray-400" />;
    }
  };

  // Back to guild list
  const handleBack = () => {
    setSelectedGuild(null);
    setSelectedChannel(null);
  };

  // Render guild list
  const renderGuildList = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Select Server</h3>
        <button
          onClick={onRefreshGuilds}
          disabled={guildsLoading}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh servers"
        >
          <RefreshCw className={`w-4 h-4 ${guildsLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {guildsLoading && guilds.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : guilds.length === 0 ? (
        <div className="text-center py-8">
          <Server className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No servers with webhook permissions found</p>
          <p className="text-gray-500 text-sm mt-1">
            You need "Manage Webhooks" permission in a server
          </p>
        </div>
      ) : (
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {guilds.map(guild => (
            <button
              key={guild.id}
              onClick={() => handleGuildSelect(guild)}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-twitch-dark hover:bg-gray-700 transition-colors text-left"
            >
              {guild.iconUrl ? (
                <img 
                  src={guild.iconUrl} 
                  alt={guild.name}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                  <span className="text-gray-400 text-sm font-medium">
                    {guild.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{guild.name}</p>
                {guild.owner && (
                  <p className="text-xs text-gray-500">Owner</p>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // Render channel list for selected guild
  const renderChannelList = () => {
    const isLoading = channelsLoading[selectedGuild.id];
    
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={handleBack}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            {selectedGuild.iconUrl ? (
              <img 
                src={selectedGuild.iconUrl} 
                alt={selectedGuild.name}
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center">
                <span className="text-gray-400 text-xs">
                  {selectedGuild.name.charAt(0)}
                </span>
              </div>
            )}
            <h3 className="text-lg font-semibold text-white truncate">{selectedGuild.name}</h3>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : !guildChannels || guildChannels.channels.length === 0 ? (
          <div className="text-center py-8">
            <Hash className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No text channels found</p>
            <p className="text-gray-500 text-sm mt-1">
              Only text and announcement channels can have webhooks
            </p>
          </div>
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {/* Uncategorized channels first */}
            {guildChannels.uncategorized.map(channel => (
              <ChannelItem
                key={channel.id}
                channel={channel}
                selected={selectedChannel?.id === channel.id}
                onClick={() => handleChannelClick(channel)}
                getIcon={getChannelIcon}
              />
            ))}

            {/* Categorized channels */}
            {guildChannels.categorized.map(category => (
              <div key={category.id} className="mt-2">
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="w-full flex items-center gap-1 px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-300"
                >
                  {expandedCategories[category.id] === false ? (
                    <ChevronRight className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                  <FolderOpen className="w-3 h-3" />
                  {category.name}
                </button>
                
                {expandedCategories[category.id] !== false && (
                  <div className="ml-4 space-y-0.5">
                    {category.channels.map(channel => (
                      <ChannelItem
                        key={channel.id}
                        channel={channel}
                        selected={selectedChannel?.id === channel.id}
                        onClick={() => handleChannelClick(channel)}
                        getIcon={getChannelIcon}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-twitch-gray rounded-lg border border-gray-700 p-6">
      {!selectedGuild ? renderGuildList() : renderChannelList()}

      {/* Action buttons */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        
        {selectedChannel && (
          <button
            onClick={handleConfirm}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2 bg-twitch-purple hover:bg-twitch-purple-dark text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Create Webhook in #{selectedChannel.name}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Individual channel item
 */
function ChannelItem({ channel, selected, onClick, getIcon }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left ${
        selected 
          ? 'bg-twitch-purple/20 text-white' 
          : 'hover:bg-gray-700 text-gray-300'
      }`}
    >
      {getIcon(channel.type)}
      <span className="truncate">{channel.name}</span>
      {selected && (
        <Check className="w-4 h-4 text-twitch-purple ml-auto" />
      )}
    </button>
  );
}

export default DiscordChannelSelector;
