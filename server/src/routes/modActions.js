import { Router } from 'express';
import ModAction from '../models/ModAction.js';
import { validatePagination, validateDate, sanitizeChannelName, sanitizeUsername, validateActionType } from '../utils/validators.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /api/mod-actions
 * List mod actions with filters
 */
router.get('/', async (req, res) => {
  try {
    const { limit, offset } = validatePagination(req.query);
    const since = validateDate(req.query.since);
    const until = validateDate(req.query.until);
    const channel = sanitizeChannelName(req.query.channel);
    const moderator = sanitizeUsername(req.query.moderator);
    const target = sanitizeUsername(req.query.target);
    const type = validateActionType(req.query.type);

    const result = await ModAction.getAll({
      type,
      channel,
      moderator,
      target,
      since,
      until,
      limit,
      offset
    });

    res.json(result);
  } catch (error) {
    logger.error('Error fetching mod actions:', error.message);
    res.status(500).json({ error: 'Failed to fetch mod actions' });
  }
});

/**
 * GET /api/mod-actions/recent
 * Get recent mod actions (last 100)
 */
router.get('/recent', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const actions = await ModAction.getRecent(limit);
    res.json({ actions });
  } catch (error) {
    logger.error('Error fetching recent mod actions:', error.message);
    res.status(500).json({ error: 'Failed to fetch recent mod actions' });
  }
});

/**
 * GET /api/mod-actions/stats
 * Get aggregate statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const since = validateDate(req.query.since);
    const until = validateDate(req.query.until);
    const channel = sanitizeChannelName(req.query.channel);

    const stats = await ModAction.getStats({
      channel,
      since,
      until
    });

    res.json(stats);
  } catch (error) {
    logger.error('Error fetching mod action stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch mod action stats' });
  }
});

export default router;
