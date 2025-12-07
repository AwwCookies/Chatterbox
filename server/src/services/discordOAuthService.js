import logger from '../utils/logger.js';
import { query } from '../config/database.js';

/**
 * Discord OAuth Service
 * Handles Discord OAuth2 authentication, token management, and API calls
 * Uses bot token for channel fetching, user OAuth for permission verification
 */
class DiscordOAuthService {
  constructor() {
    this.clientId = process.env.DISCORD_CLIENT_ID;
    this.clientSecret = process.env.DISCORD_CLIENT_SECRET;
    this.redirectUri = process.env.DISCORD_REDIRECT_URI || 'https://api-chatterbox.calicos.art/api/discord/callback';
    this.botToken = process.env.DISCORD_BOT_TOKEN;
    this.scopes = ['identify', 'guilds'];
    
    // Rate limiting
    this.rateLimitBuckets = new Map();
    
    // Permission bits
    this.MANAGE_WEBHOOKS = BigInt(0x20000000);
    this.ADMINISTRATOR = BigInt(0x8);
  }

  /**
   * Check if Discord OAuth is configured
   */
  isConfigured() {
    return !!(this.clientId && this.clientSecret);
  }

  /**
   * Check if bot token is configured (needed for channel fetching)
   */
  isBotConfigured() {
    return !!this.botToken;
  }

