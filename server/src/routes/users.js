import { Router } from 'express';
import User from '../models/User.js';
import Message from '../models/Message.js';
import ModAction from '../models/ModAction.js';
import { query } from '../config/database.js';
import { validatePagination, validateDate, sanitizeChannelName } from '../utils/validators.js';
import { requireAuth } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /api/users
 * List users with optional filters
 */
router.get('/', async (req, res) => {
  try {
    const { limit, offset } = validatePagination(req.query);
    const search = req.query.search?.trim();
    const username = req.query.username?.trim();
    const channel = sanitizeChannelName(req.query.channel);

    let users;
    if (username) {
      // Exact username match
      const user = await User.getByUsername(username);
      if (user) {
        // Get counts for this user
        const usersWithCounts = await User.search(username, 1, 0);
        users = usersWithCounts.filter(u => u.username.toLowerCase() === username.toLowerCase());
      } else {
        users = [];
      }
    } else if (search) {
      users = await User.search(search, limit, offset);
    } else {
      users = await User.getAll(limit, offset, channel);
    }

    res.json({ users });
  } catch (error) {
    logger.error('Error fetching users:', error.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /api/users/top
 * Get top users by message count
 */
router.get('/top', async (req, res) => {
  try {
    const { limit, offset } = validatePagination(req.query);
    const since = validateDate(req.query.since);
    const until = validateDate(req.query.until);
    const channelId = req.query.channelId ? parseInt(req.query.channelId) : null;

    const result = await User.getTopUsers({ limit, offset, channelId, since, until });
    res.json(result);
  } catch (error) {
    logger.error('Error fetching top users:', error.message);
    res.status(500).json({ error: 'Failed to fetch top users' });
  }
});

/**
 * GET /api/users/blocked
 * Get all blocked users (requires auth)
 */
router.get('/blocked', requireAuth, async (req, res) => {
  try {
    const { limit, offset } = validatePagination(req.query);
    const result = await User.getBlockedUsers(limit, offset);
    res.json(result);
  } catch (error) {
    logger.error('Error fetching blocked users:', error.message);
    res.status(500).json({ error: 'Failed to fetch blocked users' });
  }
});

/**
 * GET /api/users/:username
 * Get user profile by username
 */
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.getByUsername(username);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get basic stats
    const stats = await User.getStats(user.id);
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching user:', error.message);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * GET /api/users/:username/messages
 * Get user's message history
 */
router.get('/:username/messages', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.getByUsername(username);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { limit, offset } = validatePagination(req.query);
    const since = validateDate(req.query.since);
    const until = validateDate(req.query.until);
    const channel = sanitizeChannelName(req.query.channel);

    const result = await Message.getByUser(user.id, {
      channel,
      limit,
      offset,
      since,
      until
    });

    res.json({ 
      messages: result.messages, 
      total: result.total,
      hasMore: result.hasMore,
      user 
    });
  } catch (error) {
    logger.error('Error fetching user messages:', error.message);
    res.status(500).json({ error: 'Failed to fetch user messages' });
  }
});

/**
 * GET /api/users/:username/mod-actions
 * Get moderation actions against user
 */
router.get('/:username/mod-actions', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.getByUsername(username);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { limit, offset } = validatePagination(req.query);
    const result = await ModAction.getByTargetUser(user.id, { limit, offset });

    res.json({ 
      actions: result.actions, 
      total: result.total,
      hasMore: result.hasMore,
      user 
    });
  } catch (error) {
    logger.error('Error fetching user mod actions:', error.message);
    res.status(500).json({ error: 'Failed to fetch user mod actions' });
  }
});

/**
 * GET /api/users/:username/stats
 * Get detailed user statistics
 */
router.get('/:username/stats', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.getByUsername(username);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const stats = await User.getStats(user.id);
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching user stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

/**
 * GET /api/users/:username/export
 * Export all user data (GDPR compliance)
 * Requires authentication
 */
router.get('/:username/export', requireAuth, async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.getByUsername(username);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const exportData = await User.exportUserData(user.id);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${username}_data_export.json"`);
    res.json(exportData);
  } catch (error) {
    logger.error('Error exporting user data:', error.message);
    res.status(500).json({ error: 'Failed to export user data' });
  }
});

/**
 * POST /api/users/:username/block
 * Block a user from being logged
 * Requires authentication
 */
