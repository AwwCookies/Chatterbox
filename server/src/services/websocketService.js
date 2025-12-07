import { Server } from 'socket.io';
import logger from '../utils/logger.js';

class WebSocketService {
  constructor() {
    this.io = null;
    this.clientSubscriptions = new Map(); // socketId -> Set of channels
    this.stats = {
      totalMessages: 0,
      totalUsers: 0,
      activeChannels: 0,
    };
    // Message rate tracking
    this.messageCount = 0;
    this.channelMessageCounts = new Map(); // channelName -> count
    this.mpsInterval = null;
  }

  /**
   * Initialize Socket.io server
   */
  initialize(httpServer, corsOptions) {
    this.io = new Server(httpServer, {
      cors: corsOptions,
      path: '/api/live'
    });

    this.setupConnectionHandlers();
    this.startMpsTracking();
    logger.info('WebSocket service initialized');
  }

  /**
   * Start broadcasting messages per second to global subscribers
   */
  startMpsTracking() {
    this.mpsInterval = setInterval(() => {
      const mps = this.messageCount;
      this.messageCount = 0;
      
      // Build channel MPS data
      const channelMps = {};
      for (const [channel, count] of this.channelMessageCounts) {
        channelMps[channel] = count;
      }
      this.channelMessageCounts.clear();
      
      // Broadcast global MPS to global subscribers
      this.broadcastGlobal('mps_update', { mps, channelMps });
      
      // Broadcast channel-specific MPS to each channel's subscribers
      for (const [channel, count] of Object.entries(channelMps)) {
        this.io?.to(`channel:${channel}`).emit('channel_mps', { 
          channel, 
          mps: count,
          timestamp: new Date().toISOString()
        });
      }
    }, 1000);
  }

  /**
   * Increment message counter (call this when a message is received)
   */
  trackMessage(channelName = null) {
    this.messageCount++;
    if (channelName) {
      const current = this.channelMessageCounts.get(channelName) || 0;
      this.channelMessageCounts.set(channelName, current + 1);
    }
  }

  /**
   * Set up connection handlers
   */
  setupConnectionHandlers() {
    this.io.on('connection', (socket) => {
      logger.debug(`Client connected: ${socket.id}`);
      this.clientSubscriptions.set(socket.id, new Set());

      // Handle channel subscription
      socket.on('subscribe', (data) => {
        const channels = Array.isArray(data.channels) ? data.channels : [data.channels];
        
        channels.forEach(channel => {
          const channelName = channel.toLowerCase().replace('#', '');
          socket.join(`channel:${channelName}`);
          this.clientSubscriptions.get(socket.id)?.add(channelName);
          logger.debug(`Client ${socket.id} subscribed to ${channelName}`);
        });

        socket.emit('subscribed', { channels: channels.map(c => c.toLowerCase()) });
      });

      // Handle global subscription for dashboard updates
      socket.on('subscribe_global', () => {
        socket.join('global');
        logger.debug(`Client ${socket.id} subscribed to global updates`);
        socket.emit('subscribed_global');
      });

      socket.on('unsubscribe_global', () => {
        socket.leave('global');
        logger.debug(`Client ${socket.id} unsubscribed from global updates`);
      });

      // Handle channel unsubscription
      socket.on('unsubscribe', (data) => {
        const channels = Array.isArray(data.channels) ? data.channels : [data.channels];
        
        channels.forEach(channel => {
          const channelName = channel.toLowerCase().replace('#', '');
          socket.leave(`channel:${channelName}`);
          this.clientSubscriptions.get(socket.id)?.delete(channelName);
          logger.debug(`Client ${socket.id} unsubscribed from ${channelName}`);
        });

        socket.emit('unsubscribed', { channels: channels.map(c => c.toLowerCase()) });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.clientSubscriptions.delete(socket.id);
        logger.debug(`Client disconnected: ${socket.id}`);
      });

      // Ping/pong for connection health
      socket.on('ping', () => {
        socket.emit('pong');
      });
    });
  }

  /**
   * Broadcast a new message to channel subscribers
   */
  broadcastMessage(channelName, messageData) {
    this.io?.to(`channel:${channelName}`).emit('message', {
      type: 'message',
      data: messageData,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast message deletion
   */
  broadcastMessageDeleted(channelName, deleteData) {
    this.io?.to(`channel:${channelName}`).emit('message_deleted', {
      type: 'delete',
      data: deleteData,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast a mod action
   */
  broadcastModAction(channelName, actionData) {
    this.io?.to(`channel:${channelName}`).emit('mod_action', {
      type: 'mod_action',
      data: actionData,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get connected client count
   */
  getConnectedClients() {
    return this.io?.engine?.clientsCount || 0;
  }

  /**
   * Get subscriptions for a specific channel
   */
  getChannelSubscribers(channelName) {
    const room = this.io?.sockets?.adapter?.rooms?.get(`channel:${channelName}`);
    return room ? room.size : 0;
  }

  /**
   * Broadcast to all connected clients
   */
  broadcastToAll(event, data) {
    this.io?.emit(event, data);
  }

  /**
   * Broadcast to a specific channel's subscribers
   */
  broadcastToChannel(channelName, event, data) {
    this.io?.to(`channel:${channelName}`).emit(event, {
      type: event,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast to global subscribers only (dashboard clients)
   */
  broadcastGlobal(event, data) {
    this.io?.to('global').emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast stats update to global subscribers
   */
  broadcastStatsUpdate(stats) {
    this.broadcastGlobal('stats_update', stats);
  }

  /**
   * Broadcast channel status change (live/offline)
   */
  broadcastChannelStatus(channelData) {
    this.broadcastGlobal('channel_status', channelData);
  }

  /**
   * Broadcast mod action to global subscribers (for dashboard mod feed)
   */
  broadcastGlobalModAction(actionData) {
    this.broadcastGlobal('global_mod_action', actionData);
  }
}

export default WebSocketService;
