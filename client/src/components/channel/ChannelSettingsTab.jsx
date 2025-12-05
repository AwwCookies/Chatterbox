import { useState } from 'react';
import { 
  Settings, UserX, Users, Eye, EyeOff, Link2, MessageSquare, 
  Shield, Bell, Trash2, Plus, X, Search, RotateCcw, Save,
  Grid, List, TrendingUp, Clock, Hash, Filter, Palette,
  Volume2, VolumeX, Bot, AlertTriangle, Radio
} from 'lucide-react';
import { useChannelSettingsStore } from '../../stores/channelSettingsStore';

const PLATFORMS = [
  { id: 'youtube', name: 'YouTube', color: 'text-red-400' },
  { id: 'tiktok', name: 'TikTok', color: 'text-pink-400' },
  { id: 'twitter', name: 'X/Twitter', color: 'text-blue-400' },
  { id: 'twitch', name: 'Twitch', color: 'text-purple-400' },
  { id: 'instagram', name: 'Instagram', color: 'text-pink-500' },
  { id: 'reddit', name: 'Reddit', color: 'text-orange-400' },
];

function ChannelSettingsTab({ channelName }) {
  const [activeSection, setActiveSection] = useState('links');
  const [newExcludedUser, setNewExcludedUser] = useState('');
  const [newHighlightUser, setNewHighlightUser] = useState('');
  const [newMutedKeyword, setNewMutedKeyword] = useState('');
  const [newExcludedFeedUser, setNewExcludedFeedUser] = useState('');
  
  const {
    getChannelSettings,
    setChannelSetting,
    resetChannelSettings,
    excludeUserFromLinks,
    unexcludeUserFromLinks,
    excludeUserFromFeed,
    unexcludeUserFromFeed,
    addHighlightUser,
    removeHighlightUser,
    addMutedKeyword,
    removeMutedKeyword,
    togglePlatformFilter,
  } = useChannelSettingsStore();
  
  const settings = getChannelSettings(channelName);

  const handleAddExcludedUser = (e) => {
    e.preventDefault();
    if (newExcludedUser.trim()) {
      excludeUserFromLinks(channelName, newExcludedUser.trim());
      setNewExcludedUser('');
    }
  };

  const handleAddExcludedFeedUser = (e) => {
    e.preventDefault();
    if (newExcludedFeedUser.trim()) {
      excludeUserFromFeed(channelName, newExcludedFeedUser.trim());
      setNewExcludedFeedUser('');
    }
  };

  const handleAddHighlightUser = (e) => {
    e.preventDefault();
    if (newHighlightUser.trim()) {
      addHighlightUser(channelName, newHighlightUser.trim());
      setNewHighlightUser('');
    }
  };

  const handleAddMutedKeyword = (e) => {
    e.preventDefault();
    if (newMutedKeyword.trim()) {
      addMutedKeyword(channelName, newMutedKeyword.trim());
      setNewMutedKeyword('');
    }
  };

  const sections = [
    { id: 'links', label: 'Links', icon: Link2 },
    { id: 'feed', label: 'Live Feed', icon: Radio },
    { id: 'moderation', label: 'Moderation', icon: Shield },
    { id: 'ui', label: 'UI Preferences', icon: Settings },
  ];

  return (
    <div className="bg-twitch-gray rounded-lg border border-gray-700">
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center">
          <Settings className="w-5 h-5 mr-2 text-gray-400" />
          Channel Settings
        </h2>
        <button
          onClick={() => {
            if (confirm('Reset all settings for this channel to defaults?')) {
              resetChannelSettings(channelName);
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset All
        </button>
      </div>
      
      <div className="flex">
        {/* Sidebar Navigation */}
        <div className="w-48 border-r border-gray-700 p-2">
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeSection === section.id
                  ? 'bg-twitch-purple/20 text-twitch-purple'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <section.icon className="w-4 h-4" />
              {section.label}
            </button>
          ))}
        </div>

        {/* Settings Content */}
        <div className="flex-1 p-4 max-h-[500px] overflow-y-auto">
          {/* Links Settings */}
          {activeSection === 'links' && (
            <div className="space-y-6">
              {/* Excluded Users */}
              <div>
                <h3 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                  <UserX className="w-4 h-4 text-red-400" />
                  Excluded Users from Links
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  Links from these users won't appear in the Links tab or panel
                </p>
                
                <form onSubmit={handleAddExcludedUser} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newExcludedUser}
                    onChange={(e) => setNewExcludedUser(e.target.value)}
                    placeholder="Enter username..."
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple"
                  />
                  <button
                    type="submit"
                    disabled={!newExcludedUser.trim()}
                    className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </form>

                {settings.excludedUsers.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {settings.excludedUsers.map(user => (
                      <span
                        key={user}
                        className="inline-flex items-center gap-1.5 px-2 py-1 bg-red-500/10 text-red-400 rounded text-sm"
                      >
                        {user}
                        <button
                          onClick={() => unexcludeUserFromLinks(channelName, user)}
                          className="hover:text-red-300"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 italic">No users excluded</p>
                )}
              </div>

              {/* Excluded Platforms */}
              <div>
                <h3 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                  <Filter className="w-4 h-4 text-blue-400" />
                  Excluded Platforms
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  Hide links from specific platforms
                </p>
                
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map(platform => {
                    const isExcluded = settings.excludedPlatforms.includes(platform.id);
                    return (
                      <button
                        key={platform.id}
                        onClick={() => togglePlatformFilter(channelName, platform.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          isExcluded
                            ? 'bg-gray-800 text-gray-500 line-through'
                            : `bg-gray-800 ${platform.color} hover:bg-gray-700`
                        }`}
                      >
                        {isExcluded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {platform.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Link Display Options */}
              <div>
                <h3 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                  <Grid className="w-4 h-4 text-green-400" />
                  Display Options
                </h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-300">Default View</label>
                    <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
                      <button
                        onClick={() => setChannelSetting(channelName, 'defaultLinkView', 'grid')}
                        className={`p-1.5 rounded ${
                          settings.defaultLinkView === 'grid' 
                            ? 'bg-gray-700 text-white' 
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <Grid className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setChannelSetting(channelName, 'defaultLinkView', 'list')}
                        className={`p-1.5 rounded ${
                          settings.defaultLinkView === 'list' 
                            ? 'bg-gray-700 text-white' 
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <List className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-300">Default Sort</label>
                    <select
                      value={settings.defaultLinkSort}
                      onChange={(e) => setChannelSetting(channelName, 'defaultLinkSort', e.target.value)}
                      className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-twitch-purple"
                    >
                      <option value="count">Most Shared</option>
                      <option value="recent">Most Recent</option>
                      <option value="users">Most Users</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-300">Min. shares to show</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={settings.minLinkShares}
                      onChange={(e) => setChannelSetting(channelName, 'minLinkShares', parseInt(e.target.value) || 1)}
                      className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-twitch-purple"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-300">Auto-load previews</label>
                    <button
                      onClick={() => setChannelSetting(channelName, 'autoLoadPreviews', !settings.autoLoadPreviews)}
                      className={`relative w-10 h-6 rounded-full transition-colors ${
                        settings.autoLoadPreviews ? 'bg-twitch-purple' : 'bg-gray-700'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        settings.autoLoadPreviews ? 'translate-x-5' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Feed Settings */}
          {activeSection === 'feed' && (
            <div className="space-y-6">
              {/* Excluded Users from Feed */}
              <div>
                <h3 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                  <UserX className="w-4 h-4 text-red-400" />
                  Hidden Users in Feed
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  Messages from these users won't appear in the live feed
                </p>
                
                <form onSubmit={handleAddExcludedFeedUser} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newExcludedFeedUser}
                    onChange={(e) => setNewExcludedFeedUser(e.target.value)}
                    placeholder="Enter username..."
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple"
                  />
                  <button
                    type="submit"
                    disabled={!newExcludedFeedUser.trim()}
                    className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </form>

                {settings.excludedUsersFromFeed.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {settings.excludedUsersFromFeed.map(user => (
                      <span
                        key={user}
                        className="inline-flex items-center gap-1.5 px-2 py-1 bg-red-500/10 text-red-400 rounded text-sm"
                      >
                        {user}
                        <button
                          onClick={() => unexcludeUserFromFeed(channelName, user)}
                          className="hover:text-red-300"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 italic">No users hidden</p>
                )}
              </div>

              {/* Highlighted Users */}
              <div>
                <h3 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4 text-yellow-400" />
                  Highlighted Users
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  Messages from these users will be highlighted in the feed
                </p>
                
                <form onSubmit={handleAddHighlightUser} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newHighlightUser}
                    onChange={(e) => setNewHighlightUser(e.target.value)}
                    placeholder="Enter username..."
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple"
                  />
                  <button
                    type="submit"
                    disabled={!newHighlightUser.trim()}
                    className="px-3 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </form>

                {settings.highlightUsers.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {settings.highlightUsers.map(user => (
                      <span
                        key={user}
                        className="inline-flex items-center gap-1.5 px-2 py-1 bg-yellow-500/10 text-yellow-400 rounded text-sm"
                      >
                        {user}
                        <button
                          onClick={() => removeHighlightUser(channelName, user)}
                          className="hover:text-yellow-300"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 italic">No users highlighted</p>
                )}

                {/* Highlight Color */}
                {settings.highlightUsers.length > 0 && (
                  <div className="flex items-center gap-3 mt-3">
                    <label className="text-sm text-gray-400">Highlight color:</label>
                    <input
                      type="color"
                      value={settings.highlightColor}
                      onChange={(e) => setChannelSetting(channelName, 'highlightColor', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent"
                    />
                    <span className="text-xs text-gray-500">{settings.highlightColor}</span>
                  </div>
                )}
              </div>

              {/* Muted Keywords */}
              <div>
                <h3 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                  <VolumeX className="w-4 h-4 text-orange-400" />
                  Muted Keywords
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  Messages containing these words will be blurred/hidden
                </p>
                
                <form onSubmit={handleAddMutedKeyword} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newMutedKeyword}
                    onChange={(e) => setNewMutedKeyword(e.target.value)}
                    placeholder="Enter keyword..."
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple"
                  />
                  <button
                    type="submit"
                    disabled={!newMutedKeyword.trim()}
                    className="px-3 py-2 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </form>

                {settings.muteKeywords.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {settings.muteKeywords.map(keyword => (
                      <span
                        key={keyword}
                        className="inline-flex items-center gap-1.5 px-2 py-1 bg-orange-500/10 text-orange-400 rounded text-sm"
                      >
                        {keyword}
                        <button
                          onClick={() => removeMutedKeyword(channelName, keyword)}
                          className="hover:text-orange-300"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 italic">No keywords muted</p>
                )}
              </div>

              {/* Bot Messages Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <Bot className="w-4 h-4 text-blue-400" />
                    Show Bot Messages
                  </h3>
                  <p className="text-xs text-gray-500">Show messages from known bots</p>
                </div>
                <button
                  onClick={() => setChannelSetting(channelName, 'showBotMessages', !settings.showBotMessages)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${
                    settings.showBotMessages ? 'bg-twitch-purple' : 'bg-gray-700'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.showBotMessages ? 'translate-x-5' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          )}

          {/* Moderation Settings */}
          {activeSection === 'moderation' && (
            <div className="space-y-6">
              {/* Show AutoMod */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <Bot className="w-4 h-4 text-blue-400" />
                    Show AutoMod Actions
                  </h3>
                  <p className="text-xs text-gray-500">Include AutoMod-triggered actions in mod log</p>
                </div>
                <button
                  onClick={() => setChannelSetting(channelName, 'showAutoModActions', !settings.showAutoModActions)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${
                    settings.showAutoModActions ? 'bg-twitch-purple' : 'bg-gray-700'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.showAutoModActions ? 'translate-x-5' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Excluded Action Types */}
              <div>
                <h3 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                  <Filter className="w-4 h-4 text-purple-400" />
                  Action Type Filters
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  Hide specific types of mod actions
                </p>
                
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'ban', label: 'Bans', color: 'red' },
                    { id: 'timeout', label: 'Timeouts', color: 'yellow' },
                    { id: 'delete', label: 'Deletes', color: 'orange' },
                    { id: 'unban', label: 'Unbans', color: 'green' },
                  ].map(action => {
                    const isExcluded = settings.excludedModActions.includes(action.id);
                    return (
                      <button
                        key={action.id}
                        onClick={() => {
                          const current = settings.excludedModActions;
                          if (isExcluded) {
                            setChannelSetting(channelName, 'excludedModActions', current.filter(a => a !== action.id));
                          } else {
                            setChannelSetting(channelName, 'excludedModActions', [...current, action.id]);
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          isExcluded
                            ? 'bg-gray-800 text-gray-500 line-through'
                            : `bg-${action.color}-500/20 text-${action.color}-400 hover:bg-${action.color}-500/30`
                        }`}
                      >
                        {isExcluded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* UI Preferences */}
          {activeSection === 'ui' && (
            <div className="space-y-6">
              {/* Default Tab */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-white">Default Tab</h3>
                  <p className="text-xs text-gray-500">Tab to show when visiting this channel</p>
                </div>
                <select
                  value={settings.defaultTab}
                  onChange={(e) => setChannelSetting(channelName, 'defaultTab', e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-twitch-purple"
                >
                  <option value="live">Live Feed</option>
                  <option value="messages">Message History</option>
                  <option value="links">Links</option>
                  <option value="moderation">Mod Actions</option>
                  <option value="users">Top Users</option>
                  <option value="settings">Settings</option>
                </select>
              </div>

              {/* Link Panel Default State */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-white">Link Panel Collapsed</h3>
                  <p className="text-xs text-gray-500">Start with link panel collapsed on live tab</p>
                </div>
                <button
                  onClick={() => setChannelSetting(channelName, 'linkPanelCollapsed', !settings.linkPanelCollapsed)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${
                    settings.linkPanelCollapsed ? 'bg-twitch-purple' : 'bg-gray-700'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.linkPanelCollapsed ? 'translate-x-5' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Compact Messages */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-white">Compact Messages</h3>
                  <p className="text-xs text-gray-500">Use compact message layout in feeds</p>
                </div>
                <button
                  onClick={() => setChannelSetting(channelName, 'compactMessages', !settings.compactMessages)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${
                    settings.compactMessages ? 'bg-twitch-purple' : 'bg-gray-700'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.compactMessages ? 'translate-x-5' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Links Per Page */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-white">Links Per Page</h3>
                  <p className="text-xs text-gray-500">Number of links to load per page</p>
                </div>
                <select
                  value={settings.linksPerPage}
                  onChange={(e) => setChannelSetting(channelName, 'linksPerPage', parseInt(e.target.value))}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-twitch-purple"
                >
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-700 bg-gray-800/50">
        <p className="text-xs text-gray-500 text-center">
          Settings are saved automatically and stored locally in your browser
        </p>
      </div>
    </div>
  );
}

export default ChannelSettingsTab;
