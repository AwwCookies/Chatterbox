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

// ==================== MONETIZATION ENDPOINTS ====================

/**
 * GET /api/channels/:name/monetization
 * Get comprehensive monetization stats for a channel
 */
router.get('/:name/monetization', async (req, res) => {
  try {
    const name = sanitizeChannelName(req.params.name);
    const channel = await Channel.getByName(name);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const daysBack = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365);
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    // Get summary stats using subqueries to avoid Cartesian join issues
    const summaryResult = await query(`
      WITH bits_summary AS (
        SELECT 
          COALESCE(SUM(bits_amount), 0)::int AS total_bits,
          COUNT(*)::int AS total_bit_events,
          COUNT(DISTINCT user_id)::int AS unique_bit_givers
        FROM channel_bits
        WHERE channel_id = $1 AND timestamp >= $2
      ),
      subs_summary AS (
        SELECT
          COUNT(*) FILTER (WHERE sub_type = 'sub')::int AS new_subs,
          COUNT(*) FILTER (WHERE sub_type = 'resub')::int AS resubs,
          COUNT(*) FILTER (WHERE sub_type IN ('subgift', 'submysterygift'))::int AS gift_sub_events,
          COALESCE(SUM(gift_count) FILTER (WHERE sub_type IN ('subgift', 'submysterygift')), 0)::int AS gifts_given,
          COUNT(DISTINCT user_id) FILTER (WHERE sub_type IN ('subgift', 'submysterygift'))::int AS unique_gifters,
          COUNT(*) FILTER (WHERE is_prime = true)::int AS prime_subs,
          COUNT(*) FILTER (WHERE tier = '1000')::int AS tier1_subs,
          COUNT(*) FILTER (WHERE tier = '2000')::int AS tier2_subs,
          COUNT(*) FILTER (WHERE tier = '3000')::int AS tier3_subs
        FROM channel_subscriptions
        WHERE channel_id = $1 AND timestamp >= $2
      ),
      hype_summary AS (
        SELECT
          COUNT(*)::int AS hype_trains,
          COALESCE(MAX(level), 0)::int AS max_hype_level
        FROM channel_hype_trains
        WHERE channel_id = $1 AND started_at >= $2
      ),
      raids_summary AS (
        SELECT
          COUNT(*)::int AS raids_received,
          COALESCE(SUM(viewer_count), 0)::int AS total_raid_viewers
        FROM channel_raids
        WHERE channel_id = $1 AND timestamp >= $2
      )
      SELECT 
        b.*, s.*, h.*, r.*
      FROM bits_summary b, subs_summary s, hype_summary h, raids_summary r
    `, [channel.id, since]);

    // Get daily breakdown for charts using subqueries
    const dailyResult = await query(`
      WITH dates AS (
        SELECT generate_series($2::date, NOW()::date, '1 day'::interval)::date AS date
      ),
      daily_bits AS (
        SELECT timestamp::date AS date, SUM(bits_amount)::int AS bits, COUNT(*)::int AS bit_events
        FROM channel_bits
        WHERE channel_id = $1 AND timestamp >= $2
        GROUP BY timestamp::date
      ),
      daily_subs AS (
        SELECT timestamp::date AS date,
          COUNT(*) FILTER (WHERE sub_type IN ('sub', 'resub'))::int AS subs,
          COALESCE(SUM(gift_count) FILTER (WHERE sub_type IN ('subgift', 'submysterygift')), 0)::int AS gifts
        FROM channel_subscriptions
        WHERE channel_id = $1 AND timestamp >= $2
        GROUP BY timestamp::date
      )
      SELECT
        d.date,
        COALESCE(db.bits, 0) AS bits,
        COALESCE(db.bit_events, 0) AS bit_events,
        COALESCE(ds.subs, 0) AS subs,
        COALESCE(ds.gifts, 0) AS gifts
      FROM dates d
      LEFT JOIN daily_bits db ON db.date = d.date
      LEFT JOIN daily_subs ds ON ds.date = d.date
      ORDER BY d.date
    `, [channel.id, since]);

    const summary = summaryResult.rows[0] || {};

    res.json({
      channel: { id: channel.id, name: channel.name },
      period: `${daysBack} days`,
      summary: {
        bits: {
          total: summary.total_bits || 0,
          events: summary.total_bit_events || 0,
          uniqueGivers: summary.unique_bit_givers || 0,
          estimatedValue: ((summary.total_bits || 0) * 0.01).toFixed(2) // $0.01 per bit
        },
        subscriptions: {
          newSubs: summary.new_subs || 0,
          resubs: summary.resubs || 0,
          giftSubEvents: summary.gift_sub_events || 0,
          giftsGiven: summary.gifts_given || 0,
          uniqueGifters: summary.unique_gifters || 0,
          primeSubs: summary.prime_subs || 0,
          byTier: {
            tier1: summary.tier1_subs || 0,
            tier2: summary.tier2_subs || 0,
            tier3: summary.tier3_subs || 0
          }
        },
        hypeTrains: {
          total: summary.hype_trains || 0,
          maxLevel: summary.max_hype_level || 0
        },
        raids: {
          total: summary.raids_received || 0,
          totalViewers: summary.total_raid_viewers || 0
        }
      },
      daily: dailyResult.rows.map(row => ({
        date: row.date,
        bits: row.bits,
        bitEvents: row.bit_events,
        subs: row.subs,
        gifts: row.gifts
      }))
    });
  } catch (error) {
    logger.error('Error fetching monetization data:', error.message);
    res.status(500).json({ error: 'Failed to fetch monetization data' });
  }
});

