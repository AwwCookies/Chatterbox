import { io } from 'socket.io-client';

// Dynamically determine WebSocket URL based on current location
const getWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  // In production, WS is on port 3000 of the same host
  const { hostname } = window.location;
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${hostname}:3000`;
};

const WS_URL = getWsUrl();

class WebSocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.subscribedChannels = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.isSubscribedGlobal = false;
  }

  connect() {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(WS_URL, {
      path: '/api/live',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      
      // Resubscribe to channels
      if (this.subscribedChannels.size > 0) {
        this.subscribe(Array.from(this.subscribedChannels));
      }
      
      // Resubscribe to global if was previously subscribed
      if (this.isSubscribedGlobal) {
        this.socket.emit('subscribe_global');
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;
    });

    // Message events
    this.socket.on('message', (data) => {
      this.emit('message', data);
    });

    this.socket.on('message_deleted', (data) => {
      this.emit('message_deleted', data);
    });

    this.socket.on('mod_action', (data) => {
      this.emit('mod_action', data);
    });

    this.socket.on('messages_flushed', (data) => {
      this.emit('messages_flushed', data);
    });

    // Global events for dashboard
    this.socket.on('stats_update', (data) => {
      this.emit('stats_update', data);
    });

    this.socket.on('channel_status', (data) => {
      this.emit('channel_status', data);
    });

    this.socket.on('global_mod_action', (data) => {
      this.emit('global_mod_action', data);
    });

    this.socket.on('mps_update', (data) => {
      this.emit('mps_update', data);
    });

    this.socket.on('channel_mps', (data) => {
      this.emit('channel_mps', data);
    });

    this.socket.on('subscribed', (data) => {
      console.log('Subscribed to channels:', data.channels);
    });

    this.socket.on('subscribed_global', () => {
      console.log('Subscribed to global updates');
    });

    this.socket.on('pong', () => {
      console.debug('Pong received');
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.subscribedChannels.clear();
    this.listeners.clear();
    this.isSubscribedGlobal = false;
  }

  subscribe(channels) {
    const channelList = Array.isArray(channels) ? channels : [channels];
    
    if (this.socket?.connected) {
      this.socket.emit('subscribe', { channels: channelList });
    }
    
    channelList.forEach(c => this.subscribedChannels.add(c.toLowerCase()));
  }

  unsubscribe(channels) {
    const channelList = Array.isArray(channels) ? channels : [channels];
    
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe', { channels: channelList });
    }
    
    channelList.forEach(c => this.subscribedChannels.delete(c.toLowerCase()));
  }

  /**
   * Subscribe to global events (stats updates, channel status, global mod actions)
   */
  subscribeGlobal() {
    if (this.socket?.connected && !this.isSubscribedGlobal) {
      this.socket.emit('subscribe_global');
      this.isSubscribedGlobal = true;
    }
  }

  /**
   * Unsubscribe from global events
   */
  unsubscribeGlobal() {
    if (this.socket?.connected && this.isSubscribedGlobal) {
      this.socket.emit('unsubscribe_global');
      this.isSubscribedGlobal = false;
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event, data) {
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in WebSocket listener:', error);
      }
    });
  }

  ping() {
    if (this.socket?.connected) {
      this.socket.emit('ping');
    }
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

// Singleton instance
const wsService = new WebSocketService();

export default wsService;
