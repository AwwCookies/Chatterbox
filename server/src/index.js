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

// Routes
import messagesRouter from './routes/messages.js';
import usersRouter from './routes/users.js';
import modActionsRouter from './routes/modActions.js';
import channelsRouter, { setTwitchService } from './routes/channels.js';
import utilsRouter from './routes/utils.js';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Rate limiting
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

// API Routes
app.use('/api/messages', messagesRouter);
app.use('/api/users', usersRouter);
app.use('/api/mod-actions', modActionsRouter);
app.use('/api/channels', channelsRouter);
app.use('/api/utils', utilsRouter);

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
    
    const [messageCount, userCount, channelCount] = await Promise.all([
      query('SELECT COUNT(*) FROM messages'),
      query('SELECT COUNT(*) FROM users'),
      query('SELECT COUNT(*) FROM channels WHERE is_active = TRUE')
    ]);

    res.json({
      totalMessages: parseInt(messageCount.rows[0].count),
      totalUsers: parseInt(userCount.rows[0].count),
      activeChannels: parseInt(channelCount.rows[0].count),
      connectedClients: websocketService.getConnectedClients(),
      archiveBuffer: archiveService.getStats()
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

    // Initialize WebSocket
    websocketService.initialize(httpServer, corsOptions);

    // Wire up websocket service to archive service for flush notifications
    archiveService.setWebsocketService(websocketService);

    // Initialize Twitch service
    const twitchService = new TwitchService(archiveService, websocketService);
    global.twitchService = twitchService;
    setTwitchService(twitchService);

    // Start archive service
    archiveService.start();

    // Connect to Twitch IRC
    await twitchService.initialize();

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