/**
 * GET /api/channels/:name/monetization/top-gifters
 * Get top gift sub givers for a channel
 */
router.get('/:name/monetization/top-gifters', async (req, res) => {
  try {
    const name = sanitizeChannelName(req.params.name);
    const channel = await Channel.getByName(name);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 100);
    const daysBack = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365);
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    const result = await query(`
      SELECT
        u.id AS user_id,
        u.username,
        u.display_name,
        COALESCE(SUM(cs.gift_count), 0)::int AS total_gifts,
        COUNT(DISTINCT cs.id)::int AS gift_events,
        MAX(cs.timestamp) AS last_gift_at
      FROM channel_subscriptions cs
      JOIN users u ON cs.user_id = u.id
      WHERE cs.channel_id = $1
        AND cs.sub_type IN ('subgift', 'submysterygift')
        AND cs.timestamp >= $3
      GROUP BY u.id, u.username, u.display_name
      ORDER BY total_gifts DESC
      LIMIT $2
    `, [channel.id, limit, since]);

    res.json({
      channel: { id: channel.id, name: channel.name },
      period: `${daysBack} days`,
      topGifters: result.rows.map((row, idx) => ({
        rank: idx + 1,
        userId: row.user_id,
        username: row.username,
        displayName: row.display_name,
        totalGifts: row.total_gifts,
        giftEvents: row.gift_events,
        lastGiftAt: row.last_gift_at
      }))
    });
  } catch (error) {
    logger.error('Error fetching top gifters:', error.message);
    res.status(500).json({ error: 'Failed to fetch top gifters' });
  }
});

/**
 * GET /api/channels/:name/monetization/top-bits
 * Get top bit givers for a channel
 */
router.get('/:name/monetization/top-bits', async (req, res) => {
  try {
    const name = sanitizeChannelName(req.params.name);
    const channel = await Channel.getByName(name);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 100);
    const daysBack = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365);
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    const result = await query(`
      SELECT
        u.id AS user_id,
        u.username,
        u.display_name,
        COALESCE(SUM(cb.bits_amount), 0)::int AS total_bits,
        COUNT(DISTINCT cb.id)::int AS cheer_count,
        MAX(cb.bits_amount)::int AS largest_cheer,
        MAX(cb.timestamp) AS last_cheer_at
      FROM channel_bits cb
      JOIN users u ON cb.user_id = u.id
      WHERE cb.channel_id = $1
        AND cb.timestamp >= $3
      GROUP BY u.id, u.username, u.display_name
      ORDER BY total_bits DESC
      LIMIT $2
    `, [channel.id, limit, since]);

    res.json({
      channel: { id: channel.id, name: channel.name },
      period: `${daysBack} days`,
      topBitGivers: result.rows.map((row, idx) => ({
        rank: idx + 1,
        userId: row.user_id,
        username: row.username,
        displayName: row.display_name,
        totalBits: row.total_bits,
        cheerCount: row.cheer_count,
        largestCheer: row.largest_cheer,
        lastCheerAt: row.last_cheer_at
      }))
    });
  } catch (error) {
    logger.error('Error fetching top bit givers:', error.message);
    res.status(500).json({ error: 'Failed to fetch top bit givers' });
  }
});

