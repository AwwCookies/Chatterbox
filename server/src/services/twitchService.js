import { createTwitchClient, getInitialChannels } from '../config/twitch.js';
import Channel from '../models/Channel.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

class TwitchService {
  constructor(archiveService, websocketService) {
    this.client = null;
    this.archiveService = archiveService;
    this.websocketService = websocketService;
    this.connectedChannels = new Set();
  }

  /**
   * Initialize and connect to Twitch IRC
   */
  async initialize() {
    // Get channels from database (active ones) or env
    let channels = await Channel.getActiveNames();
    
    if (channels.length === 0) {
      channels = getInitialChannels();
      // Create channel records for initial channels
      for (const channel of channels) {
        await Channel.findOrCreate(channel);
      }
    }

    logger.info(`Connecting to ${channels.length} channels:`, channels);
    
    this.client = createTwitchClient(channels);
    this.setupEventHandlers();
    
    try {
      await this.client.connect();
      channels.forEach(c => this.connectedChannels.add(c.toLowerCase()));
      logger.info('Twitch IRC connected successfully');
    } catch (error) {
      logger.error('Failed to connect to Twitch IRC:', error.message);
      throw error;
    }
  }

  /**
   * Set up all Twitch IRC event handlers
   */
  setupEventHandlers() {
    // Chat message
    this.client.on('message', async (channel, userstate, message, self) => {
      if (self) return; // Ignore own messages
      
      try {
        await this.handleMessage(channel, userstate, message);
      } catch (error) {
        logger.error('Error handling message:', error.message);
      }
    });

    // Message deleted
    this.client.on('messagedeleted', async (channel, username, deletedMessage, userstate) => {
      try {
        await this.handleMessageDeleted(channel, username, deletedMessage, userstate);
      } catch (error) {
        logger.error('Error handling message deletion:', error.message);
      }
    });

    // User banned
    this.client.on('ban', async (channel, username, reason, userstate) => {
      try {
        await this.handleBan(channel, username, reason, userstate);
      } catch (error) {
        logger.error('Error handling ban:', error.message);
      }
    });

    // User timed out
    this.client.on('timeout', async (channel, username, reason, duration, userstate) => {
      try {
        await this.handleTimeout(channel, username, reason, duration, userstate);
      } catch (error) {
        logger.error('Error handling timeout:', error.message);
      }
    });

    // Chat cleared
    this.client.on('clearchat', async (channel) => {
      try {
        await this.handleClearChat(channel);
      } catch (error) {
        logger.error('Error handling clear chat:', error.message);
      }
    });

    // Join channel confirmation
    this.client.on('join', (channel, username, self) => {
      if (self) {
        const channelName = channel.replace('#', '');
        this.connectedChannels.add(channelName);
        logger.info(`Joined channel: ${channelName}`);
      }
    });

    // Part channel confirmation
    this.client.on('part', (channel, username, self) => {
      if (self) {
        const channelName = channel.replace('#', '');
        this.connectedChannels.delete(channelName);
        logger.info(`Left channel: ${channelName}`);
      }
    });
  }

  /**
   * Handle incoming chat message
   */
  async handleMessage(channel, userstate, message) {
    const channelName = channel.replace('#', '');
    
    // Get or create channel and user
    const channelRecord = await Channel.findOrCreate(channelName, userstate['room-id']);
    const userRecord = await User.findOrCreate(
      userstate.username,
      userstate['user-id'],
      userstate['display-name']
    );

    // Parse badges
    const badges = [];
    if (userstate.badges) {
      for (const [type, version] of Object.entries(userstate.badges)) {
        badges.push({ type, version });
      }
    }

    // Parse emotes
    const emotes = [];
    if (userstate.emotes) {
      for (const [id, positions] of Object.entries(userstate.emotes)) {
        for (const pos of positions) {
          const [start, end] = pos.split('-');
          emotes.push({ id, start: parseInt(start), end: parseInt(end) });
        }
      }
    }

    // Queue message for batch insert
    const messageData = {
      channelId: channelRecord.id,
      userId: userRecord.id,
      messageText: message,
      timestamp: new Date(parseInt(userstate['tmi-sent-ts']) || Date.now()),
      messageId: userstate.id,
      badges,
      emotes
    };

    this.archiveService.queueMessage(messageData);

    // Broadcast to WebSocket clients
    this.websocketService.broadcastMessage(channelName, {
      ...messageData,
      message_text: message,
      username: userRecord.username,
      displayName: userRecord.display_name,
      user_display_name: userRecord.display_name,
      channel_name: channelName,
      channelName,
      channel_twitch_id: channelRecord.twitch_id,
      channelTwitchId: channelRecord.twitch_id
    });
  }

