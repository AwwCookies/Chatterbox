import { Server } from 'socket.io';
import logger from '../utils/logger.js';

class WebSocketService {
  constructor() {
    this.io = null;
    this.clientSubscriptions = new Map(); // socketId -> Set of channels
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
    logger.info('WebSocket service initialized');
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
}

export default WebSocketService;