/**
 * GET /api/channels/:name/monetization/recent-subs
 * Get recent subscription events for a channel
 */
router.get('/:name/monetization/recent-subs', async (req, res) => {
  try {
    const name = sanitizeChannelName(req.params.name);
    const channel = await Channel.getByName(name);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const { limit: reqLimit, offset: reqOffset } = validatePagination(req.query.limit, req.query.offset);
    const subType = req.query.type; // Optional filter: 'sub', 'resub', 'subgift', 'submysterygift', 'prime'

    let whereClause = 'WHERE cs.channel_id = $1';
    const params = [channel.id];

    if (subType) {
      if (subType === 'prime') {
        whereClause += ' AND cs.is_prime = true';
      } else if (subType === 'gift') {
        whereClause += " AND cs.sub_type IN ('subgift', 'submysterygift')";
      } else {
        params.push(subType);
        whereClause += ` AND cs.sub_type = $${params.length}`;
      }
    }

    const result = await query(`
      SELECT
        cs.id,
        cs.sub_type,
        cs.tier,
        cs.is_prime,
        cs.cumulative_months,
        cs.streak_months,
        cs.gift_count,
        cs.message_text,
        cs.timestamp,
        u.id AS user_id,
        u.username,
        u.display_name,
        r.id AS recipient_id,
        r.username AS recipient_username,
        r.display_name AS recipient_display_name
      FROM channel_subscriptions cs
      JOIN users u ON cs.user_id = u.id
      LEFT JOIN users r ON cs.gift_recipient_id = r.id
      ${whereClause}
      ORDER BY cs.timestamp DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, reqLimit, reqOffset]);

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*)::int AS total
      FROM channel_subscriptions cs
      ${whereClause}
    `, params);

    res.json({
      channel: { id: channel.id, name: channel.name },
      subscriptions: result.rows.map(row => ({
        id: row.id,
        subType: row.sub_type,
        tier: row.tier,
        isPrime: row.is_prime,
        cumulativeMonths: row.cumulative_months,
        streakMonths: row.streak_months,
        giftCount: row.gift_count,
        message: row.message_text,
        timestamp: row.timestamp,
        user: {
          id: row.user_id,
          username: row.username,
          displayName: row.display_name
        },
        recipient: row.recipient_id ? {
          id: row.recipient_id,
          username: row.recipient_username,
          displayName: row.recipient_display_name
        } : null
      })),
      total: countResult.rows[0]?.total || 0,
      limit: reqLimit,
      offset: reqOffset
    });
  } catch (error) {
    logger.error('Error fetching recent subs:', error.message);
    res.status(500).json({ error: 'Failed to fetch recent subscriptions' });
  }
});

/**
 * GET /api/channels/:name/monetization/recent-bits
 * Get recent bit/cheer events for a channel
 */
