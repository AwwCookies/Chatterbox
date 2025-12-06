import { Router } from 'express';
import Channel from '../models/Channel.js';
import Message from '../models/Message.js';
import { validatePagination, validateDate, sanitizeChannelName } from '../utils/validators.js';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../config/database.js';
import logger from '../utils/logger.js';
import twitchApiService from '../services/twitchApiService.js';

const router = Router();

// Store reference to twitch service (set from index.js)
let twitchService = null;

export const setTwitchService = (service) => {
  twitchService = service;
};

/**
 * GET /api/channels
 * List all channels
 */
router.get('/', async (req, res) => {
  try {
    const activeOnly = req.query.active === 'true';
    const channels = await Channel.getAll(activeOnly);
    
    // Get IRC connection status
    const connectedChannels = twitchService ? twitchService.getConnectedChannels() : [];
    
    // Get Twitch live status (async update cache in background)
    const channelNames = channels.map(c => c.name);
    twitchApiService.updateStreamCache(channelNames); // Non-blocking
    const streamStatuses = twitchApiService.getStreamStatuses(channelNames);
    
    // Get user profiles (for profile pictures)
    const userProfiles = await twitchApiService.getUserProfiles(channelNames);
    
    const channelsWithStatus = channels.map(channel => {
      const nameLower = channel.name.toLowerCase();
      const streamStatus = streamStatuses[nameLower] || {};
      const userProfile = userProfiles[nameLower] || {};
      return {
        ...channel,
        is_joined: connectedChannels.includes(nameLower),
        is_live: streamStatus.isLive || false,
        viewer_count: streamStatus.viewerCount || null,
        stream_title: streamStatus.title || null,
        game_name: streamStatus.gameName || null,
        started_at: streamStatus.startedAt || null,
        profile_image_url: userProfile.profileImageUrl || null,
      };
    });
    
    res.json({ channels: channelsWithStatus });
  } catch (error) {
    logger.error('Error fetching channels:', error.message);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

/**
 * GET /api/channels/live
 * Get live status for all channels (force refresh from Twitch API)
 */
router.get('/live/status', async (req, res) => {
  try {
    const channels = await Channel.getAll(true); // Active channels only
    const channelNames = channels.map(c => c.name);
    
    if (!twitchApiService.isConfigured()) {
      return res.json({ 
        configured: false,
        message: 'Twitch API not configured. Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET.',
        channels: channelNames.map(name => ({ name, is_live: false }))
      });
    }
    
    const statuses = await twitchApiService.refreshStreamStatus(channelNames);
    
    res.json({
      configured: true,
      channels: channelNames.map(name => ({
        name,
        ...statuses[name.toLowerCase()]
      }))
    });
  } catch (error) {
    logger.error('Error fetching live status:', error.message);
    res.status(500).json({ error: 'Failed to fetch live status' });
  }
});

/**
 * GET /api/channels/:name
 * Get specific channel info
 */
router.get('/:name', async (req, res) => {
  try {
    const name = sanitizeChannelName(req.params.name);
    const channel = await Channel.getByName(name);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Add IRC and live status
    const connectedChannels = twitchService ? twitchService.getConnectedChannels() : [];
    const streamStatus = twitchApiService.getStreamStatus(name) || {};
    
    // Get user profile (for profile picture)
    const userProfile = await twitchApiService.getUserProfile(name);
    
    res.json({
      ...channel,
      is_joined: connectedChannels.includes(name.toLowerCase()),
      is_live: streamStatus.isLive || false,
      viewer_count: streamStatus.viewerCount || null,
      stream_title: streamStatus.title || null,
      game_name: streamStatus.gameName || null,
      started_at: streamStatus.startedAt || null,
      profile_image_url: userProfile?.profileImageUrl || null,
    });
  } catch (error) {
    logger.error('Error fetching channel:', error.message);
    res.status(500).json({ error: 'Failed to fetch channel' });
  }
});

/**
 * GET /api/channels/:name/stats
 * Get channel statistics
 */
router.get('/:name/stats', async (req, res) => {
  try {
    const name = sanitizeChannelName(req.params.name);
    const channel = await Channel.getByName(name);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const since = validateDate(req.query.since);
    const until = validateDate(req.query.until);

    const stats = await Channel.getStats(channel.id, since, until);
    res.json({ channel, stats });
  } catch (error) {
    logger.error('Error fetching channel stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch channel stats' });
  }
});

/**
 * POST /api/channels
 * Add new channel to monitor
 * Requires authentication
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Channel name is required' });
    }

    const channelName = sanitizeChannelName(name);

    // Check if channel already exists
    let channel = await Channel.getByName(channelName);
    
    if (channel && channel.is_active) {
      return res.status(409).json({ error: 'Channel is already being monitored' });
    }

    // Create or reactivate channel
    channel = await Channel.findOrCreate(channelName);

    // Join IRC channel
    if (twitchService) {
      await twitchService.joinChannel(channelName);
    }

    res.status(201).json(channel);
  } catch (error) {
    logger.error('Error adding channel:', error.message);
    res.status(500).json({ error: 'Failed to add channel' });
  }
});

/**
 * PATCH /api/channels/:name
 * Update channel status
 * Requires authentication
 */
router.patch('/:name', requireAuth, async (req, res) => {
  try {
    const name = sanitizeChannelName(req.params.name);
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be a boolean' });
    }

    const channel = await Channel.getByName(name);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Update channel status
    const updatedChannel = await Channel.updateStatus(name, is_active);

    // Join or part IRC channel
    if (twitchService) {
      if (is_active) {
        await twitchService.joinChannel(name);
      } else {
        await twitchService.partChannel(name);
      }
    }

    res.json(updatedChannel);
  } catch (error) {
    logger.error('Error updating channel:', error.message);
    res.status(500).json({ error: 'Failed to update channel' });
  }
});

/**
 * DELETE /api/channels/:name
 * Remove channel (soft delete)
 * Requires authentication
 */
router.delete('/:name', requireAuth, async (req, res) => {
  try {
    const name = sanitizeChannelName(req.params.name);

    const channel = await Channel.getByName(name);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Deactivate channel
    await Channel.updateStatus(name, false);

    // Part IRC channel
    if (twitchService) {
      await twitchService.partChannel(name);
    }

    res.json({ message: 'Channel removed successfully' });
  } catch (error) {
    logger.error('Error removing channel:', error.message);
    res.status(500).json({ error: 'Failed to remove channel' });
  }
});

/**
 * POST /api/channels/:name/rejoin
 * Rejoin a channel's IRC
 * Requires authentication
 */
router.post('/:name/rejoin', requireAuth, async (req, res) => {
  try {
    const name = sanitizeChannelName(req.params.name);

    const channel = await Channel.getByName(name);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (!channel.is_active) {
      return res.status(400).json({ error: 'Channel is not active' });
    }

    // Rejoin IRC channel
    if (twitchService) {
      await twitchService.rejoinChannel(name);
    }

    res.json({ message: 'Channel rejoined successfully' });
  } catch (error) {
    logger.error('Error rejoining channel:', error.message);
    res.status(500).json({ error: 'Failed to rejoin channel' });
  }
});

/**
 * GET /api/channels/:name/top-users
 * Get top users by message count in a channel
 */
router.get('/:name/top-users', async (req, res) => {
  try {
    const name = sanitizeChannelName(req.params.name);
    const channel = await Channel.getByName(name);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const since = validateDate(req.query.since);
    const until = validateDate(req.query.until);

    const topUsers = await Channel.getTopUsers(channel.id, limit, since, until);
    res.json({ users: topUsers });
  } catch (error) {
    logger.error('Error fetching top users:', error.message);
    res.status(500).json({ error: 'Failed to fetch top users' });
  }
});

/**
 * GET /api/channels/:name/links
 * Get messages containing links in a channel
 */
router.get('/:name/links', async (req, res) => {
  try {
    const name = sanitizeChannelName(req.params.name);
    const channel = await Channel.getByName(name);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const { limit, offset } = validatePagination(req.query);
    const since = validateDate(req.query.since);
    const until = validateDate(req.query.until);

    const result = await Message.getMessagesWithLinks(channel.id, { 
      limit, 
      offset, 
      since, 
      until 
    });
    
    res.json({ 
      messages: result.messages, 
      total: result.total,
      channel 
    });
  } catch (error) {
    logger.error('Error fetching channel links:', error.message);
    res.status(500).json({ error: 'Failed to fetch channel links' });
  }
});

/**
 * GET /api/channels/:name/analytics/hourly
 * Get hourly message analytics
 */
router.get('/:name/analytics/hourly', async (req, res) => {
  try {
    const name = sanitizeChannelName(req.params.name);
    const channel = await Channel.getByName(name);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const hoursBack = Math.min(Math.max(parseInt(req.query.hours) || 24, 1), 720); // 1-30 days
    const result = await query(
      'SELECT * FROM get_channel_hourly_messages($1, $2)',
      [channel.id, hoursBack]
    );

    res.json({
      channel: { id: channel.id, name: channel.name },
      period: `${hoursBack} hours`,
      data: result.rows.map(row => ({
        hour: row.hour,
        messageCount: parseInt(row.message_count),
        uniqueUsers: parseInt(row.unique_users)
      }))
    });
  } catch (error) {
    logger.error('Error fetching hourly analytics:', error.message);
    res.status(500).json({ error: 'Failed to fetch hourly analytics' });
  }
});

/**
 * GET /api/channels/:name/analytics/daily
 * Get daily message analytics
 */
router.get('/:name/analytics/daily', async (req, res) => {
  try {
    const name = sanitizeChannelName(req.params.name);
    const channel = await Channel.getByName(name);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const daysBack = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365);
    const result = await query(
      'SELECT * FROM get_channel_daily_messages($1, $2)',
      [channel.id, daysBack]
    );

    res.json({
      channel: { id: channel.id, name: channel.name },
      period: `${daysBack} days`,
      data: result.rows.map(row => ({
        day: row.day,
        messageCount: parseInt(row.message_count),
        uniqueUsers: parseInt(row.unique_users),
        avgMessagesPerUser: parseFloat(row.avg_messages_per_user)
      }))
    });
  } catch (error) {
    logger.error('Error fetching daily analytics:', error.message);
    res.status(500).json({ error: 'Failed to fetch daily analytics' });
  }
});

