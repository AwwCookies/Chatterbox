import express from 'express';
import Tier from '../models/Tier.js';
import ApiUsage from '../models/ApiUsage.js';
import { requireUserAuth, requireAdmin } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import pool from '../config/database.js';

const router = express.Router();

// ============================================
// TIER MANAGEMENT (Admin only)
// ============================================

/**
 * GET /api/admin/tiers - List all tiers
 */
router.get('/tiers', requireUserAuth, requireAdmin, async (req, res) => {
  try {
    const tiers = await Tier.getAll();
    res.json({ tiers });
  } catch (error) {
    logger.error('Error fetching tiers:', error);
    res.status(500).json({ error: 'Failed to fetch tiers' });
  }
});

/**
 * GET /api/admin/tiers/:id - Get a specific tier
 */
router.get('/tiers/:id', requireUserAuth, requireAdmin, async (req, res) => {
  try {
    const tier = await Tier.getById(req.params.id);
    if (!tier) {
      return res.status(404).json({ error: 'Tier not found' });
    }
    res.json({ tier });
  } catch (error) {
    logger.error('Error fetching tier:', error);
    res.status(500).json({ error: 'Failed to fetch tier' });
  }
});

/**
 * POST /api/admin/tiers - Create a new tier
 */
router.post('/tiers', requireUserAuth, requireAdmin, async (req, res) => {
  try {
    const {
      name,
      displayName,
      description,
      maxWebhooks,
      maxChannels,
      maxApiCallsPerMinute,
      maxSearchResults,
      maxHistoryDays,
      canExport,
      canUseWebsocket,
      priceMonthly,
      priceYearly,
      isDefault,
      sortOrder,
    } = req.body;

    // Validation
    if (!name || !displayName) {
      return res.status(400).json({ error: 'Name and display name are required' });
    }

    // Check if name already exists
    const existing = await Tier.getByName(name);
    if (existing) {
      return res.status(400).json({ error: 'A tier with this name already exists' });
    }

    const tier = await Tier.create({
      name,
      displayName,
      description,
      maxWebhooks,
      maxChannels,
      maxApiCallsPerMinute,
      maxSearchResults,
      maxHistoryDays,
      canExport,
      canUseWebsocket,
      priceMonthly,
      priceYearly,
      isDefault,
      sortOrder,
    });

    logger.info(`Tier created: ${tier.name} by ${req.user.username}`);
    res.status(201).json({ tier });
  } catch (error) {
    logger.error('Error creating tier:', error);
    res.status(500).json({ error: 'Failed to create tier' });
  }
});

/**
 * PATCH /api/admin/tiers/:id - Update a tier
 */
router.patch('/tiers/:id', requireUserAuth, requireAdmin, async (req, res) => {
  try {
    const tierId = req.params.id;

    // Check tier exists
    const existing = await Tier.getById(tierId);
    if (!existing) {
      return res.status(404).json({ error: 'Tier not found' });
    }

    // Check name uniqueness if changing name
    if (req.body.name && req.body.name !== existing.name) {
      const nameExists = await Tier.getByName(req.body.name);
      if (nameExists) {
        return res.status(400).json({ error: 'A tier with this name already exists' });
      }
    }

    const tier = await Tier.update(tierId, req.body);

    logger.info(`Tier updated: ${tier.name} by ${req.user.username}`);
    res.json({ tier });
  } catch (error) {
    logger.error('Error updating tier:', error);
    res.status(500).json({ error: 'Failed to update tier' });
  }
});

/**
 * DELETE /api/admin/tiers/:id - Delete a tier
 */
router.delete('/tiers/:id', requireUserAuth, requireAdmin, async (req, res) => {
  try {
    const tier = await Tier.delete(req.params.id);
    if (!tier) {
      return res.status(404).json({ error: 'Tier not found' });
    }

    logger.info(`Tier deleted: ${tier.name} by ${req.user.username}`);
    res.json({ message: 'Tier deleted', tier });
  } catch (error) {
    if (error.message.includes('Cannot delete')) {
      return res.status(400).json({ error: error.message });
    }
    logger.error('Error deleting tier:', error);
    res.status(500).json({ error: 'Failed to delete tier' });
  }
});

