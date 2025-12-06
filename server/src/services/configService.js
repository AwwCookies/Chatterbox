import { query } from '../config/database.js';
import logger from '../utils/logger.js';

// Default configuration values
const DEFAULT_CONFIG = {
  // Rate limiting
  'rateLimit.windowMs': 60000, // 1 minute
  'rateLimit.maxRequests': 10000, // requests per window
  'rateLimit.enabled': true,
  
  // Per-IP rate limiting
  'rateLimit.perIp.enabled': true,
  'rateLimit.perIp.windowMs': 60000,
  'rateLimit.perIp.maxRequests': 1000,
  
  // Authentication rate limiting
  'rateLimit.auth.windowMs': 900000, // 15 minutes
  'rateLimit.auth.maxRequests': 10,
  
  // Message fetching
  'messages.defaultLimit': 100,
  'messages.maxLimit': 1000,
  'messages.searchMaxResults': 500,
  
  // WebSocket
  'websocket.maxConnectionsPerIp': 5,
  'websocket.heartbeatInterval': 30000,
  'websocket.connectionTimeout': 60000,
  
  // Archive service
  'archive.flushInterval': 5000, // 5 seconds
  'archive.batchSize': 100,
  'archive.maxQueueSize': 10000,
  
  // User requests
  'userRequests.exportMaxMessages': 100000,
  'userRequests.downloadExpiry': 86400000, // 24 hours
  
  // Security
  'security.maxRequestBodySize': '10mb',
  'security.corsMaxAge': 86400,
  
  // Analytics
  'analytics.enabled': true,
  'analytics.retentionDays': 30,
  'analytics.sampleRate': 1.0, // 1.0 = 100% of requests
};

// In-memory cache of config
let configCache = { ...DEFAULT_CONFIG };
let lastRefresh = 0;
const CACHE_TTL = 30000; // 30 seconds