  /**
   * Generate OAuth authorization URL for account linking
   */
  getAuthorizationUrl(state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scopes.join(' '),
      state: state,
      prompt: 'consent', // Always show consent screen
    });

    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code) {
    try {
      const response = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.redirectUri,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        logger.error('Discord token exchange failed:', error);
        throw new Error(error.error_description || 'Token exchange failed');
      }

      const tokens = await response.json();
      
      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
        tokenType: tokens.token_type,
        scope: tokens.scope,
      };
    } catch (error) {
      logger.error('Discord token exchange error:', error);
      throw error;
    }
  }

  /**
   * Refresh Discord access token
   */
  async refreshTokens(refreshToken) {
    try {
      const response = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        logger.error('Discord token refresh failed:', error);
        throw new Error(error.error_description || 'Token refresh failed');
      }

      const tokens = await response.json();
      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
      };
    } catch (error) {
      logger.error('Discord token refresh error:', error);
      throw error;
    }
  }

  /**
   * Revoke Discord OAuth token
   */
  async revokeToken(accessToken) {
    try {
      const response = await fetch('https://discord.com/api/oauth2/token/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          token: accessToken,
        }),
      });

      return response.ok;
    } catch (error) {
      logger.error('Discord token revocation error:', error);
      return false;
    }
  }

  /**
   * Get valid Discord access token for a user (refreshes if needed)
   */
  async getValidAccessToken(userId) {
    const result = await query(
      `SELECT discord_access_token, discord_refresh_token, discord_token_expires_at 
       FROM oauth_users WHERE id = $1 AND discord_id IS NOT NULL`,
      [userId]
    );

    if (!result.rows[0]) {
      throw new Error('Discord not connected');
    }

    const user = result.rows[0];
    const expiresAt = new Date(user.discord_token_expires_at);
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

    // Token still valid
    if (expiresAt > fiveMinutesFromNow) {
      return user.discord_access_token;
    }

    // Token expired or expiring soon, refresh it
    try {
      const tokens = await this.refreshTokens(user.discord_refresh_token);
      
      // Update tokens in database
      await this.updateUserTokens(userId, tokens);
      
      return tokens.accessToken;
    } catch (error) {
      logger.error('Failed to refresh Discord token:', error);
      throw new Error('Discord token expired - please reconnect');
    }
  }

  /**
   * Update user's Discord tokens in database
   */
  async updateUserTokens(userId, tokens) {
    const tokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
    
    await query(
      `UPDATE oauth_users SET 
         discord_access_token = $2,
         discord_refresh_token = $3,
         discord_token_expires_at = $4
       WHERE id = $1`,
      [userId, tokens.accessToken, tokens.refreshToken, tokenExpiresAt]
    );
  }

  /**
   * Make a Discord API request with rate limiting (using Bearer token)
   */
  async discordApiRequest(accessToken, endpoint, options = {}) {
    return this._makeDiscordRequest(`Bearer ${accessToken}`, endpoint, options);
  }

  /**
   * Make a Discord API request using the bot token
   */
  async discordBotRequest(endpoint, options = {}) {
    if (!this.botToken) {
      throw new Error('Discord bot token not configured');
    }
    return this._makeDiscordRequest(`Bot ${this.botToken}`, endpoint, options);
  }

  /**
   * Internal method for Discord API requests with rate limiting
   */
  async _makeDiscordRequest(authorization, endpoint, options = {}) {
    const url = `https://discord.com/api/v10${endpoint}`;
    
    // Handle rate limiting
    const bucket = this.rateLimitBuckets.get(endpoint);
    if (bucket && bucket.resetAt > Date.now() && bucket.remaining <= 0) {
      const waitTime = bucket.resetAt - Date.now();
      logger.debug(`Rate limited on ${endpoint}, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Update rate limit tracking
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const resetAfter = response.headers.get('X-RateLimit-Reset-After');
    if (remaining !== null && resetAfter !== null) {
      this.rateLimitBuckets.set(endpoint, {
        remaining: parseInt(remaining, 10),
        resetAt: Date.now() + parseFloat(resetAfter) * 1000,
      });
    }

    // Handle rate limiting (429)
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || 5;
      logger.warn(`Discord rate limit hit on ${endpoint}, retrying after ${retryAfter}s`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return this._makeDiscordRequest(authorization, endpoint, options);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const errorMessage = error.message || `Discord API error: ${response.status}`;
      logger.error(`Discord API error on ${endpoint}:`, { status: response.status, error });
      
      const err = new Error(errorMessage);
      err.status = response.status;
      err.code = error.code;
      throw err;
    }

    return response.json();
  }

  /**
   * Get Discord user info
   */
  async getDiscordUser(accessToken) {
    return this.discordApiRequest(accessToken, '/users/@me');
  }

  /**
   * Get user's Discord guilds
   */
  async getUserGuilds(accessToken) {
    return this.discordApiRequest(accessToken, '/users/@me/guilds');
  }

  /**
   * Get channels in a guild using bot token
   */
  async getGuildChannels(guildId) {
    return this.discordBotRequest(`/guilds/${guildId}/channels`);
  }

  /**
   * Create a webhook in a channel using bot token
   */
  async createWebhookWithBot(channelId, name, avatarUrl = null) {
    const body = { name };
    
    if (avatarUrl) {
      // For now, skip avatar - would need to fetch and base64 encode
    }

    return this.discordBotRequest(`/channels/${channelId}/webhooks`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Get channels in a guild (legacy - uses user token, but likely to fail)
   * @deprecated Use getGuildChannels(guildId) with bot token instead
   */
  async getGuildChannelsWithUserToken(accessToken, guildId) {
    return this.discordApiRequest(accessToken, `/guilds/${guildId}/channels`);
  }

  /**
   * Create a webhook in a channel
   */
  async createWebhook(accessToken, channelId, name, avatarUrl = null) {
    const body = { name };
    
    // Discord requires avatar as base64 data URI, so skip if URL provided
    // In a full implementation, you'd fetch and convert the image
    
    return this.discordApiRequest(accessToken, `/channels/${channelId}/webhooks`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId, webhookToken) {
    const response = await fetch(`https://discord.com/api/v10/webhooks/${webhookId}/${webhookToken}`, {
      method: 'DELETE',
    });

    if (!response.ok && response.status !== 404) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to delete webhook');
    }

    return true;
  }

  /**
   * Check if user has MANAGE_WEBHOOKS permission
   */
  hasManageWebhooksPermission(permissionsString) {
    if (!permissionsString) return false;
    
    try {
      const permissions = BigInt(permissionsString);
      // Check for ADMINISTRATOR (which grants all) or MANAGE_WEBHOOKS
      return (permissions & this.ADMINISTRATOR) === this.ADMINISTRATOR ||
             (permissions & this.MANAGE_WEBHOOKS) === this.MANAGE_WEBHOOKS;
    } catch {
      return false;
    }
  }

  /**
   * Store/update Discord connection in database
   */
  async saveDiscordConnection(userId, discordUser, tokens) {
    const tokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
    
    await query(
      `UPDATE oauth_users SET 
         discord_id = $2,
         discord_username = $3,
         discord_discriminator = $4,
         discord_avatar = $5,
         discord_access_token = $6,
         discord_refresh_token = $7,
         discord_token_expires_at = $8,
         discord_connected_at = NOW()
       WHERE id = $1`,
      [
        userId,
        discordUser.id,
        discordUser.username,
        discordUser.discriminator || '0',
        discordUser.avatar,
        tokens.accessToken,
        tokens.refreshToken,
        tokenExpiresAt,
      ]
    );
  }

  /**
   * Remove Discord connection from database
   */
  async removeDiscordConnection(userId) {
    await query(
      `UPDATE oauth_users SET 
         discord_id = NULL,
         discord_username = NULL,
         discord_discriminator = NULL,
         discord_avatar = NULL,
         discord_access_token = NULL,
         discord_refresh_token = NULL,
         discord_token_expires_at = NULL,
         discord_connected_at = NULL
       WHERE id = $1`,
      [userId]
    );

    // Clear cached guilds and channels
    await query('DELETE FROM user_discord_guilds WHERE oauth_user_id = $1', [userId]);
    await query('DELETE FROM user_discord_channels WHERE oauth_user_id = $1', [userId]);
  }

  /**
   * Get user's Discord connection status
   */
  async getDiscordStatus(userId) {
    const result = await query(
      `SELECT discord_id, discord_username, discord_discriminator, discord_avatar, discord_connected_at
       FROM oauth_users WHERE id = $1`,
      [userId]
    );

    const user = result.rows[0];
    if (!user || !user.discord_id) {
      return { connected: false };
    }

    // Count available guilds
    const guildsResult = await query(
      `SELECT COUNT(*) as count FROM user_discord_guilds 
       WHERE oauth_user_id = $1 AND has_webhook_permission = TRUE`,
      [userId]
    );

    const channelsResult = await query(
      `SELECT COUNT(*) as count FROM user_discord_channels WHERE oauth_user_id = $1`,
      [userId]
    );

    return {
      connected: true,
      discordId: user.discord_id,
      username: user.discord_username,
      discriminator: user.discord_discriminator,
      avatar: user.discord_avatar,
      connectedAt: user.discord_connected_at,
      avatarUrl: user.discord_avatar 
        ? `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.discord_avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discord_id) % 5}.png`,
      guildsCount: parseInt(guildsResult.rows[0]?.count || 0),
      channelsCount: parseInt(channelsResult.rows[0]?.count || 0),
    };
  }

  /**
   * Cache user's guilds
   */
  async cacheUserGuilds(userId, guilds) {
    // Clear existing cache
    await query('DELETE FROM user_discord_guilds WHERE oauth_user_id = $1', [userId]);

    // Filter and insert guilds where user has manage webhooks permission
    const validGuilds = guilds.filter(g => this.hasManageWebhooksPermission(g.permissions));

    if (validGuilds.length === 0) return [];

    const values = validGuilds.map((g, i) => {
      const offset = i * 7;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $5, $6, $7)`;
    }).join(', ');

    const params = [];
    validGuilds.forEach(g => {
      params.push(userId, g.id, g.name, g.icon);
    });

    // This needs to be done differently - insert each guild
    for (const guild of validGuilds) {
      await query(
        `INSERT INTO user_discord_guilds 
         (oauth_user_id, guild_id, guild_name, guild_icon, has_webhook_permission, owner, permissions)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (oauth_user_id, guild_id) DO UPDATE SET
           guild_name = EXCLUDED.guild_name,
           guild_icon = EXCLUDED.guild_icon,
           has_webhook_permission = EXCLUDED.has_webhook_permission,
           owner = EXCLUDED.owner,
           permissions = EXCLUDED.permissions,
           cached_at = NOW()`,
        [userId, guild.id, guild.name, guild.icon, true, guild.owner || false, guild.permissions]
      );
    }

    return validGuilds;
  }

  /**
   * Get cached guilds for a user
   */
  async getCachedGuilds(userId) {
    const result = await query(
      `SELECT guild_id, guild_name, guild_icon, has_webhook_permission, owner, permissions, cached_at
       FROM user_discord_guilds 
       WHERE oauth_user_id = $1 AND has_webhook_permission = TRUE
       ORDER BY guild_name`,
      [userId]
    );

    return result.rows.map(g => ({
      id: g.guild_id,
      name: g.guild_name,
      icon: g.guild_icon,
      hasWebhookPermission: g.has_webhook_permission,
      owner: g.owner,
      permissions: g.permissions,
      iconUrl: g.guild_icon 
        ? `https://cdn.discordapp.com/icons/${g.guild_id}/${g.guild_icon}.png`
        : null,
      cachedAt: g.cached_at,
    }));
  }

  /**
   * Check if user has access to a guild
   */
  async userHasGuildAccess(userId, guildId) {
    const result = await query(
      `SELECT 1 FROM user_discord_guilds 
       WHERE oauth_user_id = $1 AND guild_id = $2 AND has_webhook_permission = TRUE`,
      [userId, guildId]
    );
    return result.rows.length > 0;
  }

  /**
   * Cache channels for a guild
   */
  async cacheGuildChannels(userId, guildId, channels) {
    // Clear existing cache for this guild
    await query(
      'DELETE FROM user_discord_channels WHERE oauth_user_id = $1 AND guild_id = $2',
      [userId, guildId]
    );

    // Filter to text channels and announcement channels only
    // Type 0 = GUILD_TEXT, Type 5 = GUILD_ANNOUNCEMENT
    const validChannels = channels.filter(c => c.type === 0 || c.type === 5);

    // Get category names
    const categories = {};
    channels.filter(c => c.type === 4).forEach(c => {
      categories[c.id] = c.name;
    });

    for (const channel of validChannels) {
      await query(
        `INSERT INTO user_discord_channels 
         (oauth_user_id, guild_id, channel_id, channel_name, channel_type, position, parent_id, parent_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (oauth_user_id, channel_id) DO UPDATE SET
           channel_name = EXCLUDED.channel_name,
           channel_type = EXCLUDED.channel_type,
           position = EXCLUDED.position,
           parent_id = EXCLUDED.parent_id,
           parent_name = EXCLUDED.parent_name,
           cached_at = NOW()`,
        [userId, guildId, channel.id, channel.name, channel.type, channel.position, 
         channel.parent_id || null, channel.parent_id ? categories[channel.parent_id] || null : null]
      );
    }

    return validChannels;
  }

  /**
   * Get cached channels for a guild
   */
  async getCachedChannels(userId, guildId) {
    const result = await query(
      `SELECT channel_id, channel_name, channel_type, position, parent_id, parent_name, cached_at
       FROM user_discord_channels 
       WHERE oauth_user_id = $1 AND guild_id = $2
       ORDER BY position`,
      [userId, guildId]
    );

    return result.rows.map(c => ({
      id: c.channel_id,
      name: c.channel_name,
      type: c.channel_type,
      position: c.position,
      parentId: c.parent_id,
      parentName: c.parent_name,
      cachedAt: c.cached_at,
    }));
  }

  /**
   * Check if channel cache is stale (older than 5 minutes)
   */
  async isChannelCacheStale(userId, guildId) {
    const result = await query(
      `SELECT cached_at FROM user_discord_channels 
       WHERE oauth_user_id = $1 AND guild_id = $2
       LIMIT 1`,
      [userId, guildId]
    );

    if (result.rows.length === 0) return true;

    const cachedAt = new Date(result.rows[0].cached_at);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    return cachedAt < fiveMinutesAgo;
  }
}

export default new DiscordOAuthService();
