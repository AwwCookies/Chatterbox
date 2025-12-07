import { createTwitchClient, getInitialChannels } from '../config/twitch.js';
import Channel from '../models/Channel.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import logger from '../utils/logger.js';
import discordWebhookService from './discordWebhookService.js';

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
        
        // Broadcast channel status update
        this.websocketService.broadcastChannelStatus({
          name: channelName,
          is_connected: true,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Part channel confirmation
    this.client.on('part', (channel, username, self) => {
      if (self) {
        const channelName = channel.replace('#', '');
        this.connectedChannels.delete(channelName);
        logger.info(`Left channel: ${channelName}`);
        
        // Broadcast channel status update
        this.websocketService.broadcastChannelStatus({
          name: channelName,
          is_connected: false,
          timestamp: new Date().toISOString()
        });
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

    // Parse reply/thread info from IRC tags
    const replyToMessageId = userstate['reply-parent-msg-id'] || null;
    const replyToUserId = userstate['reply-parent-user-id'] ? parseInt(userstate['reply-parent-user-id']) : null;
    const replyToUsername = userstate['reply-parent-user-login'] || null;

    // Extract @mentions from message text
    const mentionRegex = /@(\w{1,25})/g;
    const mentionedUsers = [];
    let match;
    while ((match = mentionRegex.exec(message)) !== null) {
      const username = match[1].toLowerCase();
      if (!mentionedUsers.includes(username)) {
        mentionedUsers.push(username);
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
      emotes,
      replyToMessageId,
      replyToUserId,
      replyToUsername,
      mentionedUsers: mentionedUsers.length > 0 ? mentionedUsers : null
    };

    this.archiveService.queueMessage(messageData);

    // Track message for MPS counter (global and per-channel)
    this.websocketService.trackMessage(channelName);

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
      channelTwitchId: channelRecord.twitch_id,
      reply_to_message_id: replyToMessageId,
      reply_to_user_id: replyToUserId,
      reply_to_username: replyToUsername,
      mentioned_users: mentionedUsers.length > 0 ? mentionedUsers : null
    });

    // Trigger Discord webhooks for tracked users (async, non-blocking)
    discordWebhookService.sendTrackedUserMessage({
      username: userRecord.username,
      displayName: userRecord.display_name,
      message,
      channelName,
      timestamp: messageData.timestamp
    }).catch(err => logger.debug('Webhook error (tracked user):', err.message));
  }

  /**
   * Handle message deletion
   */
  async handleMessageDeleted(channel, username, deletedMessage, userstate) {
    const channelName = channel.replace('#', '');
    const messageId = userstate['target-msg-id'];
    
    // Get channel and user records for mod action
    const channelRecord = await Channel.findOrCreate(channelName);
    const targetUser = await User.findOrCreate(username);
    
    if (messageId) {
      const deleted = await this.archiveService.markMessageDeleted(messageId);
      
      if (deleted) {
        this.websocketService.broadcastMessageDeleted(channelName, {
          messageId,
          deletedAt: new Date()
        });
      }
    }
    
    // Record delete as a mod action so it shows up in moderation page
    const modAction = {
      channelId: channelRecord.id,
      moderatorId: null, // We don't know who deleted it
      targetUserId: targetUser.id,
      actionType: 'delete',
      reason: deletedMessage ? deletedMessage.substring(0, 500) : null, // Store the deleted message text as reason
      timestamp: new Date()
    };

    const savedAction = await this.archiveService.recordModAction(modAction);

    // Enriched data with usernames for WebSocket broadcasts
    const enrichedAction = {
      id: savedAction?.id,
      ...modAction,
      action_type: 'delete',
      target_username: username,
      targetUsername: username,
      target_display_name: targetUser.display_name,
      channel_name: channelName,
      channelName,
      channel_twitch_id: channelRecord.twitch_id,
      last_message: deletedMessage || null,
      message_text: deletedMessage || null
    };

    // Broadcast to channel subscribers
    this.websocketService.broadcastModAction(channelName, enrichedAction);
    
    // Broadcast to global subscribers (dashboard)
    this.websocketService.broadcastGlobalModAction(enrichedAction);

    // Trigger Discord webhooks for mod actions (async, non-blocking)
    discordWebhookService.sendModAction({
      actionType: 'delete',
      targetUsername: username,
      targetDisplayName: targetUser.display_name,
      channelName,
      reason: null,
      moderatorName: null,
      lastMessage: deletedMessage || null,
      timestamp: new Date()
    }).catch(err => logger.debug('Webhook error (mod action):', err.message));
    
    logger.info(`Message deleted in ${channelName} from ${username}`);
  }

  /**
   * Handle user ban
   */
  async handleBan(channel, username, reason, userstate) {
    const channelName = channel.replace('#', '');
    
    const channelRecord = await Channel.findOrCreate(channelName);
    const targetUser = await User.findOrCreate(username);
    
    // Get the user's last message - check buffer first (may not be flushed yet), then database
    let lastMessage = this.archiveService.getLastBufferedMessage(channelRecord.id, targetUser.id, username);
    if (!lastMessage) {
      lastMessage = await Message.getLastUserMessage(channelRecord.id, targetUser.id);
    }
    
    const modAction = {
      channelId: channelRecord.id,
      moderatorId: null, // We don't always know the moderator
      targetUserId: targetUser.id,
      actionType: 'ban',
      reason: reason || null,
      timestamp: new Date()
    };

    const savedAction = await this.archiveService.recordModAction(modAction);

    // Enriched data with usernames for WebSocket broadcasts
    const enrichedAction = {
      id: savedAction?.id,
      ...modAction,
      action_type: 'ban',
      target_username: username,
      targetUsername: username,
      target_display_name: targetUser.display_name,
      channel_name: channelName,
      channelName,
      channel_twitch_id: channelRecord.twitch_id,
      last_message: lastMessage?.message_text || null,
      message_text: lastMessage?.message_text || null
    };

    // Broadcast to channel subscribers
    this.websocketService.broadcastModAction(channelName, enrichedAction);
    
    // Broadcast to global subscribers (dashboard)
    this.websocketService.broadcastGlobalModAction(enrichedAction);

    // Trigger Discord webhooks for mod actions (async, non-blocking)
    discordWebhookService.sendModAction({
      actionType: 'ban',
      targetUsername: username,
      targetDisplayName: targetUser.display_name,
      channelName,
      reason: reason || null,
      moderatorName: null,
      lastMessage: lastMessage?.message_text || null,
      timestamp: new Date()
    }).catch(err => logger.debug('Webhook error (mod action):', err.message));
    
    logger.info(`User ${username} banned in ${channelName}`);
  }

  /**
   * Handle user timeout
   */
  async handleTimeout(channel, username, reason, duration, userstate) {
    const channelName = channel.replace('#', '');
    
    const channelRecord = await Channel.findOrCreate(channelName);
    const targetUser = await User.findOrCreate(username);
    
    // Get the user's last message - check buffer first (may not be flushed yet), then database
    let lastMessage = this.archiveService.getLastBufferedMessage(channelRecord.id, targetUser.id, username);
    if (!lastMessage) {
      lastMessage = await Message.getLastUserMessage(channelRecord.id, targetUser.id);
    }
    
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

    // Enriched data with usernames for WebSocket broadcasts
    const enrichedAction = {
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
      channel_twitch_id: channelRecord.twitch_id,
      last_message: lastMessage?.message_text || null,
      message_text: lastMessage?.message_text || null
    };

    // Broadcast to channel subscribers
    this.websocketService.broadcastModAction(channelName, enrichedAction);
    
    // Broadcast to global subscribers (dashboard)
    this.websocketService.broadcastGlobalModAction(enrichedAction);

    // Trigger Discord webhooks for mod actions (async, non-blocking)
    discordWebhookService.sendModAction({
      actionType: 'timeout',
      targetUsername: username,
      targetDisplayName: targetUser.display_name,
      channelName,
      reason: reason || null,
      duration,
      moderatorName: null,
      lastMessage: lastMessage?.message_text || null,
      timestamp: new Date()
    }).catch(err => logger.debug('Webhook error (mod action):', err.message));
    
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
   * Get service status
   */
  getStatus() {
    return {
      connected: this.client?.readyState() === 'OPEN',
      channels: Array.from(this.connectedChannels),
      username: process.env.TWITCH_USERNAME || null,
    };
  }

  /**
   * Reconnect to Twitch IRC
   */
  async reconnect() {
    logger.info('Reconnecting to Twitch IRC...');
    if (this.client) {
      try {
        await this.client.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
    }
    this.connectedChannels.clear();
    await this.initialize();
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
