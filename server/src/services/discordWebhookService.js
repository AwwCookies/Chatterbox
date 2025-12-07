import logger from '../utils/logger.js';
import Webhook from '../models/Webhook.js';

/**
 * Discord Webhook Service
 * Sends rich embeds to Discord webhooks
 */
class DiscordWebhookService {
  constructor() {
    this.rateLimitBuckets = new Map(); // Track rate limits per webhook
  }

  // ============================================
  // High-level trigger functions (called by services)
  // ============================================

  /**
   * Trigger tracked user message webhooks
   */
  async sendTrackedUserMessage(data) {
    try {
      const { username, displayName, message, channelName, timestamp } = data;
      const webhooks = await Webhook.getMatchingTrackedUserWebhooks(username);
      
      for (const webhook of webhooks) {
        const result = await this._sendTrackedUserMessageEmbed(webhook, {
          username,
          display_name: displayName,
          message_text: message,
        }, channelName);
        
        // Update webhook stats
        if (result.success) {
          await Webhook.updateUserWebhookSuccess(webhook.id);
        } else {
          await Webhook.updateUserWebhookFailure(webhook.id);
        }
      }
    } catch (error) {
      logger.debug('Error triggering tracked user webhooks:', error.message);
    }
  }

  /**
   * Trigger mod action webhooks
   */
  async sendModAction(data) {
    try {
      const { actionType, targetUsername, targetDisplayName, channelName, reason, duration, moderatorName, lastMessage, timestamp } = data;
      const webhooks = await Webhook.getMatchingModActionWebhooks(actionType, channelName);
      
      for (const webhook of webhooks) {
        const result = await this._sendModActionEmbed(webhook, {
          action_type: actionType,
          target_username: targetUsername,
          target_display_name: targetDisplayName,
          channel_name: channelName,
          reason,
          duration_seconds: duration,
          moderator_username: moderatorName,
          last_message: lastMessage,
        });
        
        if (result.success) {
          await Webhook.updateUserWebhookSuccess(webhook.id);
        } else {
          await Webhook.updateUserWebhookFailure(webhook.id);
        }
      }
    } catch (error) {
      logger.debug('Error triggering mod action webhooks:', error.message);
    }
  }

  /**
   * Trigger channel live webhooks
   */
  async sendChannelLive(data) {
    try {
      const { channelName, displayName, title, gameName, viewerCount, profileImageUrl, timestamp } = data;
      const webhooks = await Webhook.getMatchingChannelWebhooks('channel_live', channelName);
      
      for (const webhook of webhooks) {
        const result = await this._sendChannelLiveEmbed(webhook, {
          name: channelName,
          display_name: displayName,
          profile_image_url: profileImageUrl,
        }, {
          title,
          game_name: gameName,
          viewer_count: viewerCount,
          started_at: timestamp,
        });
        
        if (result.success) {
          await Webhook.updateUserWebhookSuccess(webhook.id);
        } else {
          await Webhook.updateUserWebhookFailure(webhook.id);
        }
      }
    } catch (error) {
      logger.debug('Error triggering channel live webhooks:', error.message);
    }
  }

  /**
   * Trigger channel offline webhooks
   */
  async sendChannelOffline(data) {
    try {
      const { channelName, displayName, profileImageUrl, timestamp } = data;
      const webhooks = await Webhook.getMatchingChannelWebhooks('channel_offline', channelName);
      
      for (const webhook of webhooks) {
        const result = await this._sendChannelOfflineEmbed(webhook, {
          name: channelName,
          display_name: displayName,
          profile_image_url: profileImageUrl,
        });
        
        if (result.success) {
          await Webhook.updateUserWebhookSuccess(webhook.id);
        } else {
          await Webhook.updateUserWebhookFailure(webhook.id);
        }
      }
    } catch (error) {
      logger.debug('Error triggering channel offline webhooks:', error.message);
    }
  }

