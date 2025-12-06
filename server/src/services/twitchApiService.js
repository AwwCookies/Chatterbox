import logger from '../utils/logger.js';

/**
 * Service to interact with Twitch Helix API
 * Provides stream status, user info, etc.
 */
class TwitchApiService {
  constructor() {
    this.clientId = process.env.TWITCH_CLIENT_ID;
    this.clientSecret = process.env.TWITCH_CLIENT_SECRET;
    this.accessToken = null;
    this.tokenExpiry = null;
    this.streamCache = new Map(); // channelName -> { isLive, viewerCount, title, gameName, startedAt, thumbnailUrl }
    this.userCache = new Map(); // channelName -> { id, login, displayName, profileImageUrl, description }
    this.cacheExpiry = 60000; // 1 minute cache for streams
    this.userCacheExpiry = 3600000; // 1 hour cache for user profiles
    this.lastCacheUpdate = 0;
  }

  /**
   * Check if Twitch API is configured
   */
  isConfigured() {
    return !!(this.clientId && this.clientSecret);
  }

  /**
   * Get OAuth App Access Token
   */
  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!this.isConfigured()) {
      logger.debug('Twitch API not configured (missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET)');
      return null;
    }

    try {
      const response = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials',
        }),
      });

      if (!response.ok) {
        throw new Error(`Token request failed: ${response.status}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      // Token expires in `expires_in` seconds, refresh 5 minutes early
      this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
      
      logger.info('Twitch API access token acquired');
      return this.accessToken;
    } catch (error) {
      logger.error('Failed to get Twitch access token:', error.message);
      return null;
    }
  }

  /**
   * Make authenticated request to Twitch Helix API
   */
  async apiRequest(endpoint, params = {}) {
    const token = await this.getAccessToken();
    if (!token) return null;

    const url = new URL(`https://api.twitch.tv/helix${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(key, v));
      } else {
        url.searchParams.append(key, value);
      }
    });

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Client-Id': this.clientId,
        },
      });

      if (response.status === 401) {
        // Token expired, clear and retry once
        this.accessToken = null;
        this.tokenExpiry = null;
        return this.apiRequest(endpoint, params);
      }

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      logger.error(`Twitch API request failed (${endpoint}):`, error.message);
      return null;
    }
  }

  /**
   * Get users by login names
   */
  async getUsers(logins) {
    if (!logins || logins.length === 0) return [];
    
    const data = await this.apiRequest('/users', { login: logins });
    return data?.data || [];
  }

  /**
   * Get user profile info (with caching)
   */
  async getUserProfile(login) {
    const nameLower = login.toLowerCase();
    const cached = this.userCache.get(nameLower);
    
    if (cached && Date.now() - cached.updatedAt < this.userCacheExpiry) {
      return cached;
    }

    const users = await this.getUsers([login]);
    if (users.length === 0) return null;

    const user = users[0];
    const profile = {
      id: user.id,
      login: user.login,
      displayName: user.display_name,
      profileImageUrl: user.profile_image_url,
      description: user.description,
      updatedAt: Date.now(),
    };

    this.userCache.set(nameLower, profile);
    return profile;
  }

  /**
   * Get multiple user profiles (with caching)
   */
  async getUserProfiles(logins) {
    if (!logins || logins.length === 0) return {};

    const result = {};
    const uncached = [];

    // Check cache first
    for (const login of logins) {
      const nameLower = login.toLowerCase();
      const cached = this.userCache.get(nameLower);
      if (cached && Date.now() - cached.updatedAt < this.userCacheExpiry) {
        result[nameLower] = cached;
      } else {
        uncached.push(login);
      }
    }

    // Fetch uncached users
    if (uncached.length > 0) {
      const users = await this.getUsers(uncached);
      for (const user of users) {
        const profile = {
          id: user.id,
          login: user.login,
          displayName: user.display_name,
          profileImageUrl: user.profile_image_url,
          description: user.description,
          updatedAt: Date.now(),
        };
        const nameLower = user.login.toLowerCase();
        this.userCache.set(nameLower, profile);
        result[nameLower] = profile;
      }
    }

    return result;
  }

  /**
   * Get live streams for given user logins
   */
  async getStreams(userLogins) {
    if (!userLogins || userLogins.length === 0) return [];
    
    // Twitch API allows max 100 per request
    const batches = [];
    for (let i = 0; i < userLogins.length; i += 100) {
      batches.push(userLogins.slice(i, i + 100));
    }

    const allStreams = [];
    for (const batch of batches) {
      const data = await this.apiRequest('/streams', { user_login: batch });
      if (data?.data) {
        allStreams.push(...data.data);
      }
    }

    return allStreams;
  }

  /**
   * Update live status cache for given channels
   */
  async updateStreamCache(channelNames) {
    if (!this.isConfigured() || !channelNames || channelNames.length === 0) {
      return;
    }

    // Don't update more than once per 30 seconds
    if (Date.now() - this.lastCacheUpdate < 30000) {
      return;
    }

    try {
      const streams = await this.getStreams(channelNames);
      const liveChannels = new Set(streams.map(s => s.user_login.toLowerCase()));

      // Update cache
      channelNames.forEach(name => {
        const nameLower = name.toLowerCase();
        const stream = streams.find(s => s.user_login.toLowerCase() === nameLower);
        
        if (stream) {
          this.streamCache.set(nameLower, {
            isLive: true,
            viewerCount: stream.viewer_count,
            title: stream.title,
            gameName: stream.game_name,
            startedAt: stream.started_at,
            thumbnailUrl: stream.thumbnail_url,
            updatedAt: Date.now(),
          });
        } else {
          this.streamCache.set(nameLower, {
            isLive: false,
            viewerCount: 0,
            title: null,
            gameName: null,
            startedAt: null,
            thumbnailUrl: null,
            updatedAt: Date.now(),
          });
        }
      });

      this.lastCacheUpdate = Date.now();
      logger.debug(`Updated stream cache: ${liveChannels.size}/${channelNames.length} live`);
    } catch (error) {
      logger.error('Failed to update stream cache:', error.message);
    }
  }

  /**
   * Get cached stream status for a channel
   */
  getStreamStatus(channelName) {
    const cached = this.streamCache.get(channelName.toLowerCase());
    if (!cached || Date.now() - cached.updatedAt > this.cacheExpiry) {
      return null;
    }
    return cached;
  }

  /**
   * Get live status for multiple channels (from cache)
   */
  getStreamStatuses(channelNames) {
    const result = {};
    channelNames.forEach(name => {
      const status = this.getStreamStatus(name);
      result[name.toLowerCase()] = status || { isLive: false };
    });
    return result;
  }

  /**
   * Force refresh stream status for channels
   */
  async refreshStreamStatus(channelNames) {
    this.lastCacheUpdate = 0; // Force cache refresh
    await this.updateStreamCache(channelNames);
    return this.getStreamStatuses(channelNames);
  }
}

// Singleton
const twitchApiService = new TwitchApiService();
export default twitchApiService;
