import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const defaultSettings = {
  // Appearance
  theme: 'dark', // 'dark' | 'light' | 'system'
  accentColor: 'purple', // 'purple' | 'blue' | 'green' | 'pink' | 'orange'
  fontSize: 'medium', // 'small' | 'medium' | 'large'
  compactMode: false,
  
  // Chat display
  showTimestamps: true,
  timestampFormat: '12h', // '12h' | '24h'
  showBadges: true,
  showEmotes: true,
  showDeletedMessages: true,
  messageGrouping: true, // Group messages from same user
  
  // Notifications
  enableNotifications: false,
  notifyOnBan: true,
  notifyOnTimeout: true,
  notifyOnMention: false,
  soundEnabled: false,
  
  // Live Feed
  autoScroll: true,
  maxLiveMessages: 500,
  pauseOnHover: true,
  highlightMentions: true,
  
  // Sidebar
  sidebarCollapsed: false,
  showChannelPreviews: true,
  
  // Data
  defaultTimeRange: '24h', // '1h' | '24h' | '7d' | '30d' | 'all'
  resultsPerPage: 50,
  
  // Security
  apiKey: '', // API key for authenticated requests
};

export const useSettingsStore = create(
  persist(
    (set, get) => ({
      ...defaultSettings,
      
      // Update a single setting
      setSetting: (key, value) => set({ [key]: value }),
      
      // Update multiple settings
      setSettings: (settings) => set(settings),
      
      // Reset all settings to default
      resetSettings: () => set(defaultSettings),
      
      // Reset a category of settings
      resetCategory: (category) => {
        const categoryDefaults = {};
        const categoryKeys = {
          appearance: ['theme', 'accentColor', 'fontSize', 'compactMode'],
          chat: ['showTimestamps', 'timestampFormat', 'showBadges', 'showEmotes', 'showDeletedMessages', 'messageGrouping'],
          notifications: ['enableNotifications', 'notifyOnBan', 'notifyOnTimeout', 'notifyOnMention', 'soundEnabled'],
          liveFeed: ['autoScroll', 'maxLiveMessages', 'pauseOnHover', 'highlightMentions'],
          sidebar: ['sidebarCollapsed', 'showChannelPreviews'],
          data: ['defaultTimeRange', 'resultsPerPage'],
          security: ['apiKey'],
        };
        
        (categoryKeys[category] || []).forEach(key => {
          categoryDefaults[key] = defaultSettings[key];
        });
        
        set(categoryDefaults);
      },
      
      // Toggle boolean settings
      toggleSetting: (key) => {
        const current = get()[key];
        if (typeof current === 'boolean') {
          set({ [key]: !current });
        }
      },
    }),
    {
      name: 'chatterbox-settings',
      version: 1,
    }
  )
);
