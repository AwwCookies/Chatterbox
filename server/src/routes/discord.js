import { Router } from 'express';
import crypto from 'crypto';
import { requireUserAuth } from '../middleware/auth.js';
import discordOAuthService from '../services/discordOAuthService.js';
import Webhook from '../models/Webhook.js';
import logger from '../utils/logger.js';

const router = Router();

const CLIENT_URL = process.env.CLIENT_URL || 'https://chatterbox.calicos.art';

// Store state tokens temporarily (in production, use Redis)
const discordStateTokens = new Map();

/**
 * Helper to clean up old state tokens
 */
function cleanupStateTokens() {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const [key, value] of discordStateTokens) {
    if (value.createdAt < tenMinutesAgo) {
      discordStateTokens.delete(key);
    }
  }
}

/**
 * GET /api/discord/status
 * Get Discord connection status for current user
 */
router.get('/status', requireUserAuth, async (req, res) => {
  try {
    const status = await discordOAuthService.getDiscordStatus(req.user.id);
    res.json(status);
  } catch (error) {
    logger.error('Error getting Discord status:', error);
    res.status(500).json({ error: 'Failed to get Discord status' });
  }
});

/**
 * GET /api/discord/connect
 * Initiate Discord OAuth flow - returns the authorization URL
 */
router.get('/connect', requireUserAuth, (req, res) => {
  if (!discordOAuthService.isConfigured()) {
    return res.status(503).json({ error: 'Discord OAuth is not configured on this server' });
  }

  // Generate state token for CSRF protection (includes user ID)
  const state = crypto.randomBytes(32).toString('hex');
  discordStateTokens.set(state, { 
    createdAt: Date.now(), 
    userId: req.user.id,
    returnUrl: req.query.returnUrl || '/webhooks'
  });

  cleanupStateTokens();

  const authUrl = discordOAuthService.getAuthorizationUrl(state);
  
  // Return the URL for the frontend to redirect to
  res.json({ url: authUrl });
});

/**
 * GET /api/discord/callback
 * Discord OAuth callback - exchanges code for tokens
 */
router.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  // Handle OAuth errors from Discord
  if (error) {
    logger.warn(`Discord OAuth error: ${error} - ${error_description}`);
    return res.redirect(`${CLIENT_URL}/webhooks?error=${encodeURIComponent(error_description || error)}`);
  }

  // Validate state token
  if (!state || !discordStateTokens.has(state)) {
    logger.warn('Invalid Discord OAuth state token');
    return res.redirect(`${CLIENT_URL}/webhooks?error=invalid_state`);
  }

  const stateData = discordStateTokens.get(state);
  discordStateTokens.delete(state);

  if (!code) {
    return res.redirect(`${CLIENT_URL}/webhooks?error=no_code`);
  }

  try {
    // Exchange code for tokens
    const tokens = await discordOAuthService.exchangeCode(code);

    // Get Discord user info
    const discordUser = await discordOAuthService.getDiscordUser(tokens.accessToken);
    logger.info(`Discord connected for user ${stateData.userId}: ${discordUser.username}`);

    // Save Discord connection
    await discordOAuthService.saveDiscordConnection(stateData.userId, discordUser, tokens);

    // Fetch and cache guilds
    const guilds = await discordOAuthService.getUserGuilds(tokens.accessToken);
    await discordOAuthService.cacheUserGuilds(stateData.userId, guilds);

    res.redirect(`${CLIENT_URL}${stateData.returnUrl}?discord=connected`);
  } catch (error) {
    logger.error('Discord OAuth callback error:', error);
    res.redirect(`${CLIENT_URL}/webhooks?error=discord_auth_failed`);
  }
});

/**
 * POST /api/discord/disconnect
 * Disconnect Discord account
 */
router.post('/disconnect', requireUserAuth, async (req, res) => {
  try {
    const { deleteWebhooks } = req.body;

    // Get user's Discord token for revocation
    const status = await discordOAuthService.getDiscordStatus(req.user.id);
    
    if (!status.connected) {
      return res.status(400).json({ error: 'Discord is not connected' });
    }

    // Optionally delete Discord-created webhooks
    if (deleteWebhooks) {
      const webhooks = await Webhook.getUserWebhooks(req.user.id);
      const discordWebhooks = webhooks.filter(w => w.created_via_oauth && w.discord_webhook_id);
      
      for (const webhook of discordWebhooks) {
        try {
          // Extract webhook token from URL
          const urlParts = webhook.webhook_url.split('/');
          const webhookToken = urlParts[urlParts.length - 1];
          
          // Delete from Discord
          await discordOAuthService.deleteWebhook(webhook.discord_webhook_id, webhookToken);
          
          // Delete from database
          await Webhook.deleteUserWebhook(webhook.id, req.user.id);
        } catch (error) {
          logger.warn(`Failed to delete Discord webhook ${webhook.id}:`, error.message);
          // Continue with other webhooks
        }
      }
    }

    // Revoke Discord token (best effort)
    try {
      const accessToken = await discordOAuthService.getValidAccessToken(req.user.id);
      await discordOAuthService.revokeToken(accessToken);
    } catch (error) {
      logger.warn('Failed to revoke Discord token:', error.message);
    }

    // Remove Discord connection from database
    await discordOAuthService.removeDiscordConnection(req.user.id);

    res.json({ success: true, message: 'Discord disconnected' });
  } catch (error) {
    logger.error('Error disconnecting Discord:', error);
    res.status(500).json({ error: 'Failed to disconnect Discord' });
  }
});

