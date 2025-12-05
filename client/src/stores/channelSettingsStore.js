import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Default settings for each channel page
 * These are local settings that persist per-channel
 */
const defaultChannelSettings = {
  // Link filtering
  excludedUsers: [], // Usernames to exclude from links display
  excludedPlatforms: [], // Platforms to exclude: 'youtube', 'twitter', 'tiktok', etc.
  minLinkShares: 1, // Minimum shares to show a link
  hideNSFWLinks: false, // Hide links flagged as NSFW (if detected)
  
  // Link display
  defaultLinkView: 'grid', // 'grid' | 'list'
  defaultLinkSort: 'count', // 'count' | 'recent' | 'users'
  linksPerPage: 50,
  autoLoadPreviews: true, // Auto-fetch link previews
  
  // Live feed
  excludedUsersFromFeed: [], // Hide messages from these users in live feed
  highlightUsers: [], // Usernames to highlight in feed
  highlightColor: '#9147ff', // Color for highlighted users
  muteKeywords: [], // Keywords to filter/blur
  showBotMessages: true, // Show messages from known bots
  
  // Mod actions
  showAutoModActions: true, // Show AutoMod actions
  excludedModActions: [], // Action types to hide: 'delete', 'timeout', 'ban'
  
  // UI preferences
  defaultTab: 'live', // Default tab when visiting channel
  linkPanelCollapsed: false,
  modPanelCollapsed: false,
  compactMessages: false,
  
  // Notifications (per-channel)
  notifyOnLive: false, // Notify when channel goes live (future)
  notifyOnKeyword: [], // Keywords to trigger notifications
};

/**
 * Store for channel-specific local settings
 * Settings are stored per-channel using the channel name as key
 */
export const useChannelSettingsStore = create(
  persist(
    (set, get) => ({
      // Map of channel name -> settings
      channels: {},
      
      /**
       * Get settings for a specific channel
       * Returns default settings merged with any saved settings
       */
      getChannelSettings: (channelName) => {
        const normalized = channelName?.toLowerCase();
        const saved = get().channels[normalized] || {};
        return { ...defaultChannelSettings, ...saved };
      },
      
      /**
       * Update a single setting for a channel
       */
      setChannelSetting: (channelName, key, value) => {
        const normalized = channelName?.toLowerCase();
        set((state) => ({
          channels: {
            ...state.channels,
            [normalized]: {
              ...(state.channels[normalized] || {}),
              [key]: value,
            },
          },
        }));
      },
      
      /**
       * Update multiple settings for a channel
       */
      setChannelSettings: (channelName, settings) => {
        const normalized = channelName?.toLowerCase();
        set((state) => ({
          channels: {
            ...state.channels,
            [normalized]: {
              ...(state.channels[normalized] || {}),
              ...settings,
            },
          },
        }));
      },
      
      /**
       * Reset a channel's settings to defaults
       */
      resetChannelSettings: (channelName) => {
        const normalized = channelName?.toLowerCase();
        set((state) => {
          const { [normalized]: _, ...rest } = state.channels;
          return { channels: rest };
        });
      },
      
      /**
       * Add a user to the excluded list for links
       */
      excludeUserFromLinks: (channelName, username) => {
        const normalized = channelName?.toLowerCase();
        const current = get().getChannelSettings(normalized);
        const lowerUser = username.toLowerCase();
        if (!current.excludedUsers.includes(lowerUser)) {
          get().setChannelSetting(normalized, 'excludedUsers', [...current.excludedUsers, lowerUser]);
        }
      },
      
      /**
       * Remove a user from the excluded list for links
       */
      unexcludeUserFromLinks: (channelName, username) => {
        const normalized = channelName?.toLowerCase();
        const current = get().getChannelSettings(normalized);
        const lowerUser = username.toLowerCase();
        get().setChannelSetting(
          normalized, 
          'excludedUsers', 
          current.excludedUsers.filter(u => u !== lowerUser)
        );
      },
      
      /**
       * Add a user to the excluded list for feed
       */
      excludeUserFromFeed: (channelName, username) => {
        const normalized = channelName?.toLowerCase();
        const current = get().getChannelSettings(normalized);
        const lowerUser = username.toLowerCase();
        if (!current.excludedUsersFromFeed.includes(lowerUser)) {
          get().setChannelSetting(normalized, 'excludedUsersFromFeed', [...current.excludedUsersFromFeed, lowerUser]);
        }
      },
      
      /**
       * Remove a user from the excluded list for feed
       */
      unexcludeUserFromFeed: (channelName, username) => {
        const normalized = channelName?.toLowerCase();
        const current = get().getChannelSettings(normalized);
        const lowerUser = username.toLowerCase();
        get().setChannelSetting(
          normalized, 
          'excludedUsersFromFeed', 
          current.excludedUsersFromFeed.filter(u => u !== lowerUser)
        );
      },
      
      /**
       * Add a user to the highlight list
       */
      addHighlightUser: (channelName, username) => {
        const normalized = channelName?.toLowerCase();
        const current = get().getChannelSettings(normalized);
        const lowerUser = username.toLowerCase();
        if (!current.highlightUsers.includes(lowerUser)) {
          get().setChannelSetting(normalized, 'highlightUsers', [...current.highlightUsers, lowerUser]);
        }
      },
      
      /**
       * Remove a user from the highlight list
       */
      removeHighlightUser: (channelName, username) => {
        const normalized = channelName?.toLowerCase();
        const current = get().getChannelSettings(normalized);
        const lowerUser = username.toLowerCase();
        get().setChannelSetting(
          normalized, 
          'highlightUsers', 
          current.highlightUsers.filter(u => u !== lowerUser)
        );
      },
      
      /**
       * Add a muted keyword
       */
      addMutedKeyword: (channelName, keyword) => {
        const normalized = channelName?.toLowerCase();
        const current = get().getChannelSettings(normalized);
        const lowerKeyword = keyword.toLowerCase();
        if (!current.muteKeywords.includes(lowerKeyword)) {
          get().setChannelSetting(normalized, 'muteKeywords', [...current.muteKeywords, lowerKeyword]);
        }
      },
      
      /**
       * Remove a muted keyword
       */
      removeMutedKeyword: (channelName, keyword) => {
        const normalized = channelName?.toLowerCase();
        const current = get().getChannelSettings(normalized);
        const lowerKeyword = keyword.toLowerCase();
        get().setChannelSetting(
          normalized, 
          'muteKeywords', 
          current.muteKeywords.filter(k => k !== lowerKeyword)
        );
      },
      
      /**
       * Toggle a platform filter
       */
      togglePlatformFilter: (channelName, platform) => {
        const normalized = channelName?.toLowerCase();
        const current = get().getChannelSettings(normalized);
        const lowerPlatform = platform.toLowerCase();
        if (current.excludedPlatforms.includes(lowerPlatform)) {
          get().setChannelSetting(
            normalized, 
            'excludedPlatforms', 
            current.excludedPlatforms.filter(p => p !== lowerPlatform)
          );
        } else {
          get().setChannelSetting(normalized, 'excludedPlatforms', [...current.excludedPlatforms, lowerPlatform]);
        }
      },
      
      /**
       * Get default settings (for reference)
       */
      getDefaults: () => defaultChannelSettings,
    }),
    {
      name: 'chatterbox-channel-settings',
      version: 1,
    }
  )
);
