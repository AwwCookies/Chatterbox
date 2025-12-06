import { Router } from 'express';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { query } from '../config/database.js';
import { validatePagination, validateDate, sanitizeChannelName, sanitizeUsername } from '../utils/validators.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /api/messages
 * List messages with filters
 */
router.get('/', async (req, res) => {
  try {
    const { limit, offset } = validatePagination(req.query);
    const since = validateDate(req.query.since);
    const until = validateDate(req.query.until);
    const channel = sanitizeChannelName(req.query.channel);
    const user = sanitizeUsername(req.query.user);
    const search = req.query.search?.trim();
    const includeDeleted = req.query.includeDeleted === 'true';

    const result = await Message.getAll({
      channel,
      user,
      limit,
      offset,
      since,
      until,
      search,
      includeDeleted
    });

    res.json(result);
  } catch (error) {
    logger.error('Error fetching messages:', error.message);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * GET /api/messages/search
 * Full-text search messages
 */
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const { limit, offset } = validatePagination(req.query);
    const channel = sanitizeChannelName(req.query.channel);
    const user = sanitizeUsername(req.query.user);

    const result = await Message.search(q.trim(), {
      channel,
      user,
      limit,
      offset
    });

    res.json(result);
  } catch (error) {
    logger.error('Error searching messages:', error.message);
    res.status(500).json({ error: 'Failed to search messages' });
  }
});

/**
 * GET /api/messages/mentions/:username
 * Get messages that mention a specific user
 */
router.get('/mentions/:username', async (req, res) => {
  try {
    const username = sanitizeUsername(req.params.username);
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const channelId = req.query.channelId ? parseInt(req.query.channelId) : null;
    const daysBack = parseInt(req.query.daysBack) || 30;
    const maxResults = parseInt(req.query.maxResults) || 100;

    const result = await query(
      'SELECT * FROM get_messages_mentioning_user($1, $2, $3, $4)',
      [username, channelId, daysBack, maxResults]
    );

    res.json({
      mentions: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    logger.error('Error fetching user mentions:', error.message);
    res.status(500).json({ error: 'Failed to fetch user mentions' });
  }
});

/**
 * GET /api/messages/replies/:userId
 * Get all replies to messages by a specific user
 */
router.get('/replies/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const channelId = req.query.channelId ? parseInt(req.query.channelId) : null;
    const { limit, offset } = validatePagination(req.query);

    let sql = `
      SELECT m.*, 
             u.username, u.display_name as user_display_name,
             c.name as channel_name, c.display_name as channel_display_name,
             parent.message_text as parent_message_text,
             parent_user.username as parent_username,
             parent_user.display_name as parent_display_name
      FROM messages m
      JOIN users u ON m.user_id = u.id
      JOIN channels c ON m.channel_id = c.id
      LEFT JOIN messages parent ON m.reply_to_message_id = parent.message_id
      LEFT JOIN users parent_user ON parent.user_id = parent_user.id
      WHERE m.reply_to_user_id = $1 AND m.is_deleted = FALSE
    `;
    const params = [userId];
    let paramIndex = 2;

    if (channelId) {
      sql += ` AND m.channel_id = $${paramIndex}`;
      params.push(channelId);
      paramIndex++;
    }

    sql += ` ORDER BY m.timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    // Get total count
    let countSql = `
      SELECT COUNT(*) as total 
      FROM messages m 
      WHERE m.reply_to_user_id = $1 AND m.is_deleted = FALSE
    `;
    const countParams = [userId];
    if (channelId) {
      countSql += ' AND m.channel_id = $2';
      countParams.push(channelId);
    }
    
    const countResult = await query(countSql, countParams);

    res.json({
      replies: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset
    });
  } catch (error) {
    logger.error('Error fetching replies to user:', error.message);
    res.status(500).json({ error: 'Failed to fetch replies' });
  }
});

/**
 * GET /api/messages/:id
 * Get specific message by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const message = await Message.getById(parseInt(id));

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json(message);
  } catch (error) {
    logger.error('Error fetching message:', error.message);
    res.status(500).json({ error: 'Failed to fetch message' });
  }
});

/**
 * GET /api/messages/:messageId/thread
 * Get a message thread (parent message + all replies)
 */
router.get('/:messageId/thread', async (req, res) => {
  try {
    const { messageId } = req.params;
    const maxReplies = parseInt(req.query.maxReplies) || 100;

    const result = await query(
      'SELECT * FROM get_message_thread($1, $2)',
      [messageId, maxReplies]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message thread not found' });
    }

    // Separate parent from replies
    const parent = result.rows.find(r => r.is_parent);
    const replies = result.rows.filter(r => !r.is_parent);

    res.json({
      parent,
      replies,
      totalReplies: replies.length
    });
  } catch (error) {
    logger.error('Error fetching message thread:', error.message);
    res.status(500).json({ error: 'Failed to fetch message thread' });
  }
});

export default router;
