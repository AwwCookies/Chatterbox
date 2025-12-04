import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import rateLimit from 'express-rate-limit';

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
  max: 100, // 100 requests per minute
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
