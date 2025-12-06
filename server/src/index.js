import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import rateLimit from 'express-rate-limit';
import { marked } from 'marked';

import { testConnection } from './config/database.js';
import logger from './utils/logger.js';

// Services
import ArchiveService from './services/archiveService.js';
import WebSocketService from './services/websocketService.js';
import TwitchService from './services/twitchService.js';
import twitchApiService from './services/twitchApiService.js';
import ConfigService from './services/configService.js';
import discordWebhookService from './services/discordWebhookService.js';

// Middleware
import { 
  trafficAnalytics, 
  ipBlocker, 
  perIpRateLimiter,
  initializeTrafficTracking 
} from './middleware/trafficMiddleware.js';

// Routes
import messagesRouter from './routes/messages.js';
import usersRouter from './routes/users.js';
import modActionsRouter from './routes/modActions.js';
import channelsRouter, { setTwitchService } from './routes/channels.js';
import utilsRouter from './routes/utils.js';
import adminRouter from './routes/admin.js';
import oauthRouter from './routes/oauth.js';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

// CORS configuration - allow requests from any origin on the same network or production domains
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Allow any localhost or local network origin
    const allowedPatterns = [
      /^https?:\/\/localhost(:\d+)?$/,
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
      /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
      /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
      /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/,
      /^https?:\/\/(.*\.)?calicos\.art$/,  // Production domains
    ];
    
    // Also allow explicitly configured CLIENT_URL
    if (process.env.CLIENT_URL && origin === process.env.CLIENT_URL) {
      return callback(null, true);
    }
    
    // Check against patterns
    if (allowedPatterns.some(pattern => pattern.test(origin))) {
      return callback(null, true);
    }
    
    logger.warn(`CORS blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Traffic middleware (IP blocking, analytics, per-IP rate limiting)
app.use('/api', ipBlocker);
app.use('/api', trafficAnalytics);
app.use('/api', perIpRateLimiter);

// Global rate limiting (backup)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10000, // 10000 requests per minute
  message: { error: 'Too many requests, please try again later' }
});
app.use('/api', limiter);

// Request logging
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// Initialize services
const archiveService = new ArchiveService();
const websocketService = new WebSocketService();

// Make services globally accessible for admin routes
global.archiveService = archiveService;
global.websocketService = websocketService;

// API Routes
app.use('/api/messages', messagesRouter);
app.use('/api/users', usersRouter);
app.use('/api/mod-actions', modActionsRouter);
app.use('/api/channels', channelsRouter);
app.use('/api/utils', utilsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/oauth', oauthRouter);
app.use('/api/chat', (await import('./routes/chat.js')).default);
app.use('/api/webhooks', (await import('./routes/webhooks.js')).default);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const dbConnected = await testConnection();
  res.json({
    status: dbConnected ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    archive: archiveService.getStats()
  });
});

// API Documentation at root
app.get('/', async (req, res) => {
  try {
    // In Docker: /app/api.md (mounted), locally: ../../api.md
    const apiMdPath = process.env.NODE_ENV === 'production' 
      ? '/app/api.md'
      : path.resolve(__dirname, '../../api.md');
    const markdown = await fs.readFile(apiMdPath, 'utf-8');
    const htmlContent = marked(markdown);
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chatterbox API Documentation</title>
  <style>
    :root {
      --bg-primary: #0e0e10;
      --bg-secondary: #18181b;
      --bg-tertiary: #1f1f23;
      --text-primary: #efeff1;
      --text-secondary: #adadb8;
      --accent: #9147ff;
      --accent-hover: #772ce8;
      --border: #3d3d40;
      --code-bg: #26262c;
      --success: #00c853;
      --warning: #ff9800;
      --error: #f44336;
      --info: #2196f3;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background-color: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    h1 { color: var(--accent); margin-bottom: 1rem; font-size: 2.5rem; border-bottom: 2px solid var(--accent); padding-bottom: 0.5rem; }
    h2 { color: var(--text-primary); margin: 2rem 0 1rem; font-size: 1.75rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
    h3 { color: var(--accent); margin: 1.5rem 0 0.75rem; font-size: 1.25rem; }
    h4 { color: var(--text-secondary); margin: 1rem 0 0.5rem; font-size: 1.1rem; }
    
    p { margin-bottom: 1rem; color: var(--text-secondary); }
    
    a { color: var(--accent); text-decoration: none; }
    a:hover { color: var(--accent-hover); text-decoration: underline; }
    
    code {
      background-color: var(--code-bg);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-family: 'Fira Code', 'Consolas', monospace;
      font-size: 0.9em;
      color: var(--accent);
    }
    
    pre {
      background-color: var(--code-bg);
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1rem 0;
      border: 1px solid var(--border);
    }
    
    pre code {
      background: none;
      padding: 0;
      color: var(--text-primary);
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
      background-color: var(--bg-secondary);
      border-radius: 8px;
      overflow: hidden;
    }
    
    th, td {
      padding: 0.75rem 1rem;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    
    th {
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
      font-weight: 600;
    }
    
    tr:hover { background-color: var(--bg-tertiary); }
    
    blockquote {
      border-left: 4px solid var(--accent);
      padding-left: 1rem;
      margin: 1rem 0;
      color: var(--text-secondary);
      background-color: var(--bg-secondary);
      padding: 1rem;
      border-radius: 0 8px 8px 0;
    }
    
    ul, ol { margin: 1rem 0; padding-left: 2rem; color: var(--text-secondary); }
    li { margin: 0.5rem 0; }
    
    hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 2rem 0;
    }
    
    /* Method badges */
    code:first-child {
      font-weight: bold;
    }
    
    /* Scrollbar */
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: var(--bg-secondary); }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--accent); }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    logger.error('Error serving API docs:', error.message);
    res.status(500).json({ error: 'Failed to load API documentation' });
  }
});

// Stats endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const { query } = await import('./config/database.js');
    
    const [messageCount, userCount, channelCount, messagesLast24h] = await Promise.all([
      query('SELECT COUNT(*) FROM messages'),
      query('SELECT COUNT(*) FROM users'),
      query('SELECT COUNT(*) FROM channels WHERE is_active = TRUE'),
      query(`
        SELECT 
          date_trunc('hour', timestamp) as hour,
          COUNT(*) as count
        FROM messages
        WHERE timestamp > NOW() - INTERVAL '24 hours'
        GROUP BY date_trunc('hour', timestamp)
        ORDER BY hour ASC
      `)
    ]);

    res.json({
      totalMessages: parseInt(messageCount.rows[0].count),
      totalUsers: parseInt(userCount.rows[0].count),
      activeChannels: parseInt(channelCount.rows[0].count),
      connectedClients: websocketService.getConnectedClients(),
      archiveBuffer: archiveService.getStats(),
      messagesLast24h: messagesLast24h.rows.map(row => ({
        hour: row.hour,
        count: parseInt(row.count)
      }))
    });
  } catch (error) {
    logger.error('Error fetching stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  // Stop accepting new connections
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });

  // Stop services
  await archiveService.stop();
  
  if (global.twitchService) {
    await global.twitchService.disconnect();
  }

  // Close database connections
  const pool = (await import('./config/database.js')).default;
  await pool.end();
  
  logger.info('Graceful shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }

    // Initialize config service (creates tables if needed)
    await ConfigService.initialize();
    
    // Initialize traffic tracking (loads blocked IPs, etc.)
    await initializeTrafficTracking();

    // Initialize WebSocket
    websocketService.initialize(httpServer, corsOptions);

    // Wire up websocket service to archive service for flush notifications
    archiveService.setWebsocketService(websocketService);

    // Set up stats callback for real-time stats broadcasting
    archiveService.setStatsCallback(async () => {
      const { query } = await import('./config/database.js');
      const [messageCount, userCount, channelCount] = await Promise.all([
        query('SELECT COUNT(*) FROM messages'),
        query('SELECT COUNT(*) FROM users'),
        query('SELECT COUNT(*) FROM channels WHERE is_active = TRUE'),
      ]);
      return {
        totalMessages: parseInt(messageCount.rows[0].count),
        totalUsers: parseInt(userCount.rows[0].count),
        activeChannels: parseInt(channelCount.rows[0].count),
        connectedClients: websocketService.getConnectedClients(),
        archiveBuffer: archiveService.getStats(),
      };
    });

    // Initialize Twitch service
    const twitchService = new TwitchService(archiveService, websocketService);
    global.twitchService = twitchService;
    setTwitchService(twitchService);

    // Start archive service
    archiveService.start();

    // Connect to Twitch IRC
    await twitchService.initialize();

    // Start periodic stream status updater (broadcasts changes via WebSocket)
    let lastStreamStatuses = {};
    const updateStreamStatuses = async () => {
      try {
        const channels = await Channel.getAll(true); // Active channels only
        const channelNames = channels.map(c => c.name);
        
        if (channelNames.length === 0) return;
        
        // Force refresh stream status
        await twitchApiService.refreshStreamStatus(channelNames);
        const currentStatuses = twitchApiService.getStreamStatuses(channelNames);
        
        // Get user profiles for profile pictures
        const userProfiles = await twitchApiService.getUserProfiles(channelNames);
        
        // Check for changes and broadcast
        for (const channel of channels) {
          const nameLower = channel.name.toLowerCase();
          const current = currentStatuses[nameLower] || {};
          const previous = lastStreamStatuses[nameLower] || {};
          const profile = userProfiles[nameLower] || {};
          
          // Broadcast if live status changed or viewer count changed significantly
          const liveChanged = current.isLive !== previous.isLive;
          const viewersChanged = current.isLive && Math.abs((current.viewerCount || 0) - (previous.viewerCount || 0)) > 100;
          const gameChanged = previous.gameName && current.gameName && previous.gameName !== current.gameName;
          
          if (liveChanged || viewersChanged || !lastStreamStatuses[nameLower]) {
            websocketService.broadcastChannelStatus({
              name: channel.name,
              display_name: channel.display_name,
              is_live: current.isLive || false,
              viewer_count: current.viewerCount || null,
              stream_title: current.title || null,
              game_name: current.gameName || null,
              started_at: current.startedAt || null,
              profile_image_url: profile.profileImageUrl || null,
            });
          }

          // Trigger Discord webhooks for stream status changes (only if we have previous state)
          if (lastStreamStatuses[nameLower]) {
            // Channel went live
            if (current.isLive && !previous.isLive) {
              discordWebhookService.sendChannelLive({
                channelName: channel.name,
                displayName: channel.display_name || channel.name,
                title: current.title || 'No title',
                gameName: current.gameName || 'Just Chatting',
                viewerCount: current.viewerCount || 0,
                profileImageUrl: profile.profileImageUrl || null,
                timestamp: new Date()
              }).catch(err => logger.debug('Webhook error (channel live):', err.message));
            }
            
            // Channel went offline
            if (!current.isLive && previous.isLive) {
              discordWebhookService.sendChannelOffline({
                channelName: channel.name,
                displayName: channel.display_name || channel.name,
                profileImageUrl: profile.profileImageUrl || null,
                timestamp: new Date()
              }).catch(err => logger.debug('Webhook error (channel offline):', err.message));
            }
            
            // Game changed while live
            if (gameChanged && current.isLive) {
              discordWebhookService.sendGameChange({
                channelName: channel.name,
                displayName: channel.display_name || channel.name,
                previousGame: previous.gameName,
                newGame: current.gameName,
                profileImageUrl: profile.profileImageUrl || null,
                timestamp: new Date()
              }).catch(err => logger.debug('Webhook error (game change):', err.message));
            }
          }
        }
        
        lastStreamStatuses = currentStatuses;
      } catch (error) {
        logger.error('Error updating stream statuses:', error.message);
      }
    };
    
    // Import Channel model for the updater
    const Channel = (await import('./models/Channel.js')).default;
    
    // Initial update after 5 seconds
    setTimeout(updateStreamStatuses, 5000);
    // Then update every 60 seconds
    setInterval(updateStreamStatuses, 60000);

    // Start HTTP server
    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`WebSocket available at ws://localhost:${PORT}/api/live`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
