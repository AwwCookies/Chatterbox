import { Router } from 'express';
import Channel from '../models/Channel.js';
import Message from '../models/Message.js';
import { validatePagination, validateDate, sanitizeChannelName } from '../utils/validators.js';
import logger from '../utils/logger.js';

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
    res.json({ channels });
  } catch (error) {
    logger.error('Error fetching channels:', error.message);
    res.status(500).json({ error: 'Failed to fetch channels' });
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

    res.json(channel);
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
 */
router.post('/', async (req, res) => {
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
 */
router.patch('/:name', async (req, res) => {
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
 */
router.delete('/:name', async (req, res) => {
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
 */
router.post('/:name/rejoin', async (req, res) => {
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

export default router;
