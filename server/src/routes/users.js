import { Router } from 'express';
import User from '../models/User.js';
import Message from '../models/Message.js';
import ModAction from '../models/ModAction.js';
import { validatePagination, validateDate, sanitizeChannelName } from '../utils/validators.js';
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
    const channel = sanitizeChannelName(req.query.channel);

    let users;
    if (search) {
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

export default router;