  /**
   * Handle message deletion
   */
  async handleMessageDeleted(channel, username, deletedMessage, userstate) {
    const channelName = channel.replace('#', '');
    const messageId = userstate['target-msg-id'];
    
    if (messageId) {
      const deleted = await this.archiveService.markMessageDeleted(messageId);
      
      if (deleted) {
        this.websocketService.broadcastMessageDeleted(channelName, {
          messageId,
          deletedAt: new Date()
        });
      }
    }
    
    logger.info(`Message deleted in ${channelName} from ${username}`);
  }

  /**
   * Handle user ban
   */
  async handleBan(channel, username, reason, userstate) {
    const channelName = channel.replace('#', '');
    
    const channelRecord = await Channel.findOrCreate(channelName);
    const targetUser = await User.findOrCreate(username);
    
    const modAction = {
      channelId: channelRecord.id,
      moderatorId: null, // We don't always know the moderator
      targetUserId: targetUser.id,
      actionType: 'ban',
      reason: reason || null,
      timestamp: new Date()
    };

    const savedAction = await this.archiveService.recordModAction(modAction);

    this.websocketService.broadcastModAction(channelName, {
      id: savedAction?.id,
      ...modAction,
      action_type: 'ban',
      target_username: username,
      targetUsername: username,
      target_display_name: targetUser.display_name,
      channel_name: channelName,
      channelName,
      channel_twitch_id: channelRecord.twitch_id
    });
    
    logger.info(`User ${username} banned in ${channelName}`);
  }

  /**
   * Handle user timeout
   */
  async handleTimeout(channel, username, reason, duration, userstate) {
    const channelName = channel.replace('#', '');
    
    const channelRecord = await Channel.findOrCreate(channelName);
    const targetUser = await User.findOrCreate(username);
    
    const modAction = {
      channelId: channelRecord.id,
      moderatorId: null,
      targetUserId: targetUser.id,
      actionType: 'timeout',
      durationSeconds: duration,
      reason: reason || null,
      timestamp: new Date()
    };

    const savedAction = await this.archiveService.recordModAction(modAction);

    this.websocketService.broadcastModAction(channelName, {
      id: savedAction?.id,
      ...modAction,
      action_type: 'timeout',
      duration_seconds: duration,
      durationSeconds: duration,
      target_username: username,
      targetUsername: username,
      target_display_name: targetUser.display_name,
      channel_name: channelName,
      channelName,
      channel_twitch_id: channelRecord.twitch_id
    });
    
    logger.info(`User ${username} timed out for ${duration}s in ${channelName}`);
  }

  /**
   * Handle chat clear
   */
  async handleClearChat(channel) {
    const channelName = channel.replace('#', '');
    
    const channelRecord = await Channel.findOrCreate(channelName);
    
    const modAction = {
      channelId: channelRecord.id,
      moderatorId: null,
      targetUserId: null, // Clear affects all users
      actionType: 'clear',
      timestamp: new Date()
    };

    // Note: We don't mark all messages as deleted on clear, just record the action
    logger.info(`Chat cleared in ${channelName}`);
  }

  /**
   * Join a new channel
   */
  async joinChannel(channelName) {
    const name = channelName.toLowerCase().replace('#', '');
    
    if (this.connectedChannels.has(name)) {
      logger.warn(`Already connected to channel: ${name}`);
      return false;
    }

    try {
      await this.client.join(name);
      await Channel.findOrCreate(name);
      await Channel.updateStatus(name, true);
      return true;
    } catch (error) {
      logger.error(`Failed to join channel ${name}:`, error.message);
      throw error;
    }
  }

  /**
   * Leave a channel
   */
  async partChannel(channelName) {
    const name = channelName.toLowerCase().replace('#', '');
    
    if (!this.connectedChannels.has(name)) {
      logger.warn(`Not connected to channel: ${name}`);
      return false;
    }

    try {
      await this.client.part(name);
      await Channel.updateStatus(name, false);
      return true;
    } catch (error) {
      logger.error(`Failed to leave channel ${name}:`, error.message);
      throw error;
    }
  }

  /**
   * Rejoin a channel (useful for fixing connection issues)
   */
  async rejoinChannel(channelName) {
    const name = channelName.toLowerCase().replace('#', '');
    
    if (this.connectedChannels.has(name)) {
      await this.client.part(name);
    }
    
    await this.client.join(name);
    return true;
  }

  /**
   * Get list of connected channels
   */
  getConnectedChannels() {
    return Array.from(this.connectedChannels);
  }

  /**
   * Graceful shutdown
   */
  async disconnect() {
    if (this.client) {
      logger.info('Disconnecting from Twitch IRC...');
      await this.client.disconnect();
    }
  }
}

export default TwitchService;
