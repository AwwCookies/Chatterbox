import logger from '../utils/logger.js';
import jwt from 'jsonwebtoken';
import { OAuthUser, UserSession } from '../models/OAuthUser.js';

const JWT_SECRET = process.env.JWT_SECRET || process.env.API_KEY || 'default-jwt-secret-change-me';
const JWT_EXPIRES_IN = '15m'; // Access tokens expire in 15 minutes
const REFRESH_TOKEN_EXPIRES_DAYS = 30;

/**
 * Generate JWT access token
 */
export const generateAccessToken = (user) => {
  return jwt.sign(
    { 
      userId: user.id, 
      twitchId: user.twitch_id,
      username: user.username,
      isAdmin: user.is_admin 
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * Generate refresh token (random string)
 */
export const generateRefreshToken = () => {
  const crypto = require('crypto');
  return crypto.randomBytes(64).toString('hex');
};

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
 * JWT authentication middleware for OAuth users
 * Validates Bearer token and attaches user to request
 */
export const requireUserAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required', hint: 'Include Authorization: Bearer <token>' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get full user from database
    const user = await OAuthUser.getById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    req.tokenData = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    logger.error('Auth error:', error.message);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

/**
 * Optional user auth - passes through if valid token or no token
 * Attaches user to request if authenticated
 */
export const optionalUserAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await OAuthUser.getById(decoded.userId);
    req.user = user;
    req.tokenData = decoded;
  } catch (error) {
    req.user = null;
  }

  next();
};

/**
 * Require user to be an admin
 * Must be used after requireUserAuth
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
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

export { JWT_SECRET, JWT_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_DAYS };
