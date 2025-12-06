import ConfigService from '../services/configService.js';
import { query } from '../config/database.js';
import logger from '../utils/logger.js';

// In-memory request counts per IP
const ipRequestCounts = new Map();
const ipBlocklist = new Set();
const ipRateLimitOverrides = new Map();

// Cleanup interval
let cleanupInterval = null;

/**
 * Initialize traffic tracking
 */
export async function initializeTrafficTracking() {
  // Load blocked IPs from database
  try {
    const result = await query(`
      SELECT ip_address, rate_limit_override 
      FROM ip_rules 
      WHERE rule_type = 'block' 
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `);
    
    for (const row of result.rows) {
      ipBlocklist.add(row.ip_address);
    }
    
    // Load rate limit overrides
    const overrides = await query(`
      SELECT ip_address, rate_limit_override 
      FROM ip_rules 
      WHERE rule_type = 'rate_limit' 
      AND rate_limit_override IS NOT NULL
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `);
    
    for (const row of overrides.rows) {
      ipRateLimitOverrides.set(row.ip_address, row.rate_limit_override);
    }
    
    logger.info(`Traffic tracking initialized: ${ipBlocklist.size} blocked IPs, ${ipRateLimitOverrides.size} rate limit overrides`);
  } catch (error) {
    logger.error('Failed to initialize traffic tracking:', error.message);
  }
  
  // Start cleanup interval
  cleanupInterval = setInterval(() => {
    const windowMs = ConfigService.getSync('rateLimit.perIp.windowMs', 60000);
    const now = Date.now();
    
    for (const [ip, data] of ipRequestCounts.entries()) {
      if (now - data.windowStart > windowMs * 2) {
        ipRequestCounts.delete(ip);
      }
    }
  }, 60000); // Cleanup every minute
}

/**
 * Get client IP from request
 */
function getClientIp(req) {
  // Check common proxy headers
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return realIp;
  }
  
  // Cloudflare
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) {
    return cfIp;
  }
  
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

/**
 * Traffic analytics middleware - logs requests
 */
export function trafficAnalytics(req, res, next) {
  const analyticsEnabled = ConfigService.getSync('analytics.enabled', true);
  const sampleRate = ConfigService.getSync('analytics.sampleRate', 1.0);
  
  if (!analyticsEnabled || Math.random() > sampleRate) {
    return next();
  }
  
  const startTime = Date.now();
  const ip = getClientIp(req);
  
  // Capture response
  const originalEnd = res.end;
  res.end = function(...args) {
    const responseTime = Date.now() - startTime;
    
    // Log to database asynchronously
    setImmediate(async () => {
      try {
        await query(`
          INSERT INTO traffic_logs (ip_address, method, path, status_code, response_time_ms, user_agent, timestamp)
          VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        `, [
          ip,
          req.method,
          req.path.substring(0, 500), // Truncate long paths
          res.statusCode,
          responseTime,
          (req.headers['user-agent'] || '').substring(0, 500)
        ]);
      } catch (error) {
        // Don't log errors for analytics - it's not critical
      }
    });
    
    originalEnd.apply(res, args);
  };
  
  next();
}

/**
 * IP blocking middleware
 */
