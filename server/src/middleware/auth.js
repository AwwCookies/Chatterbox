import logger from '../utils/logger.js';

/**
 * Simple API key authentication middleware
 * Checks for X-API-Key header matching the configured API_KEY
 */
export const requireAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const configuredKey = process.env.API_KEY;

  if (!configuredKey) {
    logger.error('API_KEY not configured in environment variables');
    return res.status(500).json({ error: 'Server authentication not configured' });
  }

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required', hint: 'Include X-API-Key header' });
  }

  if (apiKey !== configuredKey) {
    logger.warn(`Invalid API key attempt from ${req.ip}`);
    return res.status(403).json({ error: 'Invalid API key' });
  }

  next();
};

/**
 * Optional auth - passes through if valid or no key provided
 * Use for endpoints that have different behavior for authenticated users
 */
export const optionalAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const configuredKey = process.env.API_KEY;

  req.isAuthenticated = apiKey && configuredKey && apiKey === configuredKey;
  next();
};