  /**
   * Trigger game change webhooks
   */
  async sendGameChange(data) {
    try {
      const { channelName, displayName, previousGame, newGame, profileImageUrl, timestamp } = data;
      const webhooks = await Webhook.getMatchingChannelWebhooks('channel_game_change', channelName);
      
      for (const webhook of webhooks) {
        const result = await this._sendGameChangeEmbed(webhook, {
          name: channelName,
          display_name: displayName,
          profile_image_url: profileImageUrl,
        }, previousGame, newGame);
        
        if (result.success) {
          await Webhook.updateUserWebhookSuccess(webhook.id);
        } else {
          await Webhook.updateUserWebhookFailure(webhook.id);
        }
      }
    } catch (error) {
      logger.debug('Error triggering game change webhooks:', error.message);
    }
  }

  /**
   * Trigger bits/cheer webhooks
   */
  async sendBits(data) {
    try {
      const { username, displayName, channelName, bitsAmount, message, timestamp } = data;
      const webhooks = await Webhook.getMatchingBitsWebhooks(channelName, bitsAmount);
      
      for (const webhook of webhooks) {
        const result = await this._sendBitsEmbed(webhook, {
          username,
          displayName,
          channelName,
          bitsAmount,
          message,
          timestamp,
        });
        
        if (result.success) {
          await Webhook.updateUserWebhookSuccess(webhook.id);
        } else {
          await Webhook.updateUserWebhookFailure(webhook.id);
        }
      }
    } catch (error) {
      logger.debug('Error triggering bits webhooks:', error.message);
    }
  }

  /**
   * Trigger subscription webhooks (new sub, resub)
   */
  async sendSubscription(data) {
    try {
      const { username, displayName, channelName, subType, tier, isPrime, cumulativeMonths, streakMonths, message, timestamp } = data;
      const webhooks = await Webhook.getMatchingSubscriptionWebhooks(channelName, subType, cumulativeMonths || 0);
      
      for (const webhook of webhooks) {
        const result = await this._sendSubscriptionEmbed(webhook, {
          username,
          displayName,
          channelName,
          subType,
          tier,
          isPrime,
          cumulativeMonths,
          streakMonths,
          message,
          timestamp,
        });
        
        if (result.success) {
          await Webhook.updateUserWebhookSuccess(webhook.id);
        } else {
          await Webhook.updateUserWebhookFailure(webhook.id);
        }
      }
    } catch (error) {
      logger.debug('Error triggering subscription webhooks:', error.message);
    }
  }

  /**
   * Trigger gift sub webhooks (single gift, mystery/mass gift)
   */
  async sendGiftSub(data) {
    try {
      const { username, displayName, channelName, giftCount, recipient, tier, isMysteryGift, timestamp } = data;
      const webhooks = await Webhook.getMatchingGiftSubWebhooks(channelName, giftCount);
      
      for (const webhook of webhooks) {
        const result = await this._sendGiftSubEmbed(webhook, {
          username,
          displayName,
          channelName,
          giftCount,
          recipient,
          tier,
          isMysteryGift,
          timestamp,
        });
        
        if (result.success) {
          await Webhook.updateUserWebhookSuccess(webhook.id);
        } else {
          await Webhook.updateUserWebhookFailure(webhook.id);
        }
      }
    } catch (error) {
      logger.debug('Error triggering gift sub webhooks:', error.message);
    }
  }

  /**
   * Trigger raid webhooks
   */
  async sendRaid(data) {
    try {
      const { raiderName, raiderDisplayName, channelName, viewerCount, timestamp } = data;
      const webhooks = await Webhook.getMatchingRaidWebhooks(channelName, viewerCount);
      
      for (const webhook of webhooks) {
        const result = await this._sendRaidEmbed(webhook, {
          raiderName,
          raiderDisplayName,
          channelName,
          viewerCount,
          timestamp,
        });
        
        if (result.success) {
          await Webhook.updateUserWebhookSuccess(webhook.id);
        } else {
          await Webhook.updateUserWebhookFailure(webhook.id);
        }
      }
    } catch (error) {
      logger.debug('Error triggering raid webhooks:', error.message);
    }
  }

