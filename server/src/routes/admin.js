import { Router } from 'express';
import os from 'os';
import { query } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { requireUserAuth, requireAdmin } from '../middleware/auth.js';
import { OAuthUser, UserRequest } from '../models/OAuthUser.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import logger from '../utils/logger.js';
import ConfigService from '../services/configService.js';
import { 
  getTrafficStats, 
  getIpRules, 
  blockIp, 
  unblockIp, 
  setIpRateLimit,
  deleteIpRule,
  getIpStatus,
  cleanupTrafficLogs
} from '../middleware/trafficMiddleware.js';

const router = Router();

// Store server start time
const serverStartTime = Date.now();

/**
 * GET /api/admin/system
 * Get comprehensive system information
 * Requires authentication
 */
router.get('/system', requireAuth, async (req, res) => {
  try {
    const memUsage = process.memoryUsage();
    const cpus = os.cpus();
    
    res.json({
      server: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        uptime: process.uptime(),
        startTime: new Date(serverStartTime).toISOString(),
      },
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers,
        systemTotal: os.totalmem(),
        systemFree: os.freemem(),
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || 'Unknown',
        speed: cpus[0]?.speed || 0,
        loadAvg: os.loadavg(),
      },
      os: {
        type: os.type(),
        release: os.release(),
        hostname: os.hostname(),
        uptime: os.uptime(),
      },
      env: {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 3000,
        logLevel: process.env.LOG_LEVEL || 'info',
      }
    });
  } catch (error) {
    logger.error('Error fetching system info:', error.message);
    res.status(500).json({ error: 'Failed to fetch system information' });
  }
});

/**
 * GET /api/admin/database
 * Get database statistics and health
 * Requires authentication
 */