/**
 * GET /api/channels/:name/analytics/top-users
 * Get top chatters
 */
router.get('/:name/analytics/top-users', async (req, res) => {
  try {
    const name = sanitizeChannelName(req.params.name);
    const channel = await Channel.getByName(name);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const daysBack = Math.min(Math.max(parseInt(req.query.days) || 7, 1), 365);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    
    const result = await query(
      'SELECT * FROM get_channel_top_users($1, $2, $3)',
      [channel.id, daysBack, limit]
    );

    res.json({
      channel: { id: channel.id, name: channel.name },
      period: `${daysBack} days`,
      data: result.rows.map(row => ({
        username: row.username,
        displayName: row.display_name,
        messageCount: parseInt(row.message_count),
        uniqueDays: parseInt(row.unique_days),
        avgMessagesPerDay: parseFloat(row.avg_messages_per_day)
      }))
    });
  } catch (error) {
    logger.error('Error fetching top users:', error.message);
    res.status(500).json({ error: 'Failed to fetch top users' });
  }
});

/**
 * GET /api/channels/:name/analytics/heatmap
 * Get hourly distribution heatmap data
 */
router.get('/:name/analytics/heatmap', async (req, res) => {
  try {
    const name = sanitizeChannelName(req.params.name);
    const channel = await Channel.getByName(name);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const daysBack = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365);
    const result = await query(
      'SELECT * FROM get_channel_hourly_distribution($1, $2)',
      [channel.id, daysBack]
    );

    res.json({
      channel: { id: channel.id, name: channel.name },
      period: `${daysBack} days`,
      data: result.rows.map(row => ({
        hourOfDay: parseInt(row.hour_of_day),
        dayOfWeek: parseInt(row.day_of_week),
        messageCount: parseInt(row.message_count),
        avgMessages: parseFloat(row.avg_messages)
      }))
    });
  } catch (error) {
    logger.error('Error fetching heatmap data:', error.message);
    res.status(500).json({ error: 'Failed to fetch heatmap data' });
  }
});

