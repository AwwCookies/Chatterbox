import { Router } from 'express';
import Message from '../models/Message.js';
import User from '../models/User.js';
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

    const messages = await Message.search(q.trim(), {
      channel,
      user,
      limit,
      offset
    });

    res.json({ messages });
  } catch (error) {
    logger.error('Error searching messages:', error.message);
    res.status(500).json({ error: 'Failed to search messages' });
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

export default router;
