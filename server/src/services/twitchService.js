import { createTwitchClient, getInitialChannels } from '../config/twitch.js';
import Channel from '../models/Channel.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import logger from '../utils/logger.js';
import discordWebhookService from './discordWebhookService.js';
import { query } from '../config/database.js';

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

    // ==================== MONETIZATION EVENTS ====================

    // Subscription (new sub or resub)
    this.client.on('subscription', async (channel, username, method, message, userstate) => {
      try {
        await this.handleSubscription(channel, username, method, message, userstate);
      } catch (error) {
        logger.error('Error handling subscription:', error.message);
      }
    });

    // Resub (separate event in some tmi.js versions)
    this.client.on('resub', async (channel, username, months, message, userstate, methods) => {
      try {
        await this.handleResub(channel, username, months, message, userstate, methods);
      } catch (error) {
        logger.error('Error handling resub:', error.message);
      }
    });

    // Gift subscription (single gift)
    this.client.on('subgift', async (channel, username, streakMonths, recipient, methods, userstate) => {
      try {
        await this.handleSubGift(channel, username, streakMonths, recipient, methods, userstate);
      } catch (error) {
        logger.error('Error handling sub gift:', error.message);
      }
    });

    // Mystery gift (mass gift subs)
    this.client.on('submysterygift', async (channel, username, numbOfSubs, methods, userstate) => {
      try {
        await this.handleMysteryGift(channel, username, numbOfSubs, methods, userstate);
      } catch (error) {
        logger.error('Error handling mystery gift:', error.message);
      }
    });

    // Prime paid upgrade
    this.client.on('primepaidupgrade', async (channel, username, methods, userstate) => {
      try {
        await this.handlePrimePaidUpgrade(channel, username, methods, userstate);
      } catch (error) {
        logger.error('Error handling prime paid upgrade:', error.message);
      }
    });

    // Gift paid upgrade
    this.client.on('giftpaidupgrade', async (channel, username, sender, userstate) => {
      try {
        await this.handleGiftPaidUpgrade(channel, username, sender, userstate);
      } catch (error) {
        logger.error('Error handling gift paid upgrade:', error.message);
      }
    });

    // Bits/Cheer
    this.client.on('cheer', async (channel, userstate, message) => {
      try {
        await this.handleCheer(channel, userstate, message);
      } catch (error) {
        logger.error('Error handling cheer:', error.message);
      }
    });

    // Raid
    this.client.on('raided', async (channel, username, viewers, userstate) => {
      try {
        await this.handleRaid(channel, username, viewers, userstate);
      } catch (error) {
        logger.error('Error handling raid:', error.message);
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
    
    const lastMessageText = lastMessage?.message_text || null;
    
    const modAction = {
      channelId: channelRecord.id,
      moderatorId: null, // We don't always know the moderator
      targetUserId: targetUser.id,
      actionType: 'ban',
      reason: reason || null,
      timestamp: new Date(),
      lastMessage: lastMessageText
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
    
    const lastMessageText = lastMessage?.message_text || null;
    
    const modAction = {
      channelId: channelRecord.id,
      moderatorId: null,
      targetUserId: targetUser.id,
      actionType: 'timeout',
      durationSeconds: duration,
      reason: reason || null,
      timestamp: new Date(),
      lastMessage: lastMessageText
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

  // ==================== MONETIZATION HANDLERS ====================

  /**
   * Parse sub tier from methods object
   */
  parseSubTier(methods) {
    if (!methods) return '1000';
    if (methods.prime) return 'Prime';
    if (methods.plan === '2000') return '2000';
    if (methods.plan === '3000') return '3000';
    return methods.plan || '1000';
  }

  /**
   * Handle new subscription
   */
  async handleSubscription(channel, username, method, message, userstate) {
    const channelName = channel.replace('#', '');
    const channelRecord = await Channel.findOrCreate(channelName, userstate?.['room-id']);
    const userRecord = await User.findOrCreate(username, userstate?.['user-id'], userstate?.['display-name']);
    
    const tier = this.parseSubTier(method);
    const isPrime = method?.prime || false;
    
    await query(`
      INSERT INTO channel_subscriptions 
        (channel_id, user_id, sub_type, tier, is_prime, cumulative_months, message_text, timestamp, message_id, metadata)
      VALUES ($1, $2, 'sub', $3, $4, 1, $5, NOW(), $6, $7)
    `, [
      channelRecord.id,
      userRecord.id,
      tier,
      isPrime,
      message || null,
      userstate?.id || null,
      JSON.stringify({ method })
    ]);

    // Broadcast to WebSocket
    this.websocketService.broadcastToChannel(channelName, 'subscription', {
      type: 'sub',
      username,
      displayName: userRecord.display_name,
      tier,
      isPrime,
      message,
      channelName,
      timestamp: new Date().toISOString()
    });

    // Trigger webhooks
    discordWebhookService.sendSubscription({
      username,
      displayName: userRecord.display_name,
      channelName,
      subType: 'sub',
      tier,
      isPrime,
      cumulativeMonths: 1,
      streakMonths: null,
      message,
      timestamp: new Date().toISOString()
    });

    logger.info(`New sub in ${channelName}: ${username} (${isPrime ? 'Prime' : `Tier ${tier === '1000' ? '1' : tier === '2000' ? '2' : '3'}`})`);
  }

  /**
   * Handle resub
   */
  async handleResub(channel, username, months, message, userstate, methods) {
    const channelName = channel.replace('#', '');
    const channelRecord = await Channel.findOrCreate(channelName, userstate?.['room-id']);
    const userRecord = await User.findOrCreate(username, userstate?.['user-id'], userstate?.['display-name']);
    
    const tier = this.parseSubTier(methods);
    const isPrime = methods?.prime || false;
    const cumulativeMonths = userstate?.['msg-param-cumulative-months'] || months || 1;
    const streakMonths = userstate?.['msg-param-streak-months'] || null;
    
    await query(`
      INSERT INTO channel_subscriptions 
        (channel_id, user_id, sub_type, tier, is_prime, cumulative_months, streak_months, message_text, timestamp, message_id, metadata)
      VALUES ($1, $2, 'resub', $3, $4, $5, $6, $7, NOW(), $8, $9)
    `, [
      channelRecord.id,
      userRecord.id,
      tier,
      isPrime,
      cumulativeMonths,
      streakMonths,
      message || null,
      userstate?.id || null,
      JSON.stringify({ methods, months })
    ]);

    // Broadcast to WebSocket
    this.websocketService.broadcastToChannel(channelName, 'subscription', {
      type: 'resub',
      username,
      displayName: userRecord.display_name,
      tier,
      isPrime,
      cumulativeMonths,
      streakMonths,
      message,
      channelName,
      timestamp: new Date().toISOString()
    });

    // Trigger webhooks
    discordWebhookService.sendSubscription({
      username,
      displayName: userRecord.display_name,
      channelName,
      subType: 'resub',
      tier,
      isPrime,
      cumulativeMonths,
      streakMonths,
      message,
      timestamp: new Date().toISOString()
    });

    logger.info(`Resub in ${channelName}: ${username} (${cumulativeMonths} months)`);
  }

  /**
   * Handle gift subscription
   */
  async handleSubGift(channel, username, streakMonths, recipient, methods, userstate) {
    const channelName = channel.replace('#', '');
    const channelRecord = await Channel.findOrCreate(channelName, userstate?.['room-id']);
    const gifterRecord = await User.findOrCreate(username, userstate?.['user-id'], userstate?.['display-name']);
    const recipientRecord = await User.findOrCreate(recipient);
    
    const tier = this.parseSubTier(methods);
    
    await query(`
      INSERT INTO channel_subscriptions 
        (channel_id, user_id, sub_type, tier, gift_recipient_id, gift_count, timestamp, message_id, metadata)
      VALUES ($1, $2, 'subgift', $3, $4, 1, NOW(), $5, $6)
    `, [
      channelRecord.id,
      gifterRecord.id,
      tier,
      recipientRecord.id,
      userstate?.id || null,
      JSON.stringify({ streakMonths, methods })
    ]);

    // Broadcast to WebSocket
    this.websocketService.broadcastToChannel(channelName, 'subscription', {
      type: 'subgift',
      username,
      displayName: gifterRecord.display_name,
      recipient,
      tier,
      channelName,
      timestamp: new Date().toISOString()
    });

    // Trigger webhooks (single gift)
    discordWebhookService.sendGiftSub({
      username,
      displayName: gifterRecord.display_name,
      channelName,
      giftCount: 1,
      recipient,
      tier,
      isMysteryGift: false,
      timestamp: new Date().toISOString()
    });

    logger.info(`Gift sub in ${channelName}: ${username} gifted to ${recipient}`);
  }

  /**
   * Handle mystery gift (mass gift subs)
   */
  async handleMysteryGift(channel, username, numbOfSubs, methods, userstate) {
    const channelName = channel.replace('#', '');
    const channelRecord = await Channel.findOrCreate(channelName, userstate?.['room-id']);
    const gifterRecord = await User.findOrCreate(username, userstate?.['user-id'], userstate?.['display-name']);
    
    const tier = this.parseSubTier(methods);
    const giftCount = parseInt(numbOfSubs) || 1;
    
    await query(`
      INSERT INTO channel_subscriptions 
        (channel_id, user_id, sub_type, tier, gift_count, timestamp, message_id, metadata)
      VALUES ($1, $2, 'submysterygift', $3, $4, NOW(), $5, $6)
    `, [
      channelRecord.id,
      gifterRecord.id,
      tier,
      giftCount,
      userstate?.id || null,
      JSON.stringify({ methods, numbOfSubs })
    ]);

    // Broadcast to WebSocket
    this.websocketService.broadcastToChannel(channelName, 'subscription', {
      type: 'submysterygift',
      username,
      displayName: gifterRecord.display_name,
      giftCount,
      tier,
      channelName,
      timestamp: new Date().toISOString()
    });

    // Trigger webhooks (mystery/mass gift)
    discordWebhookService.sendGiftSub({
      username,
      displayName: gifterRecord.display_name,
      channelName,
      giftCount,
      recipient: null,
      tier,
      isMysteryGift: true,
      timestamp: new Date().toISOString()
    });

    logger.info(`Mystery gift in ${channelName}: ${username} gifted ${giftCount} subs!`);
  }

  /**
   * Handle prime paid upgrade
   */
  async handlePrimePaidUpgrade(channel, username, methods, userstate) {
    const channelName = channel.replace('#', '');
    const channelRecord = await Channel.findOrCreate(channelName, userstate?.['room-id']);
    const userRecord = await User.findOrCreate(username, userstate?.['user-id'], userstate?.['display-name']);
    
    const tier = this.parseSubTier(methods);
    
    await query(`
      INSERT INTO channel_subscriptions 
        (channel_id, user_id, sub_type, tier, timestamp, message_id, metadata)
      VALUES ($1, $2, 'primepaidupgrade', $3, NOW(), $4, $5)
    `, [
      channelRecord.id,
      userRecord.id,
      tier,
      userstate?.id || null,
      JSON.stringify({ methods })
    ]);

    // Broadcast to WebSocket
    this.websocketService.broadcastToChannel(channelName, 'subscription', {
      type: 'primepaidupgrade',
      username,
      displayName: userRecord.display_name,
      tier,
      channelName,
      timestamp: new Date().toISOString()
    });

    logger.info(`Prime upgrade in ${channelName}: ${username}`);
  }

  /**
   * Handle gift paid upgrade
   */
  async handleGiftPaidUpgrade(channel, username, sender, userstate) {
    const channelName = channel.replace('#', '');
    const channelRecord = await Channel.findOrCreate(channelName, userstate?.['room-id']);
    const userRecord = await User.findOrCreate(username, userstate?.['user-id'], userstate?.['display-name']);
    
    await query(`
      INSERT INTO channel_subscriptions 
        (channel_id, user_id, sub_type, tier, timestamp, message_id, metadata)
      VALUES ($1, $2, 'giftpaidupgrade', '1000', NOW(), $3, $4)
    `, [
      channelRecord.id,
      userRecord.id,
      userstate?.id || null,
      JSON.stringify({ sender })
    ]);

    // Broadcast to WebSocket
    this.websocketService.broadcastToChannel(channelName, 'subscription', {
      type: 'giftpaidupgrade',
      username,
      displayName: userRecord.display_name,
      sender,
      channelName,
      timestamp: new Date().toISOString()
    });

    logger.info(`Gift upgrade in ${channelName}: ${username} (from ${sender})`);
  }

  /**
   * Handle cheer/bits
   */
  async handleCheer(channel, userstate, message) {
    const channelName = channel.replace('#', '');
    const channelRecord = await Channel.findOrCreate(channelName, userstate?.['room-id']);
    const userRecord = await User.findOrCreate(
      userstate.username,
      userstate['user-id'],
      userstate['display-name']
    );
    
    const bitsAmount = parseInt(userstate.bits) || 0;
    
    if (bitsAmount > 0) {
      await query(`
        INSERT INTO channel_bits 
          (channel_id, user_id, bits_amount, message_text, timestamp, message_id, metadata)
        VALUES ($1, $2, $3, $4, NOW(), $5, $6)
      `, [
        channelRecord.id,
        userRecord.id,
        bitsAmount,
        message || null,
        userstate.id || null,
        JSON.stringify({ badges: userstate.badges })
      ]);

      // Broadcast to WebSocket
      this.websocketService.broadcastToChannel(channelName, 'bits', {
        username: userRecord.username,
        displayName: userRecord.display_name,
        amount: bitsAmount,
        message,
        channelName,
        timestamp: new Date().toISOString()
      });

      // Trigger webhooks
      discordWebhookService.sendBits({
        username: userRecord.username,
        displayName: userRecord.display_name,
        channelName,
        bitsAmount,
        message,
        timestamp: new Date().toISOString()
      });

      logger.info(`Bits in ${channelName}: ${userRecord.username} cheered ${bitsAmount} bits`);
    }
  }

  /**
   * Handle raid
   */
  async handleRaid(channel, username, viewers, userstate) {
    const channelName = channel.replace('#', '');
    const channelRecord = await Channel.findOrCreate(channelName, userstate?.['room-id']);
    
    // Try to find/create the raider's channel if they're being monitored
    let raiderChannelId = null;
    try {
      const raiderChannel = await Channel.getByName(username);
      raiderChannelId = raiderChannel?.id || null;
    } catch (e) {
      // Raider channel not in our system, that's fine
    }
    
    const viewerCount = parseInt(viewers) || 0;
    const displayName = userstate?.['msg-param-displayName'] || userstate?.['display-name'] || username;
    
    await query(`
      INSERT INTO channel_raids 
        (channel_id, raider_channel_id, raider_name, raider_display_name, viewer_count, timestamp, metadata)
      VALUES ($1, $2, $3, $4, $5, NOW(), $6)
    `, [
      channelRecord.id,
      raiderChannelId,
      username,
      displayName,
      viewerCount,
      JSON.stringify({ userstate })
    ]);

    // Broadcast to WebSocket
    this.websocketService.broadcastToChannel(channelName, 'raid', {
      raiderName: username,
      raiderDisplayName: displayName,
      viewerCount,
      channelName,
      timestamp: new Date().toISOString()
    });

    // Trigger webhooks
    discordWebhookService.sendRaid({
      raiderName: username,
      raiderDisplayName: displayName,
      channelName,
      viewerCount,
      timestamp: new Date().toISOString()
    });

    logger.info(`Raid in ${channelName}: ${username} with ${viewerCount} viewers`);
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