/**
 * GET /api/channels/:name/analytics/mod-actions
 * Get mod action trends
 */
router.get('/:name/analytics/mod-actions', async (req, res) => {
  try {
    const name = sanitizeChannelName(req.params.name);
    const channel = await Channel.getByName(name);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const daysBack = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365);
    const result = await query(
      'SELECT * FROM get_channel_mod_action_trends($1, $2)',
      [channel.id, daysBack]
    );

    res.json({
      channel: { id: channel.id, name: channel.name },
      period: `${daysBack} days`,
      data: result.rows.map(row => ({
        actionType: row.action_type,
        totalCount: parseInt(row.total_count),
        todayCount: parseInt(row.today_count),
        weekAvg: parseFloat(row.week_avg)
      }))
    });
  } catch (error) {
    logger.error('Error fetching mod action trends:', error.message);
    res.status(500).json({ error: 'Failed to fetch mod action trends' });
  }
});

/**
 * GET /api/channels/:name/analytics/engagement
 * Get engagement metrics
 */
router.get('/:name/analytics/engagement', async (req, res) => {
  try {
    const name = sanitizeChannelName(req.params.name);
    const channel = await Channel.getByName(name);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const daysBack = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365);
    const result = await query(
      'SELECT * FROM get_channel_engagement_metrics($1, $2)',
      [channel.id, daysBack]
    );

    res.json({
      channel: { id: channel.id, name: channel.name },
      period: `${daysBack} days`,
      metrics: result.rows.map(row => ({
        name: row.metric_name,
        current: parseFloat(row.value),
        previous: parseFloat(row.previous_period),
        percentChange: parseFloat(row.percent_change)
      }))
    });
  } catch (error) {
    logger.error('Error fetching engagement metrics:', error.message);
    res.status(500).json({ error: 'Failed to fetch engagement metrics' });
  }
});