router.get('/database', requireAuth, async (req, res) => {
  try {
    // Get database size
    const dbSizeResult = await query(`
      SELECT pg_database_size(current_database()) as size
    `);
    
    // Get table sizes
    const tableSizesResult = await query(`
      SELECT 
        relname as table_name,
        pg_total_relation_size(relid) as total_size,
        pg_relation_size(relid) as table_size,
        pg_indexes_size(relid) as indexes_size,
        n_live_tup as row_count
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
    `);
    
    // Get database version
    const versionResult = await query('SELECT version()');
    
    // Get connection stats
    const connStatsResult = await query(`
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active,
        count(*) FILTER (WHERE state = 'idle') as idle,
        count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);
    
    // Get database stats
    const dbStatsResult = await query(`
      SELECT 
        xact_commit as transactions_committed,
        xact_rollback as transactions_rolled_back,
        blks_read as blocks_read,
        blks_hit as blocks_hit,
        tup_returned as tuples_returned,
        tup_fetched as tuples_fetched,
        tup_inserted as tuples_inserted,
        tup_updated as tuples_updated,
        tup_deleted as tuples_deleted,
        conflicts,
        deadlocks
      FROM pg_stat_database
      WHERE datname = current_database()
    `);

    // Calculate cache hit ratio
    const stats = dbStatsResult.rows[0];
    const cacheHitRatio = stats.blocks_hit > 0 
      ? (stats.blocks_hit / (stats.blocks_hit + stats.blocks_read) * 100).toFixed(2)
      : 100;

    res.json({
      size: parseInt(dbSizeResult.rows[0].size),
      version: versionResult.rows[0].version,
      tables: tableSizesResult.rows.map(row => ({
        name: row.table_name,
        totalSize: parseInt(row.total_size),
        tableSize: parseInt(row.table_size),
        indexesSize: parseInt(row.indexes_size),
        rowCount: parseInt(row.row_count),
      })),
      connections: {
        total: parseInt(connStatsResult.rows[0].total_connections),
        active: parseInt(connStatsResult.rows[0].active),
        idle: parseInt(connStatsResult.rows[0].idle),
        idleInTransaction: parseInt(connStatsResult.rows[0].idle_in_transaction),
      },
      stats: {
        transactionsCommitted: parseInt(stats.transactions_committed),
        transactionsRolledBack: parseInt(stats.transactions_rolled_back),
        cacheHitRatio: parseFloat(cacheHitRatio),
        tuplesReturned: parseInt(stats.tuples_returned),
        tuplesFetched: parseInt(stats.tuples_fetched),
        tuplesInserted: parseInt(stats.tuples_inserted),
        tuplesUpdated: parseInt(stats.tuples_updated),
        tuplesDeleted: parseInt(stats.tuples_deleted),
        conflicts: parseInt(stats.conflicts),
        deadlocks: parseInt(stats.deadlocks),
      }
    });
  } catch (error) {
    logger.error('Error fetching database stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch database statistics' });
  }
});

/**
 * GET /api/admin/analytics
 * Get detailed analytics about messages, users, and activity
 * Requires authentication
 */
router.get('/analytics', requireAuth, async (req, res) => {
  try {
    const period = req.query.period || '24h';
    
    // Calculate the time range
    let interval;
    switch (period) {
      case '1h': interval = '1 hour'; break;
      case '6h': interval = '6 hours'; break;
      case '24h': interval = '24 hours'; break;
      case '7d': interval = '7 days'; break;
      case '30d': interval = '30 days'; break;
      default: interval = '24 hours';
    }

    // Messages over time
    const messagesOverTime = await query(`
      SELECT 
        date_trunc('hour', timestamp) as hour,
        COUNT(*) as count
      FROM messages
      WHERE timestamp > NOW() - INTERVAL '${interval}'
      GROUP BY hour
      ORDER BY hour
    `);

    // Mod actions over time
    const modActionsOverTime = await query(`
      SELECT 
        date_trunc('hour', timestamp) as hour,
        action_type,
        COUNT(*) as count
      FROM mod_actions
      WHERE timestamp > NOW() - INTERVAL '${interval}'
      GROUP BY hour, action_type
      ORDER BY hour
    `);

    // Top chatters in period
    const topChatters = await query(`
      SELECT 
        u.username,
        u.display_name,
        COUNT(m.id) as message_count
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.timestamp > NOW() - INTERVAL '${interval}'
      GROUP BY u.id, u.username, u.display_name
      ORDER BY message_count DESC
      LIMIT 10
    `);

    // Channel activity
    const channelActivity = await query(`
      SELECT 
        c.name,
        c.display_name,
        COUNT(m.id) as message_count,
        COUNT(DISTINCT m.user_id) as unique_users
      FROM messages m
      JOIN channels c ON m.channel_id = c.id
      WHERE m.timestamp > NOW() - INTERVAL '${interval}'
      GROUP BY c.id, c.name, c.display_name
      ORDER BY message_count DESC
    `);

    // Mod action breakdown
    const modActionBreakdown = await query(`
      SELECT 
        action_type,
        COUNT(*) as count
      FROM mod_actions
      WHERE timestamp > NOW() - INTERVAL '${interval}'
      GROUP BY action_type
      ORDER BY count DESC
    `);

    // Peak hours (all time, for pattern analysis)
    const peakHours = await query(`
      SELECT 
        EXTRACT(hour FROM timestamp) as hour,
        COUNT(*) as count
      FROM messages
      WHERE timestamp > NOW() - INTERVAL '30 days'
      GROUP BY hour
      ORDER BY hour
    `);

    // Daily message counts for the last 30 days
    const dailyMessages = await query(`
      SELECT 
        date_trunc('day', timestamp)::date as date,
        COUNT(*) as count
      FROM messages
      WHERE timestamp > NOW() - INTERVAL '30 days'
      GROUP BY date
      ORDER BY date
    `);

    res.json({
      period,
      messagesOverTime: messagesOverTime.rows.map(r => ({
        hour: r.hour,
        count: parseInt(r.count),
      })),
      modActionsOverTime: modActionsOverTime.rows.map(r => ({
        hour: r.hour,
        actionType: r.action_type,
        count: parseInt(r.count),
      })),
      topChatters: topChatters.rows.map(r => ({
        username: r.username,
        displayName: r.display_name,
        messageCount: parseInt(r.message_count),
      })),
      channelActivity: channelActivity.rows.map(r => ({
        name: r.name,
        displayName: r.display_name,
        messageCount: parseInt(r.message_count),
        uniqueUsers: parseInt(r.unique_users),
      })),
      modActionBreakdown: modActionBreakdown.rows.map(r => ({
        actionType: r.action_type,
        count: parseInt(r.count),
      })),
      peakHours: peakHours.rows.map(r => ({
        hour: parseInt(r.hour),
        count: parseInt(r.count),
      })),
      dailyMessages: dailyMessages.rows.map(r => ({
        date: r.date,
        count: parseInt(r.count),
      })),
    });
  } catch (error) {
    logger.error('Error fetching analytics:', error.message);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/admin/services
 * Get status of all services (Twitch IRC, WebSocket, Archive)
 * Requires authentication
 */
router.get('/services', requireAuth, async (req, res) => {
  try {
    const services = {
      twitch: {
        name: 'Twitch IRC',
        status: 'unknown',
        connected: false,
        channels: [],
        username: null,
      },
      websocket: {
        name: 'WebSocket Server',
        status: 'unknown',
        connectedClients: 0,
      },
      archive: {
        name: 'Archive Service',
        status: 'unknown',
        stats: null,
      },
      database: {
        name: 'PostgreSQL',
        status: 'unknown',
        connected: false,
      }
    };

    // Check database
    try {
      await query('SELECT 1');
      services.database.status = 'healthy';
      services.database.connected = true;
    } catch {
      services.database.status = 'error';
      services.database.connected = false;
    }

    // Check Twitch service
    if (global.twitchService) {
      const twitchStatus = global.twitchService.getStatus();
      services.twitch.status = twitchStatus.connected ? 'healthy' : 'disconnected';
      services.twitch.connected = twitchStatus.connected;
      services.twitch.channels = twitchStatus.channels || [];
      services.twitch.username = twitchStatus.username;
    }

    // Check WebSocket service
    if (global.websocketService) {
      const wsClients = global.websocketService.getConnectedClients();
      services.websocket.status = 'healthy';
      services.websocket.connectedClients = wsClients;
    }

    // Check Archive service
    if (global.archiveService) {
      const archiveStats = global.archiveService.getStats();
      services.archive.status = 'healthy';
      services.archive.stats = archiveStats;
    }

    res.json({ services });
  } catch (error) {
    logger.error('Error fetching service status:', error.message);
    res.status(500).json({ error: 'Failed to fetch service status' });
  }
});

/**
 * GET /api/admin/logs
 * Get recent log entries (if available)
 * Requires authentication
 */
router.get('/logs', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const level = req.query.level || 'all'; // all, error, warn, info, debug
    
    // This returns a simplified log view - actual logs depend on logger implementation
    // In production, you'd read from log files or a log aggregation service
    res.json({
      message: 'Log streaming not implemented - check server logs directly',
      hint: 'Logs are written to ./logs/ directory and stdout',
      logLevel: process.env.LOG_LEVEL || 'info',
    });
  } catch (error) {
    logger.error('Error fetching logs:', error.message);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

/**
 * POST /api/admin/services/:service/restart
 * Restart a specific service
 * Requires authentication
 */
router.post('/services/:service/restart', requireAuth, async (req, res) => {
  const { service } = req.params;
  
  try {
    switch (service) {
      case 'twitch':
        if (global.twitchService) {
          await global.twitchService.reconnect();
          res.json({ success: true, message: 'Twitch IRC reconnecting...' });
        } else {
          res.status(404).json({ error: 'Twitch service not available' });
        }
        break;
        
      case 'archive':
        if (global.archiveService) {
          await global.archiveService.stop();
          global.archiveService.start();
          res.json({ success: true, message: 'Archive service restarted' });
        } else {
          res.status(404).json({ error: 'Archive service not available' });
        }
        break;
        
      default:
        res.status(400).json({ error: `Unknown service: ${service}` });
    }
  } catch (error) {
    logger.error(`Error restarting ${service}:`, error.message);
    res.status(500).json({ error: `Failed to restart ${service}` });
  }
});

/**
 * GET /api/admin/config
 * Get current server configuration (sanitized)
 * Requires authentication
 */
router.get('/config', requireAuth, async (req, res) => {
  try {
    res.json({
      server: {
        port: process.env.PORT || 3000,
        nodeEnv: process.env.NODE_ENV || 'development',
        logLevel: process.env.LOG_LEVEL || 'info',
      },
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        name: process.env.DB_NAME || 'twitch_archive',
        user: process.env.DB_USER || 'twitch',
        // Password intentionally omitted
      },
      twitch: {
        username: process.env.TWITCH_USERNAME || 'not configured',
        // OAuth token intentionally omitted
        channels: (process.env.CHANNELS || '').split(',').filter(Boolean),
      },
      client: {
        url: process.env.CLIENT_URL || 'not configured',
      },
      features: {
        apiKeyConfigured: !!process.env.API_KEY,
      }
    });
  } catch (error) {
    logger.error('Error fetching config:', error.message);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

/**
 * GET /api/admin/performance
 * Get performance metrics
 * Requires authentication
 */
router.get('/performance', requireAuth, async (req, res) => {
  try {
    // Query performance stats
    const slowQueries = await query(`
      SELECT 
        query,
        calls,
        total_exec_time,
        mean_exec_time,
        rows
      FROM pg_stat_statements
      WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
      ORDER BY mean_exec_time DESC
      LIMIT 10
    `).catch(() => ({ rows: [] })); // pg_stat_statements may not be enabled

    // Table bloat check
    const tableBloat = await query(`
      SELECT 
        schemaname || '.' || relname as table_name,
        n_dead_tup as dead_tuples,
        n_live_tup as live_tuples,
        CASE WHEN n_live_tup > 0 
          THEN round(100.0 * n_dead_tup / n_live_tup, 2) 
          ELSE 0 
        END as dead_tuple_percent,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze
      FROM pg_stat_user_tables
      WHERE n_dead_tup > 0
      ORDER BY n_dead_tup DESC
      LIMIT 10
    `);

    // Index usage stats
    const indexUsage = await query(`
      SELECT 
        schemaname || '.' || relname as table_name,
        indexrelname as index_name,
        idx_scan as scans,
        idx_tup_read as tuples_read,
        idx_tup_fetch as tuples_fetched,
        pg_relation_size(indexrelid) as index_size
      FROM pg_stat_user_indexes
      ORDER BY idx_scan DESC
      LIMIT 20
    `);

    res.json({
      slowQueries: slowQueries.rows.map(r => ({
        query: r.query?.substring(0, 200),
        calls: parseInt(r.calls || 0),
        totalTime: parseFloat(r.total_exec_time || 0),
        meanTime: parseFloat(r.mean_exec_time || 0),
        rows: parseInt(r.rows || 0),
      })),
      tableBloat: tableBloat.rows.map(r => ({
        tableName: r.table_name,
        deadTuples: parseInt(r.dead_tuples),
        liveTuples: parseInt(r.live_tuples),
        deadTuplePercent: parseFloat(r.dead_tuple_percent),
        lastVacuum: r.last_vacuum,
        lastAutovacuum: r.last_autovacuum,
        lastAnalyze: r.last_analyze,
        lastAutoanalyze: r.last_autoanalyze,
      })),
      indexUsage: indexUsage.rows.map(r => ({
        tableName: r.table_name,
        indexName: r.index_name,
        scans: parseInt(r.scans),
        tuplesRead: parseInt(r.tuples_read),
        tuplesFetched: parseInt(r.tuples_fetched),
        indexSize: parseInt(r.index_size),
      })),
    });
  } catch (error) {
    logger.error('Error fetching performance metrics:', error.message);
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

/**
 * POST /api/admin/database/vacuum
 * Trigger VACUUM ANALYZE on the database
 * Requires authentication
 */
router.post('/database/vacuum', requireAuth, async (req, res) => {
  try {
    const { table } = req.body;
    
    if (table) {
      // Validate table name to prevent SQL injection
      const validTables = ['messages', 'users', 'channels', 'mod_actions'];
      if (!validTables.includes(table)) {
        return res.status(400).json({ error: 'Invalid table name' });
      }
      await query(`VACUUM ANALYZE ${table}`);
      res.json({ success: true, message: `VACUUM ANALYZE completed on ${table}` });
    } else {
      // This runs VACUUM ANALYZE on all tables
      await query('VACUUM ANALYZE');
      res.json({ success: true, message: 'VACUUM ANALYZE completed on all tables' });
    }
  } catch (error) {
    logger.error('Error running VACUUM:', error.message);
    res.status(500).json({ error: 'Failed to run VACUUM' });
  }
});

// ============================================
// User Request Management (OAuth Admin Endpoints)
// ============================================

/**
 * GET /api/admin/user-requests
 * Get all user requests with pagination and filters
 * Requires admin auth (API key or OAuth admin)
 */
router.get('/user-requests', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    const status = req.query.status || null;
    const type = req.query.type || null;

    const result = await UserRequest.getAll(limit, offset, status, type);

    res.json({
      requests: result.requests.map(r => ({
        id: r.id,
        type: r.request_type,
        status: r.status,
        reason: r.reason,
        adminNotes: r.admin_notes,
        downloadUrl: r.download_url,
        downloadExpiresAt: r.download_expires_at,
        createdAt: r.created_at,
        processedAt: r.processed_at,
        user: {
          id: r.oauth_user_id,
          twitchId: r.twitch_id,
          username: r.username,
          displayName: r.display_name,
          profileImageUrl: r.profile_image_url
        }
      })),
      total: result.total,
      hasMore: result.hasMore
    });
  } catch (error) {
    logger.error('Error fetching user requests:', error.message);
    res.status(500).json({ error: 'Failed to fetch user requests' });
  }
});

/**
 * GET /api/admin/user-requests/pending
 * Get only pending requests
 */
router.get('/user-requests/pending', requireAuth, async (req, res) => {
  try {
    const type = req.query.type || null;
    const requests = await UserRequest.getPending(type);

    res.json({
      requests: requests.map(r => ({
        id: r.id,
        type: r.request_type,
        status: r.status,
        reason: r.reason,
        createdAt: r.created_at,
        user: {
          id: r.oauth_user_id,
          twitchId: r.twitch_id,
          username: r.username,
          displayName: r.display_name,
          profileImageUrl: r.profile_image_url
        }
      })),
      total: requests.length
    });
  } catch (error) {
    logger.error('Error fetching pending requests:', error.message);
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
});

/**
 * GET /api/admin/user-requests/:id
 * Get a specific user request
 */
router.get('/user-requests/:id', requireAuth, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const request = await UserRequest.getById(requestId);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Get additional user stats if it's a delete request
    let userStats = null;
    if (request.request_type === 'delete' && request.twitch_id) {
      try {
        // Try to find chat user by twitch_id in users table
        const chatUserResult = await query(`
          SELECT id, message_count, first_seen, last_seen 
          FROM users 
          WHERE twitch_id = $1
        `, [request.twitch_id]);
        
        if (chatUserResult.rows.length > 0) {
          const chatUser = chatUserResult.rows[0];
          userStats = {
            messagesCount: chatUser.message_count || 0,
            firstSeen: chatUser.first_seen,
            lastSeen: chatUser.last_seen
          };
        }
      } catch (statsError) {
        // Non-critical error, just log and continue without stats
        logger.warn('Could not fetch user stats:', statsError.message);
      }
    }

    res.json({
      request: {
        id: request.id,
        type: request.request_type,
        status: request.status,
        reason: request.reason,
        adminNotes: request.admin_notes,
        downloadUrl: request.download_url,
        downloadExpiresAt: request.download_expires_at,
        createdAt: request.created_at,
        processedAt: request.processed_at,
        user: {
          id: request.oauth_user_id,
          twitchId: request.twitch_id,
          username: request.username,
          displayName: request.display_name,
          profileImageUrl: request.profile_image_url
        },
        userStats
      }
    });
  } catch (error) {
    logger.error('Error fetching user request:', error.message || error);
    res.status(500).json({ error: 'Failed to fetch user request' });
  }
});

/**
 * POST /api/admin/user-requests/:id/approve
 * Approve a user request
 */
router.post('/user-requests/:id/approve', requireAuth, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { adminNotes } = req.body;

    const request = await UserRequest.getById(requestId);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request has already been processed' });
    }

    let downloadUrl = null;

    if (request.request_type === 'export') {
      // Generate export data
      const exportData = await generateUserExport(request.twitch_id, request.username);
      // In production, you'd upload this to S3 or similar
      // For now, we'll store it as a base64 encoded JSON
      downloadUrl = `data:application/json;base64,${Buffer.from(JSON.stringify(exportData, null, 2)).toString('base64')}`;
    }

    // Use null for admin user ID since we're using API key auth
    const approved = await UserRequest.approve(requestId, null, adminNotes, downloadUrl);

    if (request.request_type === 'delete') {
      // For delete requests, actually delete the data
      await executeUserDeletion(request.twitch_id, request.username);
      await UserRequest.complete(requestId);
    }

    logger.info(`User request ${requestId} approved (${request.request_type} for ${request.username})`);

    res.json({
      message: `Request approved successfully`,
      request: {
        id: approved.id,
        type: approved.request_type,
        status: approved.status,
        downloadUrl: approved.download_url
      }
    });
  } catch (error) {
    logger.error('Error approving request:', error.message || error);
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

/**
 * POST /api/admin/user-requests/:id/deny
 * Deny a user request
 */
router.post('/user-requests/:id/deny', requireAuth, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { adminNotes } = req.body;

    const request = await UserRequest.getById(requestId);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request has already been processed' });
    }

    const denied = await UserRequest.deny(requestId, null, adminNotes);

    logger.info(`User request ${requestId} denied (${request.request_type} for ${request.username})`);

    res.json({
      message: 'Request denied',
      request: {
        id: denied.id,
        type: denied.request_type,
        status: denied.status,
        adminNotes: denied.admin_notes
      }
    });
  } catch (error) {
    logger.error('Error denying request:', error.message);
    res.status(500).json({ error: 'Failed to deny request' });
  }
});

/**
 * GET /api/admin/oauth-users
 * Get all OAuth users
 */
router.get('/oauth-users', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    const search = req.query.search?.trim();

    let sql = `
      SELECT id, twitch_id, username, display_name, profile_image_url, 
             is_admin, created_at, last_login
      FROM oauth_users
    `;
    let countSql = 'SELECT COUNT(*) FROM oauth_users';
    const params = [];
    const countParams = [];

    if (search) {
      sql += ` WHERE username ILIKE $1 OR display_name ILIKE $1`;
      countSql += ` WHERE username ILIKE $1 OR display_name ILIKE $1`;
      params.push(`%${search}%`);
      countParams.push(`%${search}%`);
    }

    sql += ` ORDER BY last_login DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(sql, params);
    const countResult = await query(countSql, countParams);

    res.json({
      users: result.rows,
      total: parseInt(countResult.rows[0].count),
      hasMore: offset + result.rows.length < parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    logger.error('Error fetching OAuth users:', error.message);
    res.status(500).json({ error: 'Failed to fetch OAuth users' });
  }
});

/**
 * POST /api/admin/oauth-users/:id/admin
 * Toggle admin status for a user
 */
router.post('/oauth-users/:id/admin', requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { isAdmin } = req.body;

    const user = await OAuthUser.setAdmin(userId, isAdmin);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info(`User ${user.username} admin status set to ${isAdmin}`);

    res.json({
      message: `Admin status ${isAdmin ? 'granted' : 'revoked'}`,
      user: OAuthUser.sanitize(user)
    });
  } catch (error) {
    logger.error('Error updating admin status:', error.message);
    res.status(500).json({ error: 'Failed to update admin status' });
  }
});

/**
 * DELETE /api/admin/oauth-users/:id
 * Delete an OAuth user and their data
 */
router.delete('/oauth-users/:id', requireUserAuth, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    logger.info(`Admin ${req.user.username} attempting to delete OAuth user ID: ${userId}`);

    // Don't allow deleting yourself
    if (req.user.id === userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const user = await OAuthUser.getById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    logger.info(`Found user to delete: ${user.username} (twitch_id: ${user.twitch_id})`);

    // Delete any associated chat data first (from users table)
    if (user.twitch_id) {
      logger.info(`Deleting chat data for twitch_id: ${user.twitch_id}`);
      await executeUserDeletion(user.twitch_id, user.username, false);
      logger.info(`Chat data deleted for ${user.username}`);
    }

    // Now delete the OAuth user
    logger.info(`Deleting OAuth user record for ID: ${userId}`);
    await OAuthUser.deleteUser(userId);
    logger.info(`OAuth user ${user.username} (ID: ${userId}) deleted by admin ${req.user.username}`);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Error deleting OAuth user - Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    logger.error('Error message:', error?.message);
    logger.error('Error stack:', error?.stack);
    logger.error('Error name:', error?.name);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Helper function to generate user data export
async function generateUserExport(twitchId, username) {
  // Find user by twitch_id or username
  let user = null;
  
  if (twitchId) {
    const result = await query('SELECT * FROM users WHERE twitch_id = $1', [twitchId]);
    user = result.rows[0];
  }
  
  if (!user && username) {
    user = await User.getByUsername(username);
  }
  
  if (!user) {
    return {
      exportedAt: new Date().toISOString(),
      user: null,
      messages: [],
      modActions: []
    };
  }

  // Get all messages
  const messagesResult = await query(`
    SELECT m.*, c.name as channel_name
    FROM messages m
    LEFT JOIN channels c ON m.channel_id = c.id
    WHERE m.user_id = $1
    ORDER BY m.timestamp DESC
  `, [user.id]);

  // Get all mod actions
  const modActionsResult = await query(`
    SELECT ma.*, c.name as channel_name
    FROM mod_actions ma
    LEFT JOIN channels c ON ma.channel_id = c.id
    WHERE ma.target_user_id = $1
    ORDER BY ma.timestamp DESC
  `, [user.id]);

  return {
    exportedAt: new Date().toISOString(),
    user: {
      username: user.username,
      displayName: user.display_name,
      twitchId: user.twitch_id,
      firstSeen: user.first_seen,
      lastSeen: user.last_seen
    },
    messages: messagesResult.rows.map(m => ({
      id: m.id,
      channel: m.channel_name,
      message: m.message_text,
      timestamp: m.timestamp
    })),
    modActions: modActionsResult.rows.map(ma => ({
      id: ma.id,
      channel: ma.channel_name,
      type: ma.action_type,
      reason: ma.reason,
      duration: ma.duration_seconds,
      timestamp: ma.timestamp
    })),
    totalMessages: messagesResult.rows.length,
    totalModActions: modActionsResult.rows.length
  };
}

// Helper function to execute user data deletion
async function executeUserDeletion(twitchId, username, deleteOAuthAccount = true) {
  // Find user by twitch_id or username in the messages/users table
  let user = null;
  
  if (twitchId) {
    const result = await query('SELECT * FROM users WHERE twitch_id = $1', [twitchId]);
    user = result.rows[0];
  }
  
  if (!user && username) {
    user = await User.getByUsername(username);
  }
  
  if (user) {
    // Delete all messages
    await query('DELETE FROM messages WHERE user_id = $1', [user.id]);
    
    // Delete mod actions where user was the target
    await query('DELETE FROM mod_actions WHERE target_user_id = $1', [user.id]);
    
    // Delete the user record itself
    await query('DELETE FROM users WHERE id = $1', [user.id]);
    
    logger.info(`Deleted all chat data for user ${username} (${user.id})`);
  }
  
  // Also delete the OAuth user account if requested
  if (deleteOAuthAccount && twitchId) {
    const oauthUser = await query('SELECT id FROM oauth_users WHERE twitch_id = $1', [twitchId]);
    if (oauthUser.rows[0]) {
      await OAuthUser.deleteUser(oauthUser.rows[0].id);
      logger.info(`Deleted OAuth account for user ${username} (twitch_id: ${twitchId})`);
    }
  }
}

// ============================================
// SERVER SETTINGS ROUTES
// ============================================

/**
 * GET /api/admin/settings
 * Get all server settings (rate limits, etc.)
 */
router.get('/settings', requireAuth, async (req, res) => {
  try {
    const configs = await ConfigService.getAll();
    res.json({ configs });
  } catch (error) {
    logger.error('Error fetching config:', error.message);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

/**
 * PUT /api/admin/settings/:key
 * Update a server setting value
 */
router.put('/settings/:key', requireAuth, async (req, res) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }
    
    await ConfigService.set(key, value, description);
    
    res.json({ 
      message: 'Configuration updated',
      key,
      value
    });
  } catch (error) {
    logger.error('Error updating config:', error.message);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

/**
 * DELETE /api/admin/settings/:key
 * Reset a server setting to default
 */
router.delete('/settings/:key', requireAuth, async (req, res) => {
  try {
    const { key } = req.params;
    await ConfigService.reset(key);
    
    const defaults = ConfigService.getDefaults();
    res.json({ 
      message: 'Configuration reset to default',
      key,
      value: defaults[key]
    });
  } catch (error) {
    logger.error('Error resetting config:', error.message);
    res.status(500).json({ error: 'Failed to reset configuration' });
  }
});

/**
 * POST /api/admin/settings/bulk
 * Update multiple server settings at once
 */
router.post('/settings/bulk', requireAuth, async (req, res) => {
  try {
    const { configs } = req.body;
    
    if (!Array.isArray(configs)) {
      return res.status(400).json({ error: 'configs must be an array' });
    }
    
    for (const { key, value } of configs) {
      await ConfigService.set(key, value);
    }
    
    res.json({ 
      message: `Updated ${configs.length} configuration values`
    });
  } catch (error) {
    logger.error('Error bulk updating config:', error.message);
    res.status(500).json({ error: 'Failed to update configurations' });
  }
});

// ============================================
// TRAFFIC ANALYTICS ROUTES
// ============================================

/**
 * GET /api/admin/traffic
 * Get traffic analytics
 */
router.get('/traffic', requireAuth, async (req, res) => {
  try {
    // Support both 'timeRange' and 'range' params, map friendly names to internal format
    const rangeParam = req.query.timeRange || req.query.range || 'day';
    const rangeMap = { 'hour': '1h', 'day': '24h', 'week': '7d' };
    const timeRange = rangeMap[rangeParam] || rangeParam;
    const stats = await getTrafficStats(timeRange);
    res.json({ stats });
  } catch (error) {
    logger.error('Error fetching traffic stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch traffic statistics' });
  }
});

/**
 * DELETE /api/admin/traffic/cleanup
 * Clean up old traffic logs
 */
router.delete('/traffic/cleanup', requireAuth, async (req, res) => {
  try {
    const deleted = await cleanupTrafficLogs();
    res.json({ 
      message: `Cleaned up ${deleted} old traffic log entries`
    });
  } catch (error) {
    logger.error('Error cleaning up traffic logs:', error.message);
    res.status(500).json({ error: 'Failed to cleanup traffic logs' });
  }
});

// ============================================
// IP MANAGEMENT ROUTES
// ============================================

/**
 * GET /api/admin/ip-rules
 * Get all IP rules (blocks and rate limit overrides)
 */
router.get('/ip-rules', requireAuth, async (req, res) => {
  try {
    const rules = await getIpRules();
    res.json({ rules });
  } catch (error) {
    logger.error('Error fetching IP rules:', error.message);
    res.status(500).json({ error: 'Failed to fetch IP rules' });
  }
});

/**
 * GET /api/admin/ip-rules/:ip/status
 * Get current status for a specific IP
 */
router.get('/ip-rules/:ip/status', requireAuth, async (req, res) => {
  try {
    const { ip } = req.params;
    const status = getIpStatus(ip);
    res.json(status);
  } catch (error) {
    logger.error('Error fetching IP status:', error.message);
    res.status(500).json({ error: 'Failed to fetch IP status' });
  }
});

/**
 * POST /api/admin/ip-rules/block
 * Block an IP address
 */
router.post('/ip-rules/block', requireAuth, async (req, res) => {
  try {
    const { ip, reason, expiresAt } = req.body;
    
    if (!ip) {
      return res.status(400).json({ error: 'IP address is required' });
    }
    
    await blockIp(ip, reason, expiresAt ? new Date(expiresAt) : null);
    
    res.json({ 
      message: `IP ${ip} has been blocked`,
      ip
    });
  } catch (error) {
    logger.error('Error blocking IP:', error.message);
    res.status(500).json({ error: 'Failed to block IP' });
  }
});

/**
 * POST /api/admin/ip-rules/unblock
 * Unblock an IP address
 */
router.post('/ip-rules/unblock', requireAuth, async (req, res) => {
  try {
    const { ip } = req.body;
    
    if (!ip) {
      return res.status(400).json({ error: 'IP address is required' });
    }
    
    await unblockIp(ip);
    
    res.json({ 
      message: `IP ${ip} has been unblocked`,
      ip
    });
  } catch (error) {
    logger.error('Error unblocking IP:', error.message);
    res.status(500).json({ error: 'Failed to unblock IP' });
  }
});

/**
 * POST /api/admin/ip-rules/rate-limit
 * Set rate limit override for an IP
 */
router.post('/ip-rules/rate-limit', requireAuth, async (req, res) => {
  try {
    const { ip, limit, expiresAt } = req.body;
    
    if (!ip) {
      return res.status(400).json({ error: 'IP address is required' });
    }
    
    await setIpRateLimit(ip, limit, expiresAt ? new Date(expiresAt) : null);
    
    res.json({ 
      message: limit === null 
        ? `Rate limit override removed for ${ip}` 
        : `Rate limit for ${ip} set to ${limit}`,
      ip,
      limit
    });
  } catch (error) {
    logger.error('Error setting IP rate limit:', error.message);
    res.status(500).json({ error: 'Failed to set IP rate limit' });
  }
});

/**
 * DELETE /api/admin/ip-rules/:id
 * Delete an IP rule by ID
 */
router.delete('/ip-rules/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await deleteIpRule(parseInt(id));
    
    res.json({ 
      message: 'IP rule deleted'
    });
  } catch (error) {
    logger.error('Error deleting IP rule:', error.message);
    res.status(500).json({ error: 'Failed to delete IP rule' });
  }
});

export default router;