router.post('/:username/block', requireAuth, async (req, res) => {
  try {
    const { username } = req.params;
    const { reason } = req.body;
    
    const user = await User.getByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = await User.blockUser(user.id, reason);
    logger.info(`User blocked: ${username}${reason ? ` - Reason: ${reason}` : ''}`);
    
    res.json({ message: 'User blocked successfully', user: updatedUser });
  } catch (error) {
    logger.error('Error blocking user:', error.message);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

/**
 * POST /api/users/:username/unblock
 * Unblock a user
 * Requires authentication
 */
router.post('/:username/unblock', requireAuth, async (req, res) => {
  try {
    const { username } = req.params;
    
    const user = await User.getByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = await User.unblockUser(user.id);
    logger.info(`User unblocked: ${username}`);
    
    res.json({ message: 'User unblocked successfully', user: updatedUser });
  } catch (error) {
    logger.error('Error unblocking user:', error.message);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

/**
 * PATCH /api/users/:username/notes
 * Update user notes
 * Requires authentication
 */
router.patch('/:username/notes', requireAuth, async (req, res) => {
  try {
    const { username } = req.params;
    const { notes } = req.body;
    
    const user = await User.getByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = await User.updateNotes(user.id, notes);
    res.json({ message: 'Notes updated successfully', user: updatedUser });
  } catch (error) {
    logger.error('Error updating user notes:', error.message);
    res.status(500).json({ error: 'Failed to update notes' });
  }
});

/**
 * DELETE /api/users/:username/messages
 * Delete all messages for a user
 * Requires authentication
 */
router.delete('/:username/messages', requireAuth, async (req, res) => {
  try {
    const { username } = req.params;
    
    const user = await User.getByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const deletedCount = await User.deleteAllMessages(user.id);
    logger.info(`Deleted ${deletedCount} messages for user: ${username}`);
    
    res.json({ message: `Deleted ${deletedCount} messages`, deletedCount });
  } catch (error) {
    logger.error('Error deleting user messages:', error.message);
    res.status(500).json({ error: 'Failed to delete user messages' });
  }
});

/**
 * GET /api/users/:username/analytics/activity
 * Get user activity patterns (hourly/daily distribution)
 */
router.get('/:username/analytics/activity', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.getByUsername(username);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const daysBack = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365);
    
    // Get hourly distribution
    const hourlyResult = await query(`
      SELECT 
        EXTRACT(HOUR FROM timestamp) as hour_of_day,
        COUNT(*) as message_count
      FROM messages
      WHERE user_id = $1 AND timestamp >= NOW() - INTERVAL '${daysBack} days'
      GROUP BY hour_of_day
      ORDER BY hour_of_day
    `, [user.id]);

    // Get day of week distribution
    const weekdayResult = await query(`
      SELECT 
        EXTRACT(DOW FROM timestamp) as day_of_week,
        COUNT(*) as message_count
      FROM messages
      WHERE user_id = $1 AND timestamp >= NOW() - INTERVAL '${daysBack} days'
      GROUP BY day_of_week
      ORDER BY day_of_week
    `, [user.id]);

    // Get daily message counts over time
    const dailyResult = await query(`
      SELECT 
        DATE_TRUNC('day', timestamp)::date as day,
        COUNT(*) as message_count
      FROM messages
      WHERE user_id = $1 AND timestamp >= NOW() - INTERVAL '${daysBack} days'
      GROUP BY day
      ORDER BY day
    `, [user.id]);

    res.json({
      user: { username: user.username, display_name: user.display_name },
      period: `${daysBack} days`,
      hourly: hourlyResult.rows.map(row => ({
        hour: parseInt(row.hour_of_day),
        messageCount: parseInt(row.message_count)
      })),
      weekday: weekdayResult.rows.map(row => ({
        day: parseInt(row.day_of_week),
        messageCount: parseInt(row.message_count)
      })),
      daily: dailyResult.rows.map(row => ({
        day: row.day,
        messageCount: parseInt(row.message_count)
      }))
    });
  } catch (error) {
    logger.error('Error fetching user activity:', error.message);
    res.status(500).json({ error: 'Failed to fetch user activity' });
  }
});

/**
 * GET /api/users/:username/analytics/channels
 * Get user channel activity breakdown
 */
router.get('/:username/analytics/channels', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.getByUsername(username);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const daysBack = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365);
    
    const result = await query(`
      SELECT 
        c.name as channel_name,
        c.display_name as channel_display_name,
        COUNT(*) as message_count,
        COUNT(DISTINCT DATE_TRUNC('day', m.timestamp)) as active_days,
        MIN(m.timestamp) as first_message,
        MAX(m.timestamp) as last_message
      FROM messages m
      JOIN channels c ON m.channel_id = c.id
      WHERE m.user_id = $1 AND m.timestamp >= NOW() - INTERVAL '${daysBack} days'
      GROUP BY c.id
      ORDER BY message_count DESC
    `, [user.id]);

    res.json({
      user: { username: user.username, display_name: user.display_name },
      period: `${daysBack} days`,
      channels: result.rows.map(row => ({
        name: row.channel_name,
        displayName: row.channel_display_name,
        messageCount: parseInt(row.message_count),
        activeDays: parseInt(row.active_days),
        firstMessage: row.first_message,
        lastMessage: row.last_message
      }))
    });
  } catch (error) {
    logger.error('Error fetching user channel stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch user channel stats' });
  }
});

/**
 * GET /api/users/:username/analytics/emotes
 * Get user's most used emotes
 */