/**
 * GET /api/discord/guilds
 * Get user's Discord servers where they have webhook permission
 */
router.get('/guilds', requireUserAuth, async (req, res) => {
  try {
    const status = await discordOAuthService.getDiscordStatus(req.user.id);
    
    if (!status.connected) {
      return res.status(400).json({ error: 'Discord is not connected' });
    }

    // Check if we should refresh from Discord API
    const forceRefresh = req.query.refresh === 'true';
    let guilds = await discordOAuthService.getCachedGuilds(req.user.id);
    
    if (forceRefresh || guilds.length === 0) {
      // Fetch fresh data from Discord
      const accessToken = await discordOAuthService.getValidAccessToken(req.user.id);
      const discordGuilds = await discordOAuthService.getUserGuilds(accessToken);
      await discordOAuthService.cacheUserGuilds(req.user.id, discordGuilds);
      guilds = await discordOAuthService.getCachedGuilds(req.user.id);
    }

    res.json({ guilds });
  } catch (error) {
    logger.error('Error fetching Discord guilds:', error);
    
    if (error.message?.includes('expired') || error.message?.includes('reconnect')) {
      return res.status(401).json({ error: 'Discord session expired - please reconnect', code: 'DISCORD_EXPIRED' });
    }
    
    res.status(500).json({ error: 'Failed to fetch Discord servers' });
  }
});

/**
 * GET /api/discord/guilds/:guildId/channels
 * Get channels in a Discord server using bot token
 */
router.get('/guilds/:guildId/channels', requireUserAuth, async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Check if bot is configured
    if (!discordOAuthService.isBotConfigured()) {
      return res.status(503).json({ error: 'Discord bot is not configured on this server' });
    }

    const status = await discordOAuthService.getDiscordStatus(req.user.id);
    
    if (!status.connected) {
      return res.status(400).json({ error: 'Discord is not connected' });
    }

    // Verify user has access to this guild (from their guilds list)
    const hasAccess = await discordOAuthService.userHasGuildAccess(req.user.id, guildId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this server' });
    }

    // Check cache freshness
    const forceRefresh = req.query.refresh === 'true';
    const cacheStale = await discordOAuthService.isChannelCacheStale(req.user.id, guildId);
    
    let channels = await discordOAuthService.getCachedChannels(req.user.id, guildId);
    
    if (forceRefresh || cacheStale || channels.length === 0) {
      // Fetch fresh data from Discord using bot token
      const discordChannels = await discordOAuthService.getGuildChannels(guildId);
      await discordOAuthService.cacheGuildChannels(req.user.id, guildId, discordChannels);
      channels = await discordOAuthService.getCachedChannels(req.user.id, guildId);
    }

    // Organize channels by category
    const categorized = {};
    const uncategorized = [];
    
    channels.forEach(channel => {
      if (channel.parentId) {
        if (!categorized[channel.parentId]) {
          categorized[channel.parentId] = {
            id: channel.parentId,
            name: channel.parentName || 'Unknown Category',
            channels: [],
          };
        }
        categorized[channel.parentId].channels.push(channel);
      } else {
        uncategorized.push(channel);
      }
    });

    res.json({ 
      channels,
      categorized: Object.values(categorized),
      uncategorized,
    });
  } catch (error) {
    logger.error('Error fetching Discord channels:', error);
    
    if (error.status === 403 || error.code === 50013) {
      return res.status(403).json({ error: 'Bot does not have access to this server - please invite the bot first' });
    }
    
    if (error.message?.includes('expired') || error.message?.includes('reconnect')) {
      return res.status(401).json({ error: 'Discord session expired - please reconnect', code: 'DISCORD_EXPIRED' });
    }

    if (error.message?.includes('bot token not configured')) {
      return res.status(503).json({ error: 'Discord bot is not configured on this server' });
    }
    
    res.status(500).json({ error: 'Failed to fetch Discord channels' });
  }
});

/**
 * POST /api/discord/guilds/:guildId/channels/:channelId/webhook
 * Create a webhook in a Discord channel
 */