  /**
   * Trigger user signup webhooks (admin)
   */
  async sendUserSignup(data) {
    try {
      const { username, displayName, twitchId, profileImageUrl, email, timestamp } = data;
      const webhooks = await Webhook.getAdminWebhooksByType('user_signup');
      
      for (const webhook of webhooks) {
        const result = await this._sendUserSignupEmbed(webhook, {
          username,
          display_name: displayName,
          twitch_id: twitchId,
          profile_image_url: profileImageUrl,
          email,
        });
        
        if (result.success) {
          await Webhook.updateAdminWebhookSuccess(webhook.id);
        } else {
          await Webhook.updateAdminWebhookFailure(webhook.id);
        }
      }
    } catch (error) {
      logger.debug('Error triggering user signup webhooks:', error.message);
    }
  }

  /**
   * Trigger data request webhooks (admin)
   */
  async sendDataRequest(data) {
    try {
      const { username, displayName, requestType, reason, timestamp } = data;
      const webhooks = await Webhook.getAdminWebhooksByType('data_request');
      
      for (const webhook of webhooks) {
        const result = await this._sendDataRequestEmbed(webhook, {
          request_type: requestType,
          reason,
        }, {
          username,
          display_name: displayName,
        });
        
        if (result.success) {
          await Webhook.updateAdminWebhookSuccess(webhook.id);
        } else {
          await Webhook.updateAdminWebhookFailure(webhook.id);
        }
      }
    } catch (error) {
      logger.debug('Error triggering data request webhooks:', error.message);
    }
  }

  /**
   * Send a test webhook (called directly from routes)
   */
  async sendTest(webhook, isAdmin = false) {
    const color = webhook.embed_color || '#5865F2';

    const embed = this.buildEmbed({
      title: '✅ Webhook Test Successful',
      description: 'Your webhook is configured correctly and receiving messages.',
      color,
      fields: [
        { name: 'Webhook Name', value: webhook.name, inline: true },
        { name: 'Event Type', value: webhook.event_type, inline: true },
      ],
      footer: { text: isAdmin ? 'Chatterbox Admin' : 'Chatterbox' },
      timestamp: new Date(),
    });

    const payload = {
      username: webhook.custom_username || (isAdmin ? 'Chatterbox Admin' : 'Chatterbox'),
      avatar_url: webhook.custom_avatar_url || undefined,
      embeds: [embed],
    };

    return this.send(webhook.webhook_url, payload);
  }

  // ============================================
  // Low-level embed building functions (internal)
  // ============================================