/**
 * GET /api/admin/tiers/:id/users - Get users assigned to a tier
 */
router.get('/tiers/:id/users', requireUserAuth, requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;

    const users = await Tier.getUsersByTier(req.params.id, limit, offset);
    res.json({ users });
  } catch (error) {
    logger.error('Error fetching tier users:', error);
    res.status(500).json({ error: 'Failed to fetch tier users' });
  }
});

// ============================================
// USER TIER MANAGEMENT (Admin only)
// ============================================

/**
 * GET /api/admin/users/:username/tier - Get user's current tier
 */
router.get('/users/:username/tier', requireUserAuth, requireAdmin, async (req, res) => {
  try {
    // Find user by username
    const userResult = await pool.query(
      `SELECT id, username, display_name, is_admin FROM oauth_users WHERE username = $1`,
      [req.params.username]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    
    // Get tier (admin check handled inside)
    const tier = await Tier.getUserTier(user.id, user.is_admin);
    const assignment = await Tier.getUserTierAssignment(user.id);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        is_admin: user.is_admin,
      },
      tier,
      assignment,
    });
  } catch (error) {
    logger.error('Error fetching user tier:', error);
    res.status(500).json({ error: 'Failed to fetch user tier' });
  }
});

/**
 * PUT /api/admin/users/:username/tier - Assign tier to user
 */
router.put('/users/:username/tier', requireUserAuth, requireAdmin, async (req, res) => {
  try {
    // Accept both tier_id and tierId for compatibility
    const tierId = req.body.tier_id || req.body.tierId;
    const { expiresAt, expires_at, notes } = req.body;

    if (!tierId) {
      return res.status(400).json({ error: 'Tier ID is required' });
    }

    // Find user by username
    const userResult = await pool.query(
      `SELECT id, username FROM oauth_users WHERE username = $1`,
      [req.params.username]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Verify tier exists
    const tier = await Tier.getById(tierId);
    if (!tier) {
      return res.status(404).json({ error: 'Tier not found' });
    }

    // Assign tier
    const assignment = await Tier.assignToUser(
      user.id,
      tierId,
      req.user.username,
      expiresAt || expires_at || null,
      notes || null
    );

    logger.info(`Tier ${tier.name} assigned to ${user.username} by ${req.user.username}`);
    
    res.json({
      message: 'Tier assigned successfully',
      assignment,
      tier,
    });
  } catch (error) {
    logger.error('Error assigning tier:', error);
    res.status(500).json({ error: 'Failed to assign tier' });
  }
});

/**
 * DELETE /api/admin/users/:username/tier - Remove tier from user (revert to default)
 */
router.delete('/users/:username/tier', requireUserAuth, requireAdmin, async (req, res) => {
  try {
    // Find user by username
    const userResult = await pool.query(
      `SELECT id, username FROM oauth_users WHERE username = $1`,
      [req.params.username]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Remove tier assignment
    await Tier.removeFromUser(user.id);

    logger.info(`Tier removed from ${user.username} by ${req.user.username}`);
    
    res.json({ message: 'User reverted to default tier' });
  } catch (error) {
    logger.error('Error removing tier:', error);
    res.status(500).json({ error: 'Failed to remove tier' });
  }
});

// ============================================
// USER USAGE STATS (Admin only)
// ============================================

/**
 * GET /api/admin/users/:username/usage - Get user's API usage stats
 */
router.get('/users/:username/usage', requireUserAuth, requireAdmin, async (req, res) => {
  try {
    // Find user by username
    const userResult = await pool.query(
      `SELECT id, username, display_name, is_admin FROM oauth_users WHERE username = $1`,
      [req.params.username]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Date range (default: last 7 days)
    const since = req.query.since 
      ? new Date(req.query.since) 
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const until = req.query.until 
      ? new Date(req.query.until) 
      : new Date();

    // Get stats
    const [stats, endpoints, timeline] = await Promise.all([
      ApiUsage.getUserStats(user.id, since, until),
      ApiUsage.getUserEndpointBreakdown(user.id, since, until),
      ApiUsage.getUserUsageOverTime(user.id, since, until, req.query.bucket || 'hour'),
    ]);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        is_admin: user.is_admin,
      },
      period: { since, until },
      stats,
      endpoints,
      timeline,
    });
  } catch (error) {
    logger.error('Error fetching user usage:', error);
    res.status(500).json({ error: 'Failed to fetch user usage' });
  }
});