router.post('/guilds/:guildId/channels/:channelId/webhook', requireUserAuth, async (req, res) => {
  try {
    const { guildId, channelId } = req.params;
    const { name, webhookType, config = {}, embedColor, customUsername, customAvatarUrl, includeTimestamp = true, folder } = req.body;

    if (!name || !webhookType) {
      return res.status(400).json({ error: 'Name and webhook type are required' });
    }

    const validTypes = ['tracked_user_message', 'mod_action', 'channel_live', 'channel_offline', 'channel_game_change'];
    if (!validTypes.includes(webhookType)) {
      return res.status(400).json({ error: 'Invalid webhook type' });
    }

    const status = await discordOAuthService.getDiscordStatus(req.user.id);
    
    if (!status.connected) {
      return res.status(400).json({ error: 'Discord is not connected' });
    }

    // Verify user has access to this guild
    const hasAccess = await discordOAuthService.userHasGuildAccess(req.user.id, guildId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this server' });
    }

    // Check if bot is configured (needed for webhook creation)
    if (!discordOAuthService.isBotConfigured()) {
      return res.status(503).json({ error: 'Discord bot is not configured on this server' });
    }

    // Get guild and channel info for database
    const guilds = await discordOAuthService.getCachedGuilds(req.user.id);
    const guild = guilds.find(g => g.id === guildId);
    
    const channels = await discordOAuthService.getCachedChannels(req.user.id, guildId);
    const channel = channels.find(c => c.id === channelId);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Create webhook on Discord using bot token
    const webhookName = `Chatterbox - ${name}`;
    
    const discordWebhook = await discordOAuthService.createWebhookWithBot(channelId, webhookName);
    
    logger.info(`Created Discord webhook ${discordWebhook.id} in channel ${channelId} for user ${req.user.id}`);

    // Construct webhook URL
    const webhookUrl = `https://discord.com/api/webhooks/${discordWebhook.id}/${discordWebhook.token}`;

    // Save to database with Discord metadata
    const webhook = await Webhook.createUserWebhookWithDiscord({
      oauthUserId: req.user.id,
      name,
      webhookUrl,
      webhookType,
      config,
      embedColor: embedColor || '#5865F2',
      customUsername,
      customAvatarUrl,
      includeTimestamp,
      discordGuildId: guildId,
      discordGuildName: guild?.name || 'Unknown',
      discordChannelId: channelId,
      discordChannelName: channel.name,
      discordWebhookId: discordWebhook.id,
      createdViaOauth: true,
      folder: folder || null,
    });

    res.status(201).json({ 
      webhook: {
        ...webhook,
        webhook_url_masked: '****' + webhook.webhook_url.slice(-8),
      },
      discordWebhookId: discordWebhook.id,
    });
  } catch (error) {
    logger.error('Error creating Discord webhook:', error);
    
    if (error.status === 403 || error.code === 50013) {
      return res.status(403).json({ error: 'Bot does not have permission to create webhooks in this channel' });
    }
    
    if (error.code === 30007) {
      return res.status(400).json({ error: 'Maximum webhooks reached for this channel (Discord limit)' });
    }
    
    if (error.message?.includes('bot token not configured')) {
      return res.status(503).json({ error: 'Discord bot is not configured on this server' });
    }
    
    if (error.message?.includes('expired') || error.message?.includes('reconnect')) {
      return res.status(401).json({ error: 'Discord session expired - please reconnect', code: 'DISCORD_EXPIRED' });
    }
    
    res.status(500).json({ error: 'Failed to create Discord webhook' });
  }
});

/**
 * POST /api/discord/refresh
 * Refresh Discord guilds and channels cache
 */
router.post('/refresh', requireUserAuth, async (req, res) => {
  try {
    const status = await discordOAuthService.getDiscordStatus(req.user.id);
    
    if (!status.connected) {
      return res.status(400).json({ error: 'Discord is not connected' });
    }

    // Fetch fresh data from Discord
    const accessToken = await discordOAuthService.getValidAccessToken(req.user.id);
    const discordGuilds = await discordOAuthService.getUserGuilds(accessToken);
    const cachedGuilds = await discordOAuthService.cacheUserGuilds(req.user.id, discordGuilds);

    // Check webhooks status
    const webhooks = await Webhook.getUserWebhooks(req.user.id);
    const discordWebhooks = webhooks.filter(w => w.created_via_oauth);
    
    // TODO: Could check if webhooks still exist on Discord side

    res.json({ 
      success: true,
      guildsCount: cachedGuilds.length,
      webhooksCount: discordWebhooks.length,
    });
  } catch (error) {
    logger.error('Error refreshing Discord connection:', error);
    
    if (error.message?.includes('expired') || error.message?.includes('reconnect')) {
      return res.status(401).json({ error: 'Discord session expired - please reconnect', code: 'DISCORD_EXPIRED' });
    }
    
    res.status(500).json({ error: 'Failed to refresh Discord connection' });
  }
});

export default router;