  /**
   * Send a webhook with retry logic
   */
  async send(webhookUrl, payload, options = {}) {
    const { maxRetries = 2, retryDelay = 1000 } = options;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Check rate limit
        const bucket = this.rateLimitBuckets.get(webhookUrl);
        if (bucket && bucket.resetAt > Date.now()) {
          const waitTime = bucket.resetAt - Date.now();
          if (waitTime > 0 && waitTime < 10000) {
            await this.sleep(waitTime);
          }
        }

        const startTime = Date.now();
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const deliveryTime = Date.now() - startTime;

        // Handle rate limiting
        const remaining = response.headers.get('x-ratelimit-remaining');
        const resetAfter = response.headers.get('x-ratelimit-reset-after');
        
        if (remaining !== null && resetAfter !== null) {
          this.rateLimitBuckets.set(webhookUrl, {
            remaining: parseInt(remaining),
            resetAt: Date.now() + (parseFloat(resetAfter) * 1000),
          });
        }

        if (response.status === 429) {
          // Rate limited
          const retryAfter = response.headers.get('retry-after') || '5';
          await this.sleep(parseFloat(retryAfter) * 1000);
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Discord webhook failed: ${response.status} - ${errorBody}`);
        }

        return { success: true, status: response.status, deliveryTime };
      } catch (error) {
        if (attempt === maxRetries) {
          logger.error('Discord webhook failed after retries:', error.message);
          return { success: false, error: error.message };
        }
        await this.sleep(retryDelay * (attempt + 1));
      }
    }

    return { success: false, error: 'Max retries exceeded' };
  }

  /**
   * Build a Discord embed
   */
  buildEmbed(options) {
    const {
      title,
      description,
      color,
      url,
      author,
      thumbnail,
      fields = [],
      footer,
      timestamp,
      image,
    } = options;

    const embed = {};

    if (title) embed.title = title.slice(0, 256);
    if (description) embed.description = description.slice(0, 4096);
    if (color) embed.color = this.parseColor(color);
    if (url) embed.url = url;
    if (author) {
      embed.author = {
        name: author.name?.slice(0, 256),
        url: author.url,
        icon_url: author.iconUrl,
      };
    }
    if (thumbnail) embed.thumbnail = { url: thumbnail };
    if (fields.length > 0) {
      embed.fields = fields.slice(0, 25).map(f => ({
        name: f.name?.slice(0, 256) || 'Field',
        value: f.value?.slice(0, 1024) || '-',
        inline: f.inline ?? false,
      }));
    }
    if (footer) {
      embed.footer = {
        text: footer.text?.slice(0, 2048),
        icon_url: footer.iconUrl,
      };
    }
    if (timestamp) embed.timestamp = timestamp instanceof Date ? timestamp.toISOString() : timestamp;
    if (image) embed.image = { url: image };

    return embed;
  }

  /**
   * Parse color to Discord integer format
   */
  parseColor(color) {
    if (typeof color === 'number') return color;
    if (typeof color === 'string') {
      // Remove # if present
      const hex = color.replace('#', '');
      return parseInt(hex, 16);
    }
    return 0x5865F2; // Discord blurple default
  }

  /**
   * Send tracked user message notification (internal)
   */
  async _sendTrackedUserMessageEmbed(webhook, message, channel) {
    const color = webhook.embed_color || '#00FF00';
    
    const embed = this.buildEmbed({
      title: `📨 Message from tracked user`,
      description: message.message_text?.slice(0, 2000) || 'No message content',
      color,
      author: {
        name: message.display_name || message.username,
        iconUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(message.username)}&background=9147ff&color=fff`,
      },
      fields: [
        { name: 'Channel', value: `#${channel}`, inline: true },
        { name: 'User', value: message.username, inline: true },
      ],
      footer: { text: 'Chatterbox • Tracked User Alert' },
      timestamp: webhook.include_timestamp ? new Date() : undefined,
    });

    const payload = {
      username: webhook.custom_username || 'Chatterbox',
      avatar_url: webhook.custom_avatar_url || undefined,
      embeds: [embed],
    };

    return this.send(webhook.webhook_url, payload);
  }

  /**
   * Send mod action notification (internal)
   */
  async _sendModActionEmbed(webhook, action) {
    const actionColors = {
      ban: '#ED4245',
      timeout: '#FEE75C',
      delete: '#F97316',
      unban: '#57F287',
      untimeout: '#57F287',
    };
    
    const actionEmojis = {
      ban: '🔨',
      timeout: '⏰',
      delete: '🗑️',
      unban: '✅',
      untimeout: '✅',
    };

    const color = webhook.embed_color || actionColors[action.action_type] || '#5865F2';
    const emoji = actionEmojis[action.action_type] || '⚡';

    const fields = [
      { name: 'Channel', value: `#${action.channel_name || action.channelName}`, inline: true },
      { name: 'Target', value: action.target_username || action.targetUsername, inline: true },
    ];

    if (action.moderator_username || action.moderatorUsername) {
      fields.push({ name: 'Moderator', value: action.moderator_username || action.moderatorUsername, inline: true });
    }

    if (action.duration_seconds || action.durationSeconds) {
      const duration = action.duration_seconds || action.durationSeconds;
      fields.push({ name: 'Duration', value: this.formatDuration(duration), inline: true });
    }

    if (action.reason) {
      fields.push({ name: 'Reason', value: action.reason.slice(0, 1024), inline: false });
    }

    if (action.last_message || action.message_text) {
      fields.push({ 
        name: 'Last Message', 
        value: `"${(action.last_message || action.message_text).slice(0, 500)}"`, 
        inline: false 
      });
    }

    const embed = this.buildEmbed({
      title: `${emoji} ${action.action_type?.charAt(0).toUpperCase()}${action.action_type?.slice(1) || 'Mod Action'}`,
      color,
      fields,
      footer: { text: 'Chatterbox • Moderation Alert' },
      timestamp: webhook.include_timestamp ? new Date() : undefined,
    });

    const payload = {
      username: webhook.custom_username || 'Chatterbox Mod',
      avatar_url: webhook.custom_avatar_url || undefined,
      embeds: [embed],
    };

    return this.send(webhook.webhook_url, payload);
  }

  /**
   * Send channel live notification (internal)
   */
  async _sendChannelLiveEmbed(webhook, channel, streamData) {
    const color = webhook.embed_color || '#9147FF';

    const fields = [
      { name: 'Game', value: streamData.game_name || 'Unknown', inline: true },
      { name: 'Viewers', value: streamData.viewer_count?.toString() || '0', inline: true },
    ];

    if (streamData.started_at) {
      fields.push({ name: 'Started', value: `<t:${Math.floor(new Date(streamData.started_at).getTime() / 1000)}:R>`, inline: true });
    }

    const embed = this.buildEmbed({
      title: `🔴 ${channel.display_name || channel.name} is now LIVE!`,
      description: streamData.title || 'No title',
      url: `https://twitch.tv/${channel.name}`,
      color,
      thumbnail: channel.profile_image_url || streamData.thumbnail_url?.replace('{width}', '320').replace('{height}', '180'),
      fields,
      footer: { text: 'Chatterbox • Stream Alert' },
      timestamp: webhook.include_timestamp ? new Date() : undefined,
    });

    const payload = {
      username: webhook.custom_username || 'Chatterbox',
      avatar_url: webhook.custom_avatar_url || undefined,
      embeds: [embed],
    };

    return this.send(webhook.webhook_url, payload);
  }

  /**
   * Send channel offline notification (internal)
   */
  async _sendChannelOfflineEmbed(webhook, channel) {
    const color = webhook.embed_color || '#747F8D';

    const embed = this.buildEmbed({
      title: `⚫ ${channel.display_name || channel.name} went offline`,
      url: `https://twitch.tv/${channel.name}`,
      color,
      thumbnail: channel.profile_image_url,
      footer: { text: 'Chatterbox • Stream Alert' },
      timestamp: webhook.include_timestamp ? new Date() : undefined,
    });

    const payload = {
      username: webhook.custom_username || 'Chatterbox',
      avatar_url: webhook.custom_avatar_url || undefined,
      embeds: [embed],
    };

    return this.send(webhook.webhook_url, payload);
  }

  /**
   * Send game change notification (internal)
   */
  async _sendGameChangeEmbed(webhook, channel, oldGame, newGame) {
    const color = webhook.embed_color || '#5865F2';

    const embed = this.buildEmbed({
      title: `🎮 ${channel.display_name || channel.name} changed game`,
      url: `https://twitch.tv/${channel.name}`,
      color,
      thumbnail: channel.profile_image_url,
      fields: [
        { name: 'From', value: oldGame || 'Unknown', inline: true },
        { name: 'To', value: newGame || 'Unknown', inline: true },
      ],
      footer: { text: 'Chatterbox • Stream Alert' },
      timestamp: webhook.include_timestamp ? new Date() : undefined,
    });

    const payload = {
      username: webhook.custom_username || 'Chatterbox',
      avatar_url: webhook.custom_avatar_url || undefined,
      embeds: [embed],
    };

    return this.send(webhook.webhook_url, payload);
  }

  /**
   * Send user signup notification (admin, internal)
   */
  async _sendUserSignupEmbed(webhook, user) {
    const color = webhook.embed_color || '#57F287';

    const embed = this.buildEmbed({
      title: '👤 New User Signup',
      color,
      thumbnail: user.profile_image_url,
      fields: [
        { name: 'Username', value: user.username, inline: true },
        { name: 'Display Name', value: user.display_name || user.username, inline: true },
        { name: 'Twitch ID', value: user.twitch_id, inline: true },
      ],
      footer: { text: 'Chatterbox Admin • User Event' },
      timestamp: new Date(),
    });

    const payload = {
      username: webhook.custom_username || 'Chatterbox Admin',
      avatar_url: webhook.custom_avatar_url || undefined,
      embeds: [embed],
    };

    return this.send(webhook.webhook_url, payload);
  }

  /**
   * Send data request notification (admin, internal)
   */
  async _sendDataRequestEmbed(webhook, request, user) {
    const color = request.request_type === 'delete' ? '#ED4245' : '#FEE75C';
    const emoji = request.request_type === 'delete' ? '🗑️' : '📦';

    const embed = this.buildEmbed({
      title: `${emoji} New ${request.request_type.charAt(0).toUpperCase()}${request.request_type.slice(1)} Request`,
      color,
      thumbnail: user?.profile_image_url,
      fields: [
        { name: 'User', value: user?.username || 'Unknown', inline: true },
        { name: 'Type', value: request.request_type.toUpperCase(), inline: true },
        { name: 'Reason', value: request.reason || 'No reason provided', inline: false },
      ],
      footer: { text: 'Chatterbox Admin • Action Required' },
      timestamp: new Date(),
    });

    const payload = {
      username: webhook.custom_username || 'Chatterbox Admin',
      avatar_url: webhook.custom_avatar_url || undefined,
      embeds: [embed],
    };

    return this.send(webhook.webhook_url, payload);
  }

  /**
   * Send system event notification (admin, internal)
   */
  async _sendSystemEventEmbed(webhook, event) {
    const color = webhook.embed_color || '#5865F2';

    const embed = this.buildEmbed({
      title: `⚙️ ${event.title || 'System Event'}`,
      description: event.description,
      color,
      fields: event.fields || [],
      footer: { text: 'Chatterbox Admin • System Event' },
      timestamp: new Date(),
    });

    const payload = {
      username: webhook.custom_username || 'Chatterbox Admin',
      avatar_url: webhook.custom_avatar_url || undefined,
      embeds: [embed],
    };

    return this.send(webhook.webhook_url, payload);
  }

  /**
   * Format duration in seconds to human readable
   */
  formatDuration(seconds) {
    if (!seconds) return 'Permanent';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  }

  /**
   * Format bits to display with appropriate emoji
   */
  formatBits(amount) {
    if (amount >= 10000) return `💎 ${amount.toLocaleString()}`;
    if (amount >= 5000) return `💠 ${amount.toLocaleString()}`;
    if (amount >= 1000) return `🔷 ${amount.toLocaleString()}`;
    if (amount >= 100) return `🔹 ${amount.toLocaleString()}`;
    return `▫️ ${amount.toLocaleString()}`;
  }

  /**
   * Get tier display name
   */
  getTierName(tier) {
    if (tier === '3000') return 'Tier 3';
    if (tier === '2000') return 'Tier 2';
    return 'Tier 1';
  }

  /**
   * Send bits notification (internal)
   */
  async _sendBitsEmbed(webhook, data) {
    const color = webhook.embed_color || '#9147FF';
    const { username, displayName, channelName, bitsAmount, message } = data;

    const fields = [
      { name: 'Channel', value: `#${channelName}`, inline: true },
      { name: 'Bits', value: this.formatBits(bitsAmount), inline: true },
      { name: 'Value', value: `~$${(bitsAmount * 0.01).toFixed(2)}`, inline: true },
    ];

    if (message) {
      fields.push({ name: 'Message', value: message.slice(0, 1024), inline: false });
    }

    const embed = this.buildEmbed({
      title: `💎 ${displayName || username} cheered!`,
      description: `**${bitsAmount.toLocaleString()}** bits in **${channelName}**`,
      color,
      fields,
      footer: { text: 'Chatterbox • Bits Alert' },
      timestamp: webhook.include_timestamp ? new Date() : undefined,
    });

    const payload = {
      username: webhook.custom_username || 'Chatterbox',
      avatar_url: webhook.custom_avatar_url || undefined,
      embeds: [embed],
    };

    return this.send(webhook.webhook_url, payload);
  }

  /**
   * Send subscription notification (internal)
   */
  async _sendSubscriptionEmbed(webhook, data) {
    const { username, displayName, channelName, subType, tier, isPrime, cumulativeMonths, streakMonths, message } = data;
    
    const isResub = subType === 'resub';
    const color = webhook.embed_color || (isPrime ? '#0078D7' : '#9147FF');
    
    let title = isPrime ? '👑 Prime Sub' : '⭐ New Subscriber';
    let emoji = '⭐';
    
    if (isResub) {
      title = isPrime ? `👑 Prime Resub` : `🔄 Resub`;
      emoji = '🔄';
    }

    const fields = [
      { name: 'Channel', value: `#${channelName}`, inline: true },
      { name: 'Tier', value: isPrime ? 'Prime' : this.getTierName(tier), inline: true },
    ];

    if (cumulativeMonths > 1) {
      fields.push({ name: 'Months', value: `${cumulativeMonths} cumulative`, inline: true });
    }

    if (streakMonths > 1) {
      fields.push({ name: 'Streak', value: `${streakMonths} months`, inline: true });
    }

    if (message) {
      fields.push({ name: 'Message', value: message.slice(0, 1024), inline: false });
    }

    const embed = this.buildEmbed({
      title: `${emoji} ${displayName || username} ${isResub ? 'resubscribed' : 'subscribed'}!`,
      description: isResub 
        ? `**${cumulativeMonths}** months in **${channelName}**`
        : `New subscriber in **${channelName}**`,
      color,
      fields,
      footer: { text: 'Chatterbox • Subscription Alert' },
      timestamp: webhook.include_timestamp ? new Date() : undefined,
    });

    const payload = {
      username: webhook.custom_username || 'Chatterbox',
      avatar_url: webhook.custom_avatar_url || undefined,
      embeds: [embed],
    };

    return this.send(webhook.webhook_url, payload);
  }

  /**
   * Send gift sub notification (internal)
   */
  async _sendGiftSubEmbed(webhook, data) {
    const { username, displayName, channelName, giftCount, recipient, tier, isMysteryGift } = data;
    const color = webhook.embed_color || '#FF69B4';

    const fields = [
      { name: 'Channel', value: `#${channelName}`, inline: true },
      { name: 'Tier', value: this.getTierName(tier), inline: true },
      { name: 'Quantity', value: giftCount.toString(), inline: true },
    ];

    if (recipient && !isMysteryGift) {
      fields.push({ name: 'Recipient', value: recipient, inline: true });
    }

    const isMultiple = giftCount > 1;
    const emoji = isMultiple ? '🎁' : '🎀';
    const title = isMysteryGift 
      ? `${emoji} ${displayName || username} gifted ${giftCount} sub${isMultiple ? 's' : ''}!`
      : `${emoji} ${displayName || username} gifted a sub to ${recipient}!`;

    const embed = this.buildEmbed({
      title,
      description: isMysteryGift 
        ? `**${giftCount}** mystery gift${isMultiple ? 's' : ''} in **${channelName}**!`
        : `Gift subscription in **${channelName}**`,
      color,
      fields,
      footer: { text: 'Chatterbox • Gift Sub Alert' },
      timestamp: webhook.include_timestamp ? new Date() : undefined,
    });

    const payload = {
      username: webhook.custom_username || 'Chatterbox',
      avatar_url: webhook.custom_avatar_url || undefined,
      embeds: [embed],
    };

    return this.send(webhook.webhook_url, payload);
  }

  /**
   * Send raid notification (internal)
   */
  async _sendRaidEmbed(webhook, data) {
    const { raiderName, raiderDisplayName, channelName, viewerCount } = data;
    const color = webhook.embed_color || '#FF4500';

    const fields = [
      { name: 'Target Channel', value: `#${channelName}`, inline: true },
      { name: 'Viewers', value: viewerCount.toLocaleString(), inline: true },
    ];

    const embed = this.buildEmbed({
      title: `🚀 Raid from ${raiderDisplayName || raiderName}!`,
      description: `**${viewerCount.toLocaleString()}** viewers raided **${channelName}**`,
      url: `https://twitch.tv/${raiderName}`,
      color,
      fields,
      footer: { text: 'Chatterbox • Raid Alert' },
      timestamp: webhook.include_timestamp ? new Date() : undefined,
    });

    const payload = {
      username: webhook.custom_username || 'Chatterbox',
      avatar_url: webhook.custom_avatar_url || undefined,
      embeds: [embed],
    };

    return this.send(webhook.webhook_url, payload);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export a singleton instance
const discordWebhookService = new DiscordWebhookService();
export default discordWebhookService;