// ============================================
// SYSTEM USAGE ANALYTICS (Admin only)
// ============================================

/**
 * GET /api/admin/usage - Get system-wide usage stats
 */
router.get('/usage', requireUserAuth, requireAdmin, async (req, res) => {
  try {
    // Date range (default: last 24 hours)
    const since = req.query.since 
      ? new Date(req.query.since) 
      : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const until = req.query.until 
      ? new Date(req.query.until) 
      : new Date();

    // Get all stats in parallel
    const [
      systemStats,
      topUsers,
      topEndpoints,
      timeline,
      responseTimeDist,
      statusCodeDist,
    ] = await Promise.all([
      ApiUsage.getSystemStats(since, until),
      ApiUsage.getTopUsers(since, until, parseInt(req.query.topUsersLimit) || 20),
      ApiUsage.getTopEndpoints(since, until, parseInt(req.query.topEndpointsLimit) || 20),
      ApiUsage.getSystemUsageOverTime(since, until, req.query.bucket || 'hour'),
      ApiUsage.getResponseTimeDistribution(since, until),
      ApiUsage.getStatusCodeDistribution(since, until),
    ]);

    res.json({
      period: { since, until },
      stats: systemStats,
      topUsers,
      topEndpoints,
      timeline,
      distributions: {
        responseTime: responseTimeDist,
        statusCode: statusCodeDist,
      },
    });
  } catch (error) {
    logger.error('Error fetching system usage:', error);
    res.status(500).json({ error: 'Failed to fetch system usage' });
  }
});

/**
 * POST /api/admin/usage/aggregate - Manually trigger daily aggregation
 */
router.post('/usage/aggregate', requireUserAuth, requireAdmin, async (req, res) => {
  try {
    const date = req.body.date ? new Date(req.body.date) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rowsAffected = await ApiUsage.aggregateDaily(date);

    logger.info(`Manual aggregation triggered by ${req.user.username} for ${date.toISOString()}`);
    
    res.json({
      message: 'Aggregation completed',
      date: date.toISOString().split('T')[0],
      rowsAffected,
    });
  } catch (error) {
    logger.error('Error running aggregation:', error);
    res.status(500).json({ error: 'Failed to run aggregation' });
  }
});

/**
 * POST /api/admin/usage/cleanup - Manually trigger cleanup
 */
router.post('/usage/cleanup', requireUserAuth, requireAdmin, async (req, res) => {
  try {
    const days = parseInt(req.body.days) || 90;
    const [usageDeleted, rateLimitsDeleted] = await Promise.all([
      ApiUsage.cleanup(days),
      ApiUsage.cleanupRateLimits(),
    ]);

    logger.info(`Cleanup triggered by ${req.user.username}: ${usageDeleted} usage records, ${rateLimitsDeleted} rate limit buckets`);
    
    res.json({
      message: 'Cleanup completed',
      usageRecordsDeleted: usageDeleted,
      rateLimitBucketsDeleted: rateLimitsDeleted,
    });
  } catch (error) {
    logger.error('Error running cleanup:', error);
    res.status(500).json({ error: 'Failed to run cleanup' });
  }
});

export default router;