router.get('/:username/analytics/emotes', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.getByUsername(username);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const daysBack = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    
    // This extracts emote patterns from messages (basic detection for common emote patterns)
    const result = await query(`
      SELECT 
        word,
        COUNT(*) as usage_count
      FROM (
        SELECT UNNEST(STRING_TO_ARRAY(message_text, ' ')) as word
        FROM messages
        WHERE user_id = $1 AND timestamp >= NOW() - INTERVAL '${daysBack} days'
      ) words
      WHERE 
        word ~ '^[A-Z][a-zA-Z0-9]+$'  -- CamelCase pattern (common emote format)
        AND LENGTH(word) >= 3
        AND LENGTH(word) <= 30
      GROUP BY word
      HAVING COUNT(*) >= 3
      ORDER BY usage_count DESC
      LIMIT $2
    `, [user.id, limit]);

    res.json({
      user: { username: user.username, display_name: user.display_name },
      period: `${daysBack} days`,
      emotes: result.rows.map(row => ({
        emote: row.word,
        count: parseInt(row.usage_count)
      }))
    });
  } catch (error) {
    logger.error('Error fetching user emotes:', error.message);
    res.status(500).json({ error: 'Failed to fetch user emotes' });
  }
});

/**
 * GET /api/users/:username/analytics/summary
 * Get comprehensive user analytics summary
 */
router.get('/:username/analytics/summary', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.getByUsername(username);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const daysBack = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365);
    
    // Get message stats
    const messageStats = await query(`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(DISTINCT DATE_TRUNC('day', timestamp)) as active_days,
        AVG(LENGTH(message_text)) as avg_message_length,
        MAX(LENGTH(message_text)) as max_message_length,
        COUNT(*) FILTER (WHERE is_deleted = true) as deleted_messages
      FROM messages
      WHERE user_id = $1 AND timestamp >= NOW() - INTERVAL '${daysBack} days'
    `, [user.id]);

    // Get most active hour
    const peakHour = await query(`
      SELECT 
        EXTRACT(HOUR FROM timestamp) as hour,
        COUNT(*) as count
      FROM messages
      WHERE user_id = $1 AND timestamp >= NOW() - INTERVAL '${daysBack} days'
      GROUP BY hour
      ORDER BY count DESC
      LIMIT 1
    `, [user.id]);

    // Get mod action summary
    const modActions = await query(`
      SELECT 
        action_type,
        COUNT(*) as count
      FROM mod_actions
      WHERE target_user_id = $1 AND timestamp >= NOW() - INTERVAL '${daysBack} days'
      GROUP BY action_type
    `, [user.id]);

    // Get message streak (consecutive days)
    const streakQuery = await query(`
      WITH daily_activity AS (
        SELECT DISTINCT DATE_TRUNC('day', timestamp)::date as activity_date
        FROM messages
        WHERE user_id = $1
        ORDER BY activity_date DESC
      ),
      gaps AS (
        SELECT 
          activity_date,
          activity_date - (ROW_NUMBER() OVER (ORDER BY activity_date))::int as grp
        FROM daily_activity
      )
      SELECT COUNT(*) as streak
      FROM gaps
      WHERE grp = (SELECT grp FROM gaps ORDER BY activity_date DESC LIMIT 1)
    `, [user.id]);

    const stats = messageStats.rows[0];
    const modActionsMap = {};
    modActions.rows.forEach(row => {
      modActionsMap[row.action_type] = parseInt(row.count);
    });

    res.json({
      user: { username: user.username, display_name: user.display_name },
      period: `${daysBack} days`,
      summary: {
        totalMessages: parseInt(stats.total_messages) || 0,
        activeDays: parseInt(stats.active_days) || 0,
        avgMessageLength: Math.round(parseFloat(stats.avg_message_length) || 0),
        maxMessageLength: parseInt(stats.max_message_length) || 0,
        deletedMessages: parseInt(stats.deleted_messages) || 0,
        peakHour: peakHour.rows[0] ? parseInt(peakHour.rows[0].hour) : null,
        peakHourMessages: peakHour.rows[0] ? parseInt(peakHour.rows[0].count) : 0,
        currentStreak: parseInt(streakQuery.rows[0]?.streak) || 0,
        bans: modActionsMap.ban || 0,
        timeouts: modActionsMap.timeout || 0,
        deletions: modActionsMap.delete || 0
      }
    });
  } catch (error) {
    logger.error('Error fetching user summary:', error.message);
    res.status(500).json({ error: 'Failed to fetch user summary' });
  }
});

/**
 * DELETE /api/users/:username
 * Delete user and all their data
 * Requires authentication
 */
router.delete('/:username', requireAuth, async (req, res) => {
  try {
    const { username } = req.params;
    
    const user = await User.getByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await User.deleteUser(user.id);
    logger.info(`Deleted user ${username} and ${result.messagesDeleted} messages, ${result.modActionsDeleted} mod actions`);
    
    res.json({ 
      message: 'User deleted successfully',
      ...result
    });
  } catch (error) {
    logger.error('Error deleting user:', error.message);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