/**
 * GET /api/channels/:name/analytics/retention
 * Get user retention cohort analysis
 */
router.get('/:name/analytics/retention', async (req, res) => {
  try {
    const name = sanitizeChannelName(req.params.name);
    const channel = await Channel.getByName(name);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const periodDays = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365);
    const result = await query(
      'SELECT * FROM get_channel_user_retention($1, $2)',
      [channel.id, periodDays]
    );

    res.json({
      channel: { id: channel.id, name: channel.name },
      period: `${periodDays} days`,
      cohorts: result.rows.map(row => ({
        cohortDate: row.cohort_date,
        cohortSize: parseInt(row.cohort_size),
        day1Retention: parseFloat(row.day_1_retention),
        day7Retention: parseFloat(row.day_7_retention),
        day30Retention: parseFloat(row.day_30_retention)
      }))
    });
  } catch (error) {
    logger.error('Error fetching retention data:', error.message);
    res.status(500).json({ error: 'Failed to fetch retention data' });
  }
});

// Get top emotes used in channel
router.get('/:name/analytics/top-emotes', async (req, res) => {
  try {
    const name = sanitizeChannelName(req.params.name);
    const channel = await Channel.getByName(name);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const daysBack = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);

    const result = await query(
      'SELECT * FROM get_channel_top_emotes($1, $2, $3)',
      [channel.id, daysBack, limit]
    );

    res.json({
      channel: { id: channel.id, name: channel.name },
      period: `${daysBack} days`,
      data: result.rows.map(row => ({
        emoteId: row.emote_id,
        emoteName: row.emote_name,
        emoteCode: row.emote_code,
        usageCount: parseInt(row.usage_count),
        uniqueUsers: parseInt(row.unique_users)
      }))
    });
  } catch (error) {
    logger.error('Error fetching top emotes:', error.message);
    res.status(500).json({ error: 'Failed to fetch top emotes' });
  }
});

export default router;
