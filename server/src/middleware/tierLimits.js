import Tier from '../models/Tier.js';
import ApiUsage from '../models/ApiUsage.js';
import logger from '../utils/logger.js';
import jwt from 'jsonwebtoken';
import { OAuthUser } from '../models/OAuthUser.js';

// Get JWT secret lazily to ensure env vars are loaded
const getJwtSecret = () => process.env.JWT_SECRET || process.env.API_KEY || 'default-jwt-secret-change-me';

/**
 * Middleware to attach user's tier to request
 * Should run after authentication middleware
 */
export const attachTier = async (req, res, next) => {
  try {
    if (req.user) {
      const tier = await Tier.getUserTier(req.user.id, req.user.is_admin);
      req.tier = tier;
    }
    next();
  } catch (error) {
    logger.error('Error attaching tier:', error);
    // Don't fail the request, just continue without tier
    next();
  }
};

/**
 * Global rate limit middleware for authenticated users
 * This middleware attempts to authenticate the user and apply tier-based rate limits
 * Should be used globally - unauthenticated requests pass through (handled by IP rate limiter)
 */
export const globalAuthRateLimit = async (req, res, next) => {
  try {
    // Try to get user from Bearer token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No auth - pass through (IP rate limiter handles these)
      return next();
    }

    const token = authHeader.substring(7);
    let decoded;
    
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch (error) {
      // Invalid token - pass through (IP rate limiter handles these)
      return next();
    }

    // Get user if not already set
    if (!req.user) {
      const user = await OAuthUser.getById(decoded.userId);
      if (!user) {
        return next(); // User not found, IP rate limiter handles
      }
      req.user = user;
      req.tokenData = decoded;
    }

    // ADMIN BYPASS - skip all rate limit checks
    if (req.user.is_admin) {
      return next();
    }

    // Get user's tier
    const tier = req.tier || await Tier.getUserTier(req.user.id, false);
    req.tier = tier;
    
    if (!tier) {
      return next();
    }

    // Check if unlimited
    if (tier.unlimited || Tier.isUnlimited(tier.max_api_calls_per_minute)) {
      return next();
    }

    // Get current rate limit count
    const currentCount = await ApiUsage.getRateLimitCount(req.user.id, 'api_calls', 1);

    // Check if over limit
    if (currentCount >= tier.max_api_calls_per_minute) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `You have exceeded your rate limit of ${tier.max_api_calls_per_minute} API calls per minute.`,
        limit: tier.max_api_calls_per_minute,
        current: currentCount,
        tier: tier.display_name,
        retryAfter: 60, // seconds
        upgrade: 'Upgrade your tier for higher limits',
      });
    }

    // Increment the counter
    await ApiUsage.incrementRateLimit(req.user.id, 'api_calls', 1);

    // Add rate limit headers
    res.set('X-RateLimit-Limit', tier.max_api_calls_per_minute);
    res.set('X-RateLimit-Remaining', Math.max(0, tier.max_api_calls_per_minute - currentCount - 1));
    res.set('X-RateLimit-Reset', Math.ceil(Date.now() / 60000) * 60); // Next minute boundary

    // Warning at 80%
    const percentage = ((currentCount + 1) / tier.max_api_calls_per_minute) * 100;
    if (percentage >= 80) {
      res.set('X-RateLimit-Warning', `You are at ${Math.round(percentage)}% of your rate limit`);
    }

    next();
  } catch (error) {
    logger.error('Error in global auth rate limit middleware:', error);
    // Don't fail the request on rate limit errors
    next();
  }
};

/**
 * Middleware to enforce API rate limits
 */
export const enforceRateLimit = async (req, res, next) => {
  try {
    // Skip if no user (unauthenticated endpoints)
    if (!req.user) {
      return next();
    }

    // ADMIN BYPASS - skip all rate limit checks
    if (req.user.is_admin) {
      return next();
    }

    // Get user's tier
    const tier = req.tier || await Tier.getUserTier(req.user.id, false);
    
    if (!tier) {
      return next();
    }

    // Check if unlimited
    if (tier.unlimited || Tier.isUnlimited(tier.max_api_calls_per_minute)) {
      return next();
    }

    // Get current rate limit count
    const currentCount = await ApiUsage.getRateLimitCount(req.user.id, 'api_calls', 1);

    // Check if over limit
    if (currentCount >= tier.max_api_calls_per_minute) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `You have exceeded your rate limit of ${tier.max_api_calls_per_minute} API calls per minute.`,
        limit: tier.max_api_calls_per_minute,
        current: currentCount,
        tier: tier.display_name,
        retryAfter: 60, // seconds
        upgrade: 'Upgrade your tier for higher limits',
      });
    }

    // Increment the counter
    await ApiUsage.incrementRateLimit(req.user.id, 'api_calls', 1);

    // Add rate limit headers
    res.set('X-RateLimit-Limit', tier.max_api_calls_per_minute);
    res.set('X-RateLimit-Remaining', Math.max(0, tier.max_api_calls_per_minute - currentCount - 1));
    res.set('X-RateLimit-Reset', Math.ceil(Date.now() / 60000) * 60); // Next minute boundary

    // Warning at 80%
    const percentage = ((currentCount + 1) / tier.max_api_calls_per_minute) * 100;
    if (percentage >= 80) {
      res.set('X-RateLimit-Warning', `You are at ${Math.round(percentage)}% of your rate limit`);
    }

    next();
  } catch (error) {
    logger.error('Error in rate limit middleware:', error);
    // Don't fail the request on rate limit errors
    next();
  }
};

/**
 * Middleware to check webhook limit
 */