router.get('/:name/monetization/recent-bits', async (req, res) => {
  try {
    const name = sanitizeChannelName(req.params.name);
    const channel = await Channel.getByName(name);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const { limit: reqLimit, offset: reqOffset } = validatePagination(req.query.limit, req.query.offset);

    const result = await query(`
      SELECT
        cb.id,
        cb.bits_amount,
        cb.message_text,
        cb.timestamp,
        u.id AS user_id,
        u.username,
        u.display_name
      FROM channel_bits cb
      JOIN users u ON cb.user_id = u.id
      WHERE cb.channel_id = $1
      ORDER BY cb.timestamp DESC
      LIMIT $2 OFFSET $3
    `, [channel.id, reqLimit, reqOffset]);

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*)::int AS total
      FROM channel_bits
      WHERE channel_id = $1
    `, [channel.id]);

    res.json({
      channel: { id: channel.id, name: channel.name },
      bits: result.rows.map(row => ({
        id: row.id,
        amount: row.bits_amount,
        message: row.message_text,
        timestamp: row.timestamp,
        user: {
          id: row.user_id,
          username: row.username,
          displayName: row.display_name
        }
      })),
      total: countResult.rows[0]?.total || 0,
      limit: reqLimit,
      offset: reqOffset
    });
  } catch (error) {
    logger.error('Error fetching recent bits:', error.message);
    res.status(500).json({ error: 'Failed to fetch recent bits' });
  }
});

/**
 * GET /api/channels/:name/monetization/hype-trains
 * Get hype train history for a channel
 */
router.get('/:name/monetization/hype-trains', async (req, res) => {
  try {
    const name = sanitizeChannelName(req.params.name);
    const channel = await Channel.getByName(name);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const { limit: reqLimit, offset: reqOffset } = validatePagination(req.query.limit, req.query.offset);

    const result = await query(`
      SELECT
        ht.id,
        ht.hype_train_id,
        ht.level,
        ht.total_points,
        ht.goal,
        ht.top_contributions,
        ht.started_at,
        ht.ended_at,
        ht.is_golden_kappa
      FROM channel_hype_trains ht
      WHERE ht.channel_id = $1
      ORDER BY ht.started_at DESC
      LIMIT $2 OFFSET $3
    `, [channel.id, reqLimit, reqOffset]);

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*)::int AS total
      FROM channel_hype_trains
      WHERE channel_id = $1
    `, [channel.id]);

    res.json({
      channel: { id: channel.id, name: channel.name },
      hypeTrains: result.rows.map(row => ({
        id: row.id,
        hypeTrainId: row.hype_train_id,
        level: row.level,
        totalPoints: row.total_points,
        goal: row.goal,
        topContributions: row.top_contributions,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        isGoldenKappa: row.is_golden_kappa
      })),
      total: countResult.rows[0]?.total || 0,
      limit: reqLimit,
      offset: reqOffset
    });
  } catch (error) {
    logger.error('Error fetching hype trains:', error.message);
    res.status(500).json({ error: 'Failed to fetch hype trains' });
  }
});

/**
 * GET /api/channels/:name/monetization/raids
 * Get raid history for a channel
 */
router.get('/:name/monetization/raids', async (req, res) => {
  try {
    const name = sanitizeChannelName(req.params.name);
    const channel = await Channel.getByName(name);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const { limit: reqLimit, offset: reqOffset } = validatePagination(req.query.limit, req.query.offset);

    const result = await query(`
      SELECT
        r.id,
        r.raider_name,
        r.raider_display_name,
        r.viewer_count,
        r.timestamp,
        rc.id AS raider_channel_id,
        rc.name AS raider_channel_name
      FROM channel_raids r
      LEFT JOIN channels rc ON r.raider_channel_id = rc.id
      WHERE r.channel_id = $1
      ORDER BY r.timestamp DESC
      LIMIT $2 OFFSET $3
    `, [channel.id, reqLimit, reqOffset]);

    // Get total count and stats
    const statsResult = await query(`
      SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(viewer_count), 0)::int AS total_viewers,
        COALESCE(MAX(viewer_count), 0)::int AS largest_raid,
        COALESCE(AVG(viewer_count), 0)::int AS avg_viewers
      FROM channel_raids
      WHERE channel_id = $1
    `, [channel.id]);

    const stats = statsResult.rows[0] || {};

    res.json({
      channel: { id: channel.id, name: channel.name },
      stats: {
        totalRaids: stats.total || 0,
        totalViewers: stats.total_viewers || 0,
        largestRaid: stats.largest_raid || 0,
        avgViewers: stats.avg_viewers || 0
      },
      raids: result.rows.map(row => ({
        id: row.id,
        raiderName: row.raider_name,
        raiderDisplayName: row.raider_display_name,
        viewerCount: row.viewer_count,
        timestamp: row.timestamp,
        raiderChannel: row.raider_channel_id ? {
          id: row.raider_channel_id,
          name: row.raider_channel_name
        } : null
      })),
      total: stats.total || 0,
      limit: reqLimit,
      offset: reqOffset
    });
  } catch (error) {
    logger.error('Error fetching raids:', error.message);
    res.status(500).json({ error: 'Failed to fetch raids' });
  }
});

export default router;
