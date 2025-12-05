import { useState, useEffect } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useToast } from '../../stores/toastStore';
import { 
  Settings as SettingsIcon,
  Palette,
  MessageSquare,
  Bell,
  Radio,
  LayoutDashboard,
  Database,
  RotateCcw,
  Check,
  Moon,
  Sun,
  Monitor,
  X,
  Key
} from 'lucide-react';

const sections = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'chat', label: 'Chat Display', icon: MessageSquare },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'liveFeed', label: 'Live Feed', icon: Radio },
  { id: 'sidebar', label: 'Sidebar', icon: LayoutDashboard },
  { id: 'data', label: 'Data & Storage', icon: Database },
  { id: 'security', label: 'Security', icon: Key },
];

function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-twitch-purple' : 'bg-gray-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function SelectInput({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-twitch-purple"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function SettingRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-700/50 last:border-0">
      <div className="flex-1 pr-4">
        <p className="text-white font-medium text-sm">{label}</p>
        {description && (
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function ThemeSelector({ value, onChange }) {
  const themes = [
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'system', icon: Monitor, label: 'System' },
  ];

  return (
    <div className="flex gap-2">
      {themes.map(({ value: themeValue, icon: Icon, label }) => (
        <button
          key={themeValue}
          onClick={() => onChange(themeValue)}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-colors text-xs ${
            value === themeValue
              ? 'bg-twitch-purple/20 border-twitch-purple text-white'
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
          }`}
        >
          <Icon className="w-3 h-3" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

function AccentColorSelector({ value, onChange }) {
  const colors = [
    { value: 'purple', color: 'bg-purple-500' },
    { value: 'blue', color: 'bg-blue-500' },
    { value: 'green', color: 'bg-green-500' },
    { value: 'pink', color: 'bg-pink-500' },
    { value: 'orange', color: 'bg-orange-500' },
    { value: 'red', color: 'bg-red-500' },
  ];

  return (
    <div className="flex gap-1.5">
      {colors.map(({ value: colorValue, color }) => (
        <button
          key={colorValue}
          onClick={() => onChange(colorValue)}
          className={`w-6 h-6 rounded-full ${color} flex items-center justify-center transition-transform ${
            value === colorValue ? 'ring-2 ring-offset-1 ring-offset-twitch-gray ring-white scale-110' : 'hover:scale-105'
          }`}
        >
          {value === colorValue && <Check className="w-3 h-3 text-white" />}
        </button>
      ))}
    </div>
  );
}

function SettingsModal({ isOpen, onClose }) {
  const [activeSection, setActiveSection] = useState('appearance');
  const settings = useSettingsStore();
  const toast = useToast();

  // Close on escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleResetSection = () => {
    settings.resetCategory(activeSection);
    toast.success(`${sections.find(s => s.id === activeSection)?.label} settings reset`);
  };

  const handleResetAll = () => {
    settings.resetSettings();
    toast.success('All settings reset to defaults');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-twitch-dark border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-6 h-6 text-twitch-purple" />
            <div>
              <h2 className="text-lg font-bold text-white">Settings</h2>
              <p className="text-xs text-gray-400">Changes are saved automatically</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex h-[calc(85vh-80px)]">
          {/* Sidebar Navigation */}
          <nav className="w-48 border-r border-gray-700 p-3 overflow-y-auto">
            <ul className="space-y-1">
              {sections.map(({ id, label, icon: Icon }) => (
                <li key={id}>
                  <button
                    onClick={() => setActiveSection(id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left text-sm ${
                      activeSection === id
                        ? 'bg-twitch-purple/20 text-white'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-4 pt-4 border-t border-gray-700">
              <button
                onClick={handleResetAll}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset All</span>
              </button>
            </div>
          </nav>

          {/* Settings Content */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-md font-semibold text-white">
                {sections.find(s => s.id === activeSection)?.label}
              </h3>
              <button
                onClick={handleResetSection}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>

            {activeSection === 'appearance' && (
              <div>
                <SettingRow label="Theme" description="Choose your color scheme">
                  <ThemeSelector
                    value={settings.theme}
                    onChange={(v) => settings.setSetting('theme', v)}
                  />
                </SettingRow>

                <SettingRow label="Accent Color" description="Primary color for highlights">
                  <AccentColorSelector
                    value={settings.accentColor}
                    onChange={(v) => settings.setSetting('accentColor', v)}
                  />
                </SettingRow>

                <SettingRow label="Font Size" description="Text size throughout the app">
                  <SelectInput
                    value={settings.fontSize}
                    onChange={(v) => settings.setSetting('fontSize', v)}
                    options={[
                      { value: 'small', label: 'Small' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'large', label: 'Large' },
                    ]}
                  />
                </SettingRow>

                <SettingRow label="Compact Mode" description="Reduce spacing">
                  <ToggleSwitch
                    checked={settings.compactMode}
                    onChange={(v) => settings.setSetting('compactMode', v)}
                  />
                </SettingRow>
              </div>
            )}

            {activeSection === 'chat' && (
              <div>
                <SettingRow label="Show Timestamps" description="Display message times">
                  <ToggleSwitch
                    checked={settings.showTimestamps}
                    onChange={(v) => settings.setSetting('showTimestamps', v)}
                  />
                </SettingRow>

                <SettingRow label="Timestamp Format" description="Time display format">
                  <SelectInput
                    value={settings.timestampFormat}
                    onChange={(v) => settings.setSetting('timestampFormat', v)}
                    options={[
                      { value: '12h', label: '12-hour' },
                      { value: '24h', label: '24-hour' },
                    ]}
                  />
                </SettingRow>

                <SettingRow label="Show Badges" description="User badges (mod, sub, VIP)">
                  <ToggleSwitch
                    checked={settings.showBadges}
                    onChange={(v) => settings.setSetting('showBadges', v)}
                  />
                </SettingRow>

                <SettingRow label="Show Emotes" description="Render emotes as images">
                  <ToggleSwitch
                    checked={settings.showEmotes}
                    onChange={(v) => settings.setSetting('showEmotes', v)}
                  />
                </SettingRow>

                <SettingRow label="Show Deleted Messages" description="Display deleted messages">
                  <ToggleSwitch
                    checked={settings.showDeletedMessages}
                    onChange={(v) => settings.setSetting('showDeletedMessages', v)}
                  />
                </SettingRow>
              </div>
            )}

            {activeSection === 'notifications' && (
              <div>
                <SettingRow label="Enable Notifications" description="Desktop notifications">
                  <ToggleSwitch
                    checked={settings.enableNotifications}
                    onChange={(v) => settings.setSetting('enableNotifications', v)}
                  />
                </SettingRow>

                <SettingRow label="Notify on Ban" description="Alert when user banned">
                  <ToggleSwitch
                    checked={settings.notifyOnBan}
                    onChange={(v) => settings.setSetting('notifyOnBan', v)}
                    disabled={!settings.enableNotifications}
                  />
                </SettingRow>

                <SettingRow label="Notify on Timeout" description="Alert when user timed out">
                  <ToggleSwitch
                    checked={settings.notifyOnTimeout}
                    onChange={(v) => settings.setSetting('notifyOnTimeout', v)}
                    disabled={!settings.enableNotifications}
                  />
                </SettingRow>

                <SettingRow label="Sound Effects" description="Play notification sounds">
                  <ToggleSwitch
                    checked={settings.soundEnabled}
                    onChange={(v) => settings.setSetting('soundEnabled', v)}
                    disabled={!settings.enableNotifications}
                  />
                </SettingRow>
              </div>
            )}

            {activeSection === 'liveFeed' && (
              <div>
                <SettingRow label="Auto-scroll" description="Scroll to new messages">
                  <ToggleSwitch
                    checked={settings.autoScroll}
                    onChange={(v) => settings.setSetting('autoScroll', v)}
                  />
                </SettingRow>

                <SettingRow label="Max Live Messages" description="Messages to keep in memory">
                  <SelectInput
                    value={settings.maxLiveMessages.toString()}
                    onChange={(v) => settings.setSetting('maxLiveMessages', parseInt(v))}
                    options={[
                      { value: '100', label: '100' },
                      { value: '250', label: '250' },
                      { value: '500', label: '500' },
                      { value: '1000', label: '1000' },
                    ]}
                  />
                </SettingRow>

                <SettingRow label="Pause on Hover" description="Pause when hovering messages">
                  <ToggleSwitch
                    checked={settings.pauseOnHover}
                    onChange={(v) => settings.setSetting('pauseOnHover', v)}
                  />
                </SettingRow>

                <SettingRow label="Highlight Mentions" description="Highlight @mentions">
                  <ToggleSwitch
                    checked={settings.highlightMentions}
                    onChange={(v) => settings.setSetting('highlightMentions', v)}
                  />
                </SettingRow>
              </div>
            )}

            {activeSection === 'sidebar' && (
              <div>
                <SettingRow label="Collapsed by Default" description="Start with sidebar collapsed">
                  <ToggleSwitch
                    checked={settings.sidebarCollapsed}
                    onChange={(v) => settings.setSetting('sidebarCollapsed', v)}
                  />
                </SettingRow>

                <SettingRow label="Show Channel Previews" description="Channel info on hover">
                  <ToggleSwitch
                    checked={settings.showChannelPreviews}
                    onChange={(v) => settings.setSetting('showChannelPreviews', v)}
                  />
                </SettingRow>
              </div>
            )}

            {activeSection === 'data' && (
              <div>
                <SettingRow label="Default Time Range" description="Default search filter">
                  <SelectInput
                    value={settings.defaultTimeRange}
                    onChange={(v) => settings.setSetting('defaultTimeRange', v)}
                    options={[
                      { value: '1h', label: 'Last hour' },
                      { value: '24h', label: 'Last 24 hours' },
                      { value: '7d', label: 'Last 7 days' },
                      { value: '30d', label: 'Last 30 days' },
                      { value: 'all', label: 'All time' },
                    ]}
                  />
                </SettingRow>

                <SettingRow label="Results Per Page" description="Items per page">
                  <SelectInput
                    value={settings.resultsPerPage.toString()}
                    onChange={(v) => settings.setSetting('resultsPerPage', parseInt(v))}
                    options={[
                      { value: '25', label: '25' },
                      { value: '50', label: '50' },
                      { value: '100', label: '100' },
                    ]}
                  />
                </SettingRow>

                <div className="mt-6 pt-4 border-t border-gray-700">
                  <h4 className="text-sm font-medium text-white mb-3">Data Management</h4>
                  <button
                    onClick={() => {
                      localStorage.removeItem('chatterbox-recent-searches');
                      toast.success('Search history cleared');
                    }}
                    className="w-full text-left px-3 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors text-sm"
                  >
                    <p className="text-white">Clear Search History</p>
                    <p className="text-xs text-gray-400">Remove recent searches</p>
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'security' && (
              <div>
                <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-sm text-yellow-400">
                    🔐 The API key is required for sensitive operations like adding/removing channels. Keep it secret!
                  </p>
                </div>

                <SettingRow label="API Key" description="Authentication key for channel management">
                  <input
                    type="password"
                    value={settings.apiKey}
                    onChange={(e) => settings.setSetting('apiKey', e.target.value)}
                    placeholder="Enter your API key"
                    className="w-64 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-twitch-purple"
                  />
                </SettingRow>

                <div className="mt-6 pt-4 border-t border-gray-700">
                  <h4 className="text-sm font-medium text-white mb-3">Security Actions</h4>
                  <button
                    onClick={() => {
                      settings.setSetting('apiKey', '');
                      toast.success('API key cleared');
                    }}
                    className="w-full text-left px-3 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors text-sm"
                  >
                    <p className="text-white">Clear API Key</p>
                    <p className="text-xs text-gray-400">Remove stored API key from this browser</p>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