export const checkWebhookLimit = async (req, res, next) => {
  try {
    // Skip for non-create operations
    if (req.method !== 'POST') {
      return next();
    }

    // Skip if no user
    if (!req.user) {
      return next();
    }

    // ADMIN BYPASS
    if (req.user.is_admin) {
      return next();
    }

    const tier = req.tier || await Tier.getUserTier(req.user.id, false);
    
    if (!tier || Tier.isUnlimited(tier.max_webhooks)) {
      return next();
    }

    // Count current webhooks
    const Webhook = (await import('../models/Webhook.js')).default;
    const webhooks = await Webhook.getUserWebhooks(req.user.id);
    const currentCount = webhooks.length;

    if (currentCount >= tier.max_webhooks) {
      return res.status(403).json({
        error: 'Webhook limit reached',
        message: `You have reached your limit of ${tier.max_webhooks} webhooks.`,
        limit: tier.max_webhooks,
        current: currentCount,
        tier: tier.display_name,
        upgrade: 'Upgrade your tier to create more webhooks',
      });
    }

    // Add warning header if approaching limit
    const percentage = (currentCount / tier.max_webhooks) * 100;
    if (percentage >= 80) {
      res.set('X-Webhook-Limit-Warning', `You are at ${Math.round(percentage)}% of your webhook limit`);
    }

    next();
  } catch (error) {
    logger.error('Error checking webhook limit:', error);
    next();
  }
};

/**
 * Middleware to check channel subscription limit
 */
export const checkChannelLimit = async (req, res, next) => {
  try {
    // Skip if no user
    if (!req.user) {
      return next();
    }

    // ADMIN BYPASS
    if (req.user.is_admin) {
      return next();
    }

    const tier = req.tier || await Tier.getUserTier(req.user.id, false);
    
    if (!tier || Tier.isUnlimited(tier.max_channels)) {
      return next();
    }

    // This would need to count user's followed/tracked channels
    // Implementation depends on your channel tracking system
    
    next();
  } catch (error) {
    logger.error('Error checking channel limit:', error);
    next();
  }
};

/**
 * Middleware to enforce search result limits
 */
export const enforceSearchLimit = (req, res, next) => {
  try {
    // Skip if no user
    if (!req.user) {
      return next();
    }

    const tier = req.tier;
    
    if (!tier || Tier.isUnlimited(tier.max_search_results)) {
      return next();
    }

    // ADMIN BYPASS
    if (req.user.is_admin) {
      return next();
    }

    // Limit the requested limit to tier max
    const requestedLimit = parseInt(req.query.limit) || 50;
    req.query.limit = Math.min(requestedLimit, tier.max_search_results);

    // Store original limit for response
    req.tierLimitApplied = requestedLimit > tier.max_search_results;

    next();
  } catch (error) {
    logger.error('Error enforcing search limit:', error);
    next();
  }
};

/**
 * Middleware to enforce history day limits
 */
export const enforceHistoryLimit = (req, res, next) => {
  try {
    // Skip if no user
    if (!req.user) {
      return next();
    }

    const tier = req.tier;
    
    // Unlimited history
    if (!tier || tier.max_history_days === null || tier.max_history_days === undefined) {
      return next();
    }

    // ADMIN BYPASS
    if (req.user.is_admin) {
      return next();
    }

    // Calculate earliest allowed date
    const earliestDate = new Date();
    earliestDate.setDate(earliestDate.getDate() - tier.max_history_days);

    // Check if requested date is too old
    if (req.query.since) {
      const requestedDate = new Date(req.query.since);
      if (requestedDate < earliestDate) {
        req.query.since = earliestDate.toISOString();
        req.historyLimitApplied = true;
      }
    }

    // Store limit info for response
    req.maxHistoryDays = tier.max_history_days;

    next();
  } catch (error) {
    logger.error('Error enforcing history limit:', error);
    next();
  }
};

/**
 * Middleware to check export permission
 */
export const checkExportPermission = async (req, res, next) => {
  try {
    // Skip if no user
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // ADMIN BYPASS
    if (req.user.is_admin) {
      return next();
    }

    const tier = req.tier || await Tier.getUserTier(req.user.id, false);
    
    if (!tier) {
      return res.status(403).json({
        error: 'No tier assigned',
        message: 'Unable to determine your access level',
      });
    }

    if (!tier.can_export) {
      return res.status(403).json({
        error: 'Export not available',
        message: 'Export functionality is not available on your current tier.',
        tier: tier.display_name,
        upgrade: 'Upgrade to Pro or Enterprise to enable exports',
      });
    }

    next();
  } catch (error) {
    logger.error('Error checking export permission:', error);
    next();
  }
};

/**
 * Middleware to check websocket permission
 */
export const checkWebsocketPermission = async (req, res, next) => {
  try {
    // Skip if no user
    if (!req.user) {
      return next();
    }

    // ADMIN BYPASS
    if (req.user.is_admin) {
      return next();
    }

    const tier = req.tier || await Tier.getUserTier(req.user.id, false);
    
    if (!tier) {
      return next();
    }

    if (!tier.can_use_websocket) {
      return res.status(403).json({
        error: 'WebSocket not available',
        message: 'WebSocket functionality is not available on your current tier.',
        tier: tier.display_name,
        upgrade: 'Upgrade to enable WebSocket connections',
      });
    }

    next();
  } catch (error) {
    logger.error('Error checking websocket permission:', error);
    next();
  }
};

/**
 * Combined middleware that attaches tier and enforces rate limit
 */
export const tierMiddleware = [attachTier, enforceRateLimit];

export default {
  attachTier,
  enforceRateLimit,
  globalAuthRateLimit,
  checkWebhookLimit,
  checkChannelLimit,
  enforceSearchLimit,
  enforceHistoryLimit,
  checkExportPermission,
  checkWebsocketPermission,
  tierMiddleware,
};