class ConfigService {
  /**
   * Initialize config table if needed
   */
  static async initialize() {
    try {
      // Create config table if it doesn't exist
      await query(`
        CREATE TABLE IF NOT EXISTS server_config (
          key VARCHAR(255) PRIMARY KEY,
          value TEXT NOT NULL,
          description TEXT,
          type VARCHAR(50) DEFAULT 'string',
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create traffic_logs table for analytics
      await query(`
        CREATE TABLE IF NOT EXISTS traffic_logs (
          id SERIAL PRIMARY KEY,
          ip_address VARCHAR(45) NOT NULL,
          method VARCHAR(10) NOT NULL,
          path VARCHAR(500) NOT NULL,
          status_code INTEGER,
          response_time_ms INTEGER,
          user_agent TEXT,
          country VARCHAR(2),
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create index on traffic_logs
      await query(`
        CREATE INDEX IF NOT EXISTS idx_traffic_logs_timestamp ON traffic_logs(timestamp)
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_traffic_logs_ip ON traffic_logs(ip_address)
      `);
      
      // Create ip_rules table for blocklist/allowlist
      await query(`
        CREATE TABLE IF NOT EXISTS ip_rules (
          id SERIAL PRIMARY KEY,
          ip_address VARCHAR(45) NOT NULL UNIQUE,
          rule_type VARCHAR(20) NOT NULL DEFAULT 'block',
          reason TEXT,
          rate_limit_override INTEGER,
          expires_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_by VARCHAR(255)
        )
      `);
      
      await query(`
        CREATE INDEX IF NOT EXISTS idx_ip_rules_ip ON ip_rules(ip_address)
      `);
      
      logger.info('ConfigService initialized');
      
      // Load initial config
      await ConfigService.refreshCache();
    } catch (error) {
      logger.error('Failed to initialize ConfigService:', error.message);
    }
  }
  
  /**
   * Refresh config cache from database
   */
  static async refreshCache() {
    try {
      const result = await query('SELECT key, value, type FROM server_config');
      
      // Start with defaults
      configCache = { ...DEFAULT_CONFIG };
      
      // Override with database values
      for (const row of result.rows) {
        configCache[row.key] = ConfigService.parseValue(row.value, row.type);
      }
      
      lastRefresh = Date.now();
      logger.debug('Config cache refreshed');
    } catch (error) {
      logger.error('Failed to refresh config cache:', error.message);
    }
  }
  
  /**
   * Parse value based on type
   */
  static parseValue(value, type) {
    switch (type) {
      case 'number':
        return parseFloat(value);
      case 'boolean':
        return value === 'true' || value === '1';
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      default:
        return value;
    }
  }
  
  /**
   * Get a config value
   */
  static async get(key, defaultValue = null) {
    // Refresh cache if stale
    if (Date.now() - lastRefresh > CACHE_TTL) {
      await ConfigService.refreshCache();
    }
    
    return configCache[key] ?? defaultValue ?? DEFAULT_CONFIG[key];
  }
  
  /**
   * Get a config value synchronously (from cache)
   */
  static getSync(key, defaultValue = null) {
    return configCache[key] ?? defaultValue ?? DEFAULT_CONFIG[key];
  }
  
  /**
   * Set a config value
   */
  static async set(key, value, description = null) {
    const type = typeof value === 'number' ? 'number' 
               : typeof value === 'boolean' ? 'boolean'
               : typeof value === 'object' ? 'json'
               : 'string';
    
    const stringValue = type === 'json' ? JSON.stringify(value) : String(value);
    
    await query(`
      INSERT INTO server_config (key, value, type, description, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        type = EXCLUDED.type,
        description = COALESCE(EXCLUDED.description, server_config.description),
        updated_at = CURRENT_TIMESTAMP
    `, [key, stringValue, type, description]);
    
    // Update cache
    configCache[key] = value;
    
    logger.info(`Config updated: ${key} = ${stringValue}`);
  }
  
  /**
   * Get all config values
   */
  static async getAll() {
    await ConfigService.refreshCache();
    
    // Get descriptions from database
    const result = await query('SELECT key, description FROM server_config');
    const descriptions = {};
    for (const row of result.rows) {
      descriptions[row.key] = row.description;
    }
    
    // Combine with defaults to show all available settings
    const allKeys = new Set([...Object.keys(DEFAULT_CONFIG), ...Object.keys(configCache)]);
    const configs = [];
    
    for (const key of allKeys) {
      configs.push({
        key,
        value: configCache[key] ?? DEFAULT_CONFIG[key],
        defaultValue: DEFAULT_CONFIG[key],
        description: descriptions[key] || ConfigService.getDefaultDescription(key),
        type: typeof (configCache[key] ?? DEFAULT_CONFIG[key])
      });
    }
    
    return configs.sort((a, b) => a.key.localeCompare(b.key));
  }
  
  /**
   * Get default description for a config key
   */
  static getDefaultDescription(key) {
    const descriptions = {
      'rateLimit.windowMs': 'Rate limit window in milliseconds',
      'rateLimit.maxRequests': 'Maximum requests per rate limit window',
      'rateLimit.enabled': 'Enable global rate limiting',
      'rateLimit.perIp.enabled': 'Enable per-IP rate limiting',
      'rateLimit.perIp.windowMs': 'Per-IP rate limit window in milliseconds',
      'rateLimit.perIp.maxRequests': 'Maximum requests per IP per window',
      'rateLimit.auth.windowMs': 'Auth endpoint rate limit window',
      'rateLimit.auth.maxRequests': 'Maximum auth requests per window',
      'messages.defaultLimit': 'Default number of messages to return',
      'messages.maxLimit': 'Maximum messages allowed per request',
      'messages.searchMaxResults': 'Maximum search results',
      'websocket.maxConnectionsPerIp': 'Max WebSocket connections per IP',
      'websocket.heartbeatInterval': 'WebSocket heartbeat interval (ms)',
      'websocket.connectionTimeout': 'WebSocket connection timeout (ms)',
      'archive.flushInterval': 'How often to flush messages to database (ms)',
      'archive.batchSize': 'Number of messages to batch before flushing',
      'archive.maxQueueSize': 'Maximum queue size before dropping messages',
      'userRequests.exportMaxMessages': 'Maximum messages in data export',
      'userRequests.downloadExpiry': 'Export download link expiry (ms)',
      'security.maxRequestBodySize': 'Maximum request body size',
      'security.corsMaxAge': 'CORS preflight cache max age (seconds)',
      'analytics.enabled': 'Enable traffic analytics logging',
      'analytics.retentionDays': 'Days to retain analytics data',
      'analytics.sampleRate': 'Fraction of requests to log (0.0-1.0)',
    };
    return descriptions[key] || '';
  }
  
  /**
   * Reset a config value to default
   */
  static async reset(key) {
    await query('DELETE FROM server_config WHERE key = $1', [key]);
    configCache[key] = DEFAULT_CONFIG[key];
    logger.info(`Config reset to default: ${key}`);
  }
  
  /**
   * Get default config
   */
  static getDefaults() {
    return { ...DEFAULT_CONFIG };
  }
}

export default ConfigService;
