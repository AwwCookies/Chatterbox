import ApiUsage from '../models/ApiUsage.js';
import logger from '../utils/logger.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || process.env.API_KEY || 'default-jwt-secret-change-me';

/**
 * Try to extract user ID from JWT token without requiring auth
 */
function tryGetUserIdFromToken(req) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.userId || null;
  } catch (error) {
    // Token invalid or expired - that's fine, just return null
    return null;
  }
}

/**
 * Middleware to track API usage
 * Runs asynchronously to not slow down responses
 */
export const trackUsage = (req, res, next) => {
  // Capture start time
  const startTime = Date.now();
  
  // Try to get user ID from token early (for public routes)
  const tokenUserId = tryGetUserIdFromToken(req);

  // Store original end function
  const originalEnd = res.end;

  // Override end to capture response info
  res.end = function(chunk, encoding) {
    // Calculate response time
    const responseTime = Date.now() - startTime;

    // Log usage asynchronously (fire and forget)
    setImmediate(async () => {
      try {
        // Get user ID - prefer req.user (set by auth middleware) but fall back to token
        const userId = req.user?.id || tokenUserId || null;

        // Normalize endpoint (remove IDs and query params for grouping)
        const endpoint = normalizeEndpoint(req.path);

        // Get IP address
        const ipAddress = req.ip || 
          req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
          req.socket?.remoteAddress || 
          null;

        // Get user agent
        const userAgent = req.headers['user-agent'] || null;

        await ApiUsage.log({
          userId,
          endpoint,
          method: req.method,
          statusCode: res.statusCode,
          responseTimeMs: responseTime,
          ipAddress,
          userAgent: userAgent?.substring(0, 500), // Truncate long user agents
        });
      } catch (error) {
        // Silent fail - don't break anything
        logger.error('Error tracking API usage:', error);
      }
    });

    // Call original end
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Normalize endpoint for grouping
 * Replaces IDs and variable parts with placeholders
 */
function normalizeEndpoint(path) {
  return path
    // Remove trailing slash
    .replace(/\/$/, '')
    // Replace numeric IDs
    .replace(/\/\d+/g, '/:id')
    // Replace UUIDs
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
    // Replace Twitch-style IDs (alphanumeric, typically longer)
    .replace(/\/[a-z0-9]{20,}/gi, '/:id')
    // Keep first 100 chars
    .substring(0, 100);
}

/**
 * Middleware to skip tracking for certain paths
 */
export const skipTracking = (paths = []) => {
  return (req, res, next) => {
    const shouldSkip = paths.some(path => {
      if (typeof path === 'string') {
        return req.path.startsWith(path);
      }
      if (path instanceof RegExp) {
        return path.test(req.path);
      }
      return false;
    });

    if (shouldSkip) {
      return next();
    }

    return trackUsage(req, res, next);
  };
};

/**
 * Create tracking middleware with options
 */
export const createTrackingMiddleware = (options = {}) => {
  const {
    skipPaths = ['/health', '/metrics', '/favicon.ico'],
    skipMethods = ['OPTIONS'],
  } = options;

  return (req, res, next) => {
    // Skip certain methods
    if (skipMethods.includes(req.method)) {
      return next();
    }

    // Skip certain paths
    const shouldSkip = skipPaths.some(path => {
      if (typeof path === 'string') {
        return req.path === path || req.path.startsWith(path);
      }
      if (path instanceof RegExp) {
        return path.test(req.path);
      }
      return false;
    });

    if (shouldSkip) {
      return next();
    }

    return trackUsage(req, res, next);
  };
};

export default {
  trackUsage,
  skipTracking,
  createTrackingMiddleware,
};
