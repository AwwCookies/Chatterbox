import express from 'express';
import Tier from '../models/Tier.js';
import ApiUsage from '../models/ApiUsage.js';
import { requireUserAuth } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import pool from '../config/database.js';

const router = express.Router();

/**
 * GET /api/me/tier - Get current user's tier and limits
 */
router.get('/tier', requireUserAuth, async (req, res) => {
  try {
    const tier = await Tier.getUserTier(req.user.id, req.user.is_admin);
    const assignment = await Tier.getUserTierAssignment(req.user.id);

    // Get current usage counts for limit display
    let currentUsage = {};
    
    if (!tier.unlimited) {
      // Count current webhooks
      const webhookResult = await pool.query(
        `SELECT COUNT(*) as count FROM user_webhooks WHERE user_id = $1`,
        [req.user.id]
      );
      currentUsage.webhooks = parseInt(webhookResult.rows[0].count) || 0;

      // Get current API call rate
      const rateCount = await ApiUsage.getRateLimitCount(req.user.id, 'api_calls', 1);
      currentUsage.apiCallsThisMinute = rateCount;
    }

    res.json({
      tier: {
        id: tier.tier_id,
        name: tier.tier_name,
        displayName: tier.display_name,
        isAdmin: tier.is_admin || false,
        unlimited: tier.unlimited || false,
      },
      limits: {
        maxWebhooks: tier.max_webhooks,
        maxChannels: tier.max_channels,
        maxApiCallsPerMinute: tier.max_api_calls_per_minute,
        maxSearchResults: tier.max_search_results,
        maxHistoryDays: tier.max_history_days,
        canExport: tier.can_export,
        canUseWebsocket: tier.can_use_websocket,
      },
      currentUsage,
      assignment: assignment ? {
        assignedAt: assignment.assigned_at,
        assignedBy: assignment.assigned_by,
        expiresAt: assignment.expires_at,
        notes: assignment.notes,
      } : null,
    });
  } catch (error) {
    logger.error('Error fetching user tier:', error);
    res.status(500).json({ error: 'Failed to fetch tier information' });
  }
});

/**
 * GET /api/me/usage - Get current user's usage stats
 */
router.get('/usage', requireUserAuth, async (req, res) => {
  try {
    // Date range (default: last 7 days)
    const since = req.query.since 
      ? new Date(req.query.since) 
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const until = req.query.until 
      ? new Date(req.query.until) 
      : new Date();

    // Determine bucket based on time range
    const rangeMs = until - since;
    const bucket = rangeMs > 7 * 24 * 60 * 60 * 1000 ? 'day' : 'hour';

    // Get stats
    const [stats, endpoints, timeline] = await Promise.all([
      ApiUsage.getUserStats(req.user.id, since, until),
      ApiUsage.getUserEndpointBreakdown(req.user.id, since, until, 10),
      ApiUsage.getUserUsageOverTime(req.user.id, since, until, bucket),
    ]);

    // Get tier for context
    const tier = await Tier.getUserTier(req.user.id, req.user.is_admin);

    res.json({
      period: { since, until },
      tier: {
        name: tier.tier_name,
        displayName: tier.display_name,
        unlimited: tier.unlimited,
      },
      stats: {
        totalCalls: parseInt(stats.total_calls) || 0,
        searchQueries: parseInt(stats.search_queries) || 0,
        exports: parseInt(stats.exports) || 0,
        avgResponseTime: parseInt(stats.avg_response_time) || 0,
      },
      topEndpoints: endpoints.map(e => ({
        endpoint: e.endpoint,
        method: e.method,
        callCount: parseInt(e.call_count),
        avgResponseTime: parseInt(e.avg_response_time),
        errorCount: parseInt(e.error_count),
      })),
      timeline: timeline.map(t => ({
        timestamp: t.time_bucket,
        callCount: parseInt(t.call_count),
        avgResponseTime: parseInt(t.avg_response_time),
        errorCount: parseInt(t.error_count),
      })),
    });
  } catch (error) {
    logger.error('Error fetching user usage:', error);
    res.status(500).json({ error: 'Failed to fetch usage information' });
  }
});

/**
 * GET /api/me/usage/summary - Get a quick summary for dashboard
 */
router.get('/usage/summary', requireUserAuth, async (req, res) => {
  try {
    const tier = await Tier.getUserTier(req.user.id, req.user.is_admin);

    // Today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStats = await ApiUsage.getUserStats(req.user.id, today, new Date());

    // This week's stats
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekStats = await ApiUsage.getUserStats(req.user.id, weekAgo, new Date());

    // Current rate limit usage - count from api_usage table directly (last minute)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const rateResult = await pool.query(
      `SELECT COUNT(*) as count FROM api_usage 
       WHERE user_id = $1 AND created_at >= $2`,
      [req.user.id, oneMinuteAgo]
    );
    const rateCount = parseInt(rateResult.rows[0].count) || 0;

    // Webhook count
    const webhookResult = await pool.query(
      `SELECT COUNT(*) as count FROM user_webhooks WHERE oauth_user_id = $1`,
      [req.user.id]
    );
    const webhookCount = parseInt(webhookResult.rows[0].count) || 0;

    // Calculate percentages (for non-unlimited tiers)
    let usagePercentages = {};
    if (!tier.unlimited) {
      usagePercentages = {
        webhooks: tier.max_webhooks > 0 
          ? Math.round((webhookCount / tier.max_webhooks) * 100) 
          : 0,
        apiCalls: tier.max_api_calls_per_minute > 0 
          ? Math.round((rateCount / tier.max_api_calls_per_minute) * 100) 
          : 0,
      };
    }

    res.json({
      tier: {
        name: tier.tier_name,
        displayName: tier.display_name,
        isAdmin: tier.is_admin,
        unlimited: tier.unlimited,
      },
      today: {
        calls: parseInt(todayStats.total_calls) || 0,
        searches: parseInt(todayStats.search_queries) || 0,
        exports: parseInt(todayStats.exports) || 0,
      },
      thisWeek: {
        calls: parseInt(weekStats.total_calls) || 0,
        searches: parseInt(weekStats.search_queries) || 0,
        exports: parseInt(weekStats.exports) || 0,
      },
      currentUsage: {
        webhooks: webhookCount,
        apiCallsThisMinute: rateCount,
      },
      limits: tier.unlimited ? null : {
        maxWebhooks: tier.max_webhooks,
        maxApiCallsPerMinute: tier.max_api_calls_per_minute,
      },
      percentages: tier.unlimited ? null : usagePercentages,
    });
  } catch (error) {
    logger.error('Error fetching usage summary:', error);
    res.status(500).json({ error: 'Failed to fetch usage summary' });
  }
});

export default router;
