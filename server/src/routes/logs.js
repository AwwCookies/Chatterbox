import express from 'express';
import logService from '../services/logService.js';
import { requireUserAuth, requireAdmin } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/admin/logs - Get server logs
 */
router.get('/', requireUserAuth, requireAdmin, async (req, res) => {
  try {
    const {
      level,
      search,
      since,
      until,
      limit = 100,
      offset = 0,
      order = 'desc',
    } = req.query;

    // Parse level as array if comma-separated
    const levelFilter = level ? level.split(',') : undefined;

    const result = logService.getLogs({
      level: levelFilter,
      search,
      since,
      until,
      limit: Math.min(parseInt(limit) || 100, 1000), // Max 1000 per request
      offset: parseInt(offset) || 0,
      order,
    });

    res.json(result);
  } catch (error) {
    logger.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

/**
 * GET /api/admin/logs/stats - Get log statistics
 */
router.get('/stats', requireUserAuth, requireAdmin, async (req, res) => {
  try {
    const stats = logService.getStats();
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching log stats:', error);
    res.status(500).json({ error: 'Failed to fetch log statistics' });
  }
});

/**
 * GET /api/admin/logs/stream - Get logs since a given ID (for polling)
 */
router.get('/stream', requireUserAuth, requireAdmin, async (req, res) => {
  try {
    const { lastId = 0 } = req.query;
    const logs = logService.getLogsSince(parseInt(lastId) || 0);
    
    res.json({
      logs,
      lastId: logs.length > 0 ? logs[logs.length - 1].id : parseInt(lastId) || 0,
    });
  } catch (error) {
    logger.error('Error streaming logs:', error);
    res.status(500).json({ error: 'Failed to stream logs' });
  }
});

/**
 * DELETE /api/admin/logs - Clear all logs
 */
router.delete('/', requireUserAuth, requireAdmin, async (req, res) => {
  try {
    logService.clear();
    logger.info('Logs cleared by admin');
    res.json({ message: 'Logs cleared' });
  } catch (error) {
    logger.error('Error clearing logs:', error);
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

export default router;