export function ipBlocker(req, res, next) {
  const ip = getClientIp(req);
  
  if (ipBlocklist.has(ip)) {
    logger.warn(`Blocked request from IP: ${ip}`);
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // Store IP on request for later use
  req.clientIp = ip;
  next();
}

/**
 * Per-IP rate limiter middleware
 */
export function perIpRateLimiter(req, res, next) {
  const enabled = ConfigService.getSync('rateLimit.perIp.enabled', true);
  if (!enabled) {
    return next();
  }
  
  const ip = req.clientIp || getClientIp(req);
  const windowMs = ConfigService.getSync('rateLimit.perIp.windowMs', 60000);
  let maxRequests = ConfigService.getSync('rateLimit.perIp.maxRequests', 1000);
  
  // Check for IP-specific override
  if (ipRateLimitOverrides.has(ip)) {
    maxRequests = ipRateLimitOverrides.get(ip);
  }
  
  const now = Date.now();
  let ipData = ipRequestCounts.get(ip);
  
  if (!ipData || now - ipData.windowStart > windowMs) {
    ipData = { count: 0, windowStart: now };
    ipRequestCounts.set(ip, ipData);
  }
  
  ipData.count++;
  
  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', maxRequests);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - ipData.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil((ipData.windowStart + windowMs) / 1000));
  
  if (ipData.count > maxRequests) {
    logger.warn(`Rate limit exceeded for IP: ${ip} (${ipData.count}/${maxRequests})`);
    return res.status(429).json({ 
      error: 'Too many requests from this IP',
      retryAfter: Math.ceil((ipData.windowStart + windowMs - now) / 1000)
    });
  }
  
  next();
}

/**
 * Block an IP address
 */
export async function blockIp(ip, reason = null, expiresAt = null, createdBy = null) {
  await query(`
    INSERT INTO ip_rules (ip_address, rule_type, reason, expires_at, created_by)
    VALUES ($1, 'block', $2, $3, $4)
    ON CONFLICT (ip_address) DO UPDATE SET
      rule_type = 'block',
      reason = EXCLUDED.reason,
      expires_at = EXCLUDED.expires_at,
      created_at = CURRENT_TIMESTAMP
  `, [ip, reason, expiresAt, createdBy]);
  
  ipBlocklist.add(ip);
  logger.info(`IP blocked: ${ip} (reason: ${reason})`);
}

/**
 * Unblock an IP address
 */
export async function unblockIp(ip) {
  await query('DELETE FROM ip_rules WHERE ip_address = $1 AND rule_type = $2', [ip, 'block']);
  ipBlocklist.delete(ip);
  logger.info(`IP unblocked: ${ip}`);
}

/**
 * Set rate limit override for an IP
 */
export async function setIpRateLimit(ip, limit, expiresAt = null) {
  if (limit === null) {
    await query('DELETE FROM ip_rules WHERE ip_address = $1 AND rule_type = $2', [ip, 'rate_limit']);
    ipRateLimitOverrides.delete(ip);
  } else {
    await query(`
      INSERT INTO ip_rules (ip_address, rule_type, rate_limit_override, expires_at)
      VALUES ($1, 'rate_limit', $2, $3)
      ON CONFLICT (ip_address) DO UPDATE SET
        rule_type = 'rate_limit',
        rate_limit_override = EXCLUDED.rate_limit_override,
        expires_at = EXCLUDED.expires_at,
        created_at = CURRENT_TIMESTAMP
    `, [ip, limit, expiresAt]);
    
    ipRateLimitOverrides.set(ip, limit);
  }
  
  logger.info(`IP rate limit set: ${ip} = ${limit}`);
}

/**
 * Get traffic statistics
 */
export async function getTrafficStats(timeRange = '1h') {
  const intervals = {
    '1h': '1 hour',
    '6h': '6 hours',
    '24h': '24 hours',
    '7d': '7 days',
    '30d': '30 days'
  };
  
  const interval = intervals[timeRange] || '1 hour';
  
  // Total requests
  const totalResult = await query(`
    SELECT COUNT(*) as total,
           COUNT(DISTINCT ip_address) as unique_ips,
           AVG(response_time_ms) as avg_response_time,
           PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95_response_time
    FROM traffic_logs
    WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '${interval}'
  `);
  
  // Requests by status code
  const statusResult = await query(`
    SELECT status_code, COUNT(*) as count
    FROM traffic_logs
    WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '${interval}'
    GROUP BY status_code
    ORDER BY count DESC
  `);
  
  // Top IPs
  const topIpsResult = await query(`
    SELECT ip_address, COUNT(*) as request_count,
           AVG(response_time_ms) as avg_response_time
    FROM traffic_logs
    WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '${interval}'
    GROUP BY ip_address
    ORDER BY request_count DESC
    LIMIT 20
  `);
  
  // Top paths
  const topPathsResult = await query(`
    SELECT path, method, COUNT(*) as request_count,
           AVG(response_time_ms) as avg_response_time
    FROM traffic_logs
    WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '${interval}'
    GROUP BY path, method
    ORDER BY request_count DESC
    LIMIT 20
  `);
  
  // Requests over time (for chart)
  const bucketSize = timeRange === '1h' ? '5 minutes' 
                   : timeRange === '6h' ? '15 minutes'
                   : timeRange === '24h' ? '1 hour'
                   : timeRange === '7d' ? '6 hours'
                   : '1 day';
  
  const timelineResult = await query(`
    SELECT DATE_TRUNC('${bucketSize.split(' ')[1]}', timestamp) as bucket,
           COUNT(*) as requests,
           COUNT(DISTINCT ip_address) as unique_ips,
           AVG(response_time_ms) as avg_response_time
    FROM traffic_logs
    WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '${interval}'
    GROUP BY bucket
    ORDER BY bucket ASC
  `);
  
  // Error rate
  const errorResult = await query(`
    SELECT 
      COUNT(*) FILTER (WHERE status_code >= 400) as errors,
      COUNT(*) as total
    FROM traffic_logs
    WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '${interval}'
  `);
  
  return {
    summary: {
      totalRequests: parseInt(totalResult.rows[0]?.total || 0),
      uniqueIps: parseInt(totalResult.rows[0]?.unique_ips || 0),
      avgResponseTime: parseFloat(totalResult.rows[0]?.avg_response_time || 0).toFixed(2),
      p95ResponseTime: parseFloat(totalResult.rows[0]?.p95_response_time || 0).toFixed(2),
      errorRate: errorResult.rows[0]?.total > 0 
        ? ((errorResult.rows[0]?.errors / errorResult.rows[0]?.total) * 100).toFixed(2)
        : 0
    },
    statusCodes: statusResult.rows.map(r => ({
      code: r.status_code,
      count: parseInt(r.count)
    })),
    topIps: topIpsResult.rows.map(r => ({
      ip: r.ip_address,
      requests: parseInt(r.request_count),
      avgResponseTime: parseFloat(r.avg_response_time || 0).toFixed(2)
    })),
    topPaths: topPathsResult.rows.map(r => ({
      path: r.path,
      method: r.method,
      requests: parseInt(r.request_count),
      avgResponseTime: parseFloat(r.avg_response_time || 0).toFixed(2)
    })),
    timeline: timelineResult.rows.map(r => ({
      time: r.bucket,
      requests: parseInt(r.requests),
      uniqueIps: parseInt(r.unique_ips),
      avgResponseTime: parseFloat(r.avg_response_time || 0).toFixed(2)
    }))
  };
}

/**
 * Get all IP rules
 */
export async function getIpRules() {
  const result = await query(`
    SELECT * FROM ip_rules
    WHERE expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP
    ORDER BY created_at DESC
  `);
  return result.rows;
}

/**
 * Delete an IP rule
 */
export async function deleteIpRule(id) {
  const result = await query('SELECT * FROM ip_rules WHERE id = $1', [id]);
  if (result.rows.length > 0) {
    const rule = result.rows[0];
    if (rule.rule_type === 'block') {
      ipBlocklist.delete(rule.ip_address);
    } else if (rule.rule_type === 'rate_limit') {
      ipRateLimitOverrides.delete(rule.ip_address);
    }
  }
  
  await query('DELETE FROM ip_rules WHERE id = $1', [id]);
}

/**
 * Get current rate limit status for an IP
 */
export function getIpStatus(ip) {
  const data = ipRequestCounts.get(ip);
  const maxRequests = ipRateLimitOverrides.get(ip) || ConfigService.getSync('rateLimit.perIp.maxRequests', 1000);
  const windowMs = ConfigService.getSync('rateLimit.perIp.windowMs', 60000);
  
  return {
    ip,
    isBlocked: ipBlocklist.has(ip),
    currentRequests: data?.count || 0,
    maxRequests,
    windowMs,
    hasOverride: ipRateLimitOverrides.has(ip)
  };
}

/**
 * Cleanup old traffic logs
 */
export async function cleanupTrafficLogs() {
  const retentionDays = ConfigService.getSync('analytics.retentionDays', 30);
  
  const result = await query(`
    DELETE FROM traffic_logs
    WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '${retentionDays} days'
  `);
  
  logger.info(`Cleaned up ${result.rowCount} old traffic log entries`);
  return result.rowCount;
}

export default {
  initializeTrafficTracking,
  trafficAnalytics,
  ipBlocker,
  perIpRateLimiter,
  blockIp,
  unblockIp,
  setIpRateLimit,
  getTrafficStats,
  getIpRules,
  deleteIpRule,
  getIpStatus,
  cleanupTrafficLogs
};
