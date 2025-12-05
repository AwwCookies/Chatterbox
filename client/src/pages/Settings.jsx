import { useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useToast } from '../stores/toastStore';
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
  Monitor
} from 'lucide-react';

const sections = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'chat', label: 'Chat Display', icon: MessageSquare },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'liveFeed', label: 'Live Feed', icon: Radio },
  { id: 'sidebar', label: 'Sidebar', icon: LayoutDashboard },
  { id: 'data', label: 'Data & Storage', icon: Database },
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
    <div className="flex items-center justify-between py-4 border-b border-gray-700/50 last:border-0">
      <div className="flex-1 pr-4">
        <p className="text-white font-medium">{label}</p>
        {description && (
          <p className="text-sm text-gray-400 mt-0.5">{description}</p>
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
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
            value === themeValue
              ? 'bg-twitch-purple/20 border-twitch-purple text-white'
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
          }`}
        >
          <Icon className="w-4 h-4" />
          <span className="text-sm">{label}</span>
          {value === themeValue && <Check className="w-4 h-4 text-twitch-purple" />}
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
    <div className="flex gap-2">
      {colors.map(({ value: colorValue, color }) => (
        <button
          key={colorValue}
          onClick={() => onChange(colorValue)}
          className={`w-8 h-8 rounded-full ${color} flex items-center justify-center transition-transform ${
            value === colorValue ? 'ring-2 ring-offset-2 ring-offset-twitch-gray ring-white scale-110' : 'hover:scale-105'
          }`}
        >
          {value === colorValue && <Check className="w-4 h-4 text-white" />}
        </button>
      ))}
    </div>
  );
}

function Settings() {
  const [activeSection, setActiveSection] = useState('appearance');
  const settings = useSettingsStore();
  const toast = useToast();

  const handleResetSection = () => {
    settings.resetCategory(activeSection);
    toast.success(`${sections.find(s => s.id === activeSection)?.label} settings reset to defaults`);
  };

  const handleResetAll = () => {
    settings.resetSettings();
    toast.success('All settings reset to defaults');
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="w-8 h-8 text-twitch-purple" />
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-gray-400">Customize your Chatterbox experience</p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <nav className="w-56 flex-shrink-0">
          <ul className="space-y-1">
            {sections.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <button
                  onClick={() => setActiveSection(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                    activeSection === id
                      ? 'bg-twitch-purple/20 text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{label}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-8 pt-4 border-t border-gray-700">
            <button
              onClick={handleResetAll}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset All Settings</span>
            </button>
          </div>
        </nav>

        {/* Settings Content */}
        <div className="flex-1 bg-twitch-gray rounded-lg border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">
              {sections.find(s => s.id === activeSection)?.label}
            </h2>
            <button
              onClick={handleResetSection}
              className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>

          {activeSection === 'appearance' && (
            <div>
              <SettingRow
                label="Theme"
                description="Choose your preferred color scheme"
              >
                <ThemeSelector
                  value={settings.theme}
                  onChange={(v) => settings.setSetting('theme', v)}
                />
              </SettingRow>

              <SettingRow
                label="Accent Color"
                description="Primary color for buttons and highlights"
              >
                <AccentColorSelector
                  value={settings.accentColor}
                  onChange={(v) => settings.setSetting('accentColor', v)}
                />
              </SettingRow>

              <SettingRow
                label="Font Size"
                description="Text size throughout the application"
              >
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

              <SettingRow
                label="Compact Mode"
                description="Reduce spacing for a denser layout"
              >
                <ToggleSwitch
                  checked={settings.compactMode}
                  onChange={(v) => settings.setSetting('compactMode', v)}
                />
              </SettingRow>
            </div>
          )}

          {activeSection === 'chat' && (
            <div>
              <SettingRow
                label="Show Timestamps"
                description="Display message timestamps"
              >
                <ToggleSwitch
                  checked={settings.showTimestamps}
                  onChange={(v) => settings.setSetting('showTimestamps', v)}
                />
              </SettingRow>

              <SettingRow
                label="Timestamp Format"
                description="How timestamps are displayed"
              >
                <SelectInput
                  value={settings.timestampFormat}
                  onChange={(v) => settings.setSetting('timestampFormat', v)}
                  options={[
                    { value: '12h', label: '12-hour (1:30 PM)' },
                    { value: '24h', label: '24-hour (13:30)' },
                  ]}
                />
              </SettingRow>

              <SettingRow
                label="Show Badges"
                description="Display user badges (sub, mod, VIP)"
              >
                <ToggleSwitch
                  checked={settings.showBadges}
                  onChange={(v) => settings.setSetting('showBadges', v)}
                />
              </SettingRow>

              <SettingRow
                label="Show Emotes"
                description="Render emotes as images"
              >
                <ToggleSwitch
                  checked={settings.showEmotes}
                  onChange={(v) => settings.setSetting('showEmotes', v)}
                />
              </SettingRow>

              <SettingRow
                label="Show Deleted Messages"
                description="Display messages that were deleted"
              >
                <ToggleSwitch
                  checked={settings.showDeletedMessages}
                  onChange={(v) => settings.setSetting('showDeletedMessages', v)}
                />
              </SettingRow>

              <SettingRow
                label="Message Grouping"
                description="Group consecutive messages from the same user"
              >
                <ToggleSwitch
                  checked={settings.messageGrouping}
                  onChange={(v) => settings.setSetting('messageGrouping', v)}
                />
              </SettingRow>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div>
              <SettingRow
                label="Enable Notifications"
                description="Show desktop notifications"
              >
                <ToggleSwitch
                  checked={settings.enableNotifications}
                  onChange={(v) => settings.setSetting('enableNotifications', v)}
                />
              </SettingRow>

              <SettingRow
                label="Notify on Ban"
                description="Alert when a user is banned"
              >
                <ToggleSwitch
                  checked={settings.notifyOnBan}
                  onChange={(v) => settings.setSetting('notifyOnBan', v)}
                  disabled={!settings.enableNotifications}
                />
              </SettingRow>

              <SettingRow
                label="Notify on Timeout"
                description="Alert when a user is timed out"
              >
                <ToggleSwitch
                  checked={settings.notifyOnTimeout}
                  onChange={(v) => settings.setSetting('notifyOnTimeout', v)}
                  disabled={!settings.enableNotifications}
                />
              </SettingRow>

              <SettingRow
                label="Sound Effects"
                description="Play sounds for notifications"
              >
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
              <SettingRow
                label="Auto-scroll"
                description="Automatically scroll to new messages"
              >
                <ToggleSwitch
                  checked={settings.autoScroll}
                  onChange={(v) => settings.setSetting('autoScroll', v)}
                />
              </SettingRow>

              <SettingRow
                label="Max Live Messages"
                description="Maximum messages to keep in live feed"
              >
                <SelectInput
                  value={settings.maxLiveMessages.toString()}
                  onChange={(v) => settings.setSetting('maxLiveMessages', parseInt(v))}
                  options={[
                    { value: '100', label: '100 messages' },
                    { value: '250', label: '250 messages' },
                    { value: '500', label: '500 messages' },
                    { value: '1000', label: '1000 messages' },
                  ]}
                />
              </SettingRow>

              <SettingRow
                label="Pause on Hover"
                description="Pause auto-scroll when hovering over messages"
              >
                <ToggleSwitch
                  checked={settings.pauseOnHover}
                  onChange={(v) => settings.setSetting('pauseOnHover', v)}
                />
              </SettingRow>

              <SettingRow
                label="Highlight Mentions"
                description="Highlight messages that mention users"
              >
                <ToggleSwitch
                  checked={settings.highlightMentions}
                  onChange={(v) => settings.setSetting('highlightMentions', v)}
                />
              </SettingRow>
            </div>
          )}

          {activeSection === 'sidebar' && (
            <div>
              <SettingRow
                label="Collapsed by Default"
                description="Start with sidebar collapsed"
              >
                <ToggleSwitch
                  checked={settings.sidebarCollapsed}
                  onChange={(v) => settings.setSetting('sidebarCollapsed', v)}
                />
              </SettingRow>

              <SettingRow
                label="Show Channel Previews"
                description="Display channel info on hover"
              >
                <ToggleSwitch
                  checked={settings.showChannelPreviews}
                  onChange={(v) => settings.setSetting('showChannelPreviews', v)}
                />
              </SettingRow>
            </div>
          )}

          {activeSection === 'data' && (
            <div>
              <SettingRow
                label="Default Time Range"
                description="Default filter for message searches"
              >
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

              <SettingRow
                label="Results Per Page"
                description="Number of items shown per page"
              >
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

              <div className="mt-8 pt-6 border-t border-gray-700">
                <h3 className="text-white font-medium mb-4">Data Management</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      localStorage.removeItem('chatterbox-recent-searches');
                      toast.success('Search history cleared');
                    }}
                    className="w-full text-left px-4 py-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <p className="text-white">Clear Search History</p>
                    <p className="text-sm text-gray-400">Remove recent searches from quick access</p>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Settings;
