import { query } from '../config/database.js';
import logger from '../utils/logger.js';

class Webhook {
  /**
   * Create a user webhook
   */
  static async createUserWebhook(data) {
    const {
      oauthUserId,
      name,
      webhookUrl,
      webhookType,
      config = {},
      embedColor = '#5865F2',
      customUsername,
      customAvatarUrl,
      includeTimestamp = true,
      folder = null,
    } = data;

    const result = await query(
      `INSERT INTO user_webhooks 
       (oauth_user_id, name, webhook_url, webhook_type, config, embed_color, custom_username, custom_avatar_url, include_timestamp, folder)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [oauthUserId, name, webhookUrl, webhookType, JSON.stringify(config), embedColor, customUsername, customAvatarUrl, includeTimestamp, folder]
    );

    return result.rows[0];
  }

  /**
   * Create a user webhook with Discord OAuth metadata
   */
  static async createUserWebhookWithDiscord(data) {
    const {
      oauthUserId,
      name,
      webhookUrl,
      webhookType,
      config = {},
      embedColor = '#5865F2',
      customUsername,
      customAvatarUrl,
      includeTimestamp = true,
      discordGuildId,
      discordGuildName,
      discordChannelId,
      discordChannelName,
      discordWebhookId,
      createdViaOauth = true,
      folder = null,
    } = data;

    const result = await query(
      `INSERT INTO user_webhooks 
       (oauth_user_id, name, webhook_url, webhook_type, config, embed_color, custom_username, custom_avatar_url, include_timestamp,
        discord_guild_id, discord_guild_name, discord_channel_id, discord_channel_name, discord_webhook_id, created_via_oauth, folder)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [oauthUserId, name, webhookUrl, webhookType, JSON.stringify(config), embedColor, customUsername, customAvatarUrl, includeTimestamp,
       discordGuildId, discordGuildName, discordChannelId, discordChannelName, discordWebhookId, createdViaOauth, folder]
    );

    return result.rows[0];
  }

  /**
   * Get Discord webhook info for deletion
   */
  static async getDiscordWebhookInfo(id, oauthUserId) {
    const result = await query(
      `SELECT id, webhook_url, discord_webhook_id, created_via_oauth 
       FROM user_webhooks WHERE id = $1 AND oauth_user_id = $2`,
      [id, oauthUserId]
    );
    return result.rows[0];
  }

  /**
   * Get all webhooks for a user
   */
  static async getUserWebhooks(oauthUserId) {
    const result = await query(
      `SELECT * FROM user_webhooks 
       WHERE oauth_user_id = $1 
       ORDER BY created_at DESC`,
      [oauthUserId]
    );
    return result.rows;
  }

  /**
   * Get a user webhook by ID
   */
  static async getUserWebhookById(id, oauthUserId) {
    const result = await query(
      `SELECT * FROM user_webhooks WHERE id = $1 AND oauth_user_id = $2`,
      [id, oauthUserId]
    );
    return result.rows[0];
  }

  /**
   * Update a user webhook
   */
  static async updateUserWebhook(id, oauthUserId, updates) {
    const allowedFields = ['name', 'webhook_url', 'config', 'embed_color', 'custom_username', 'custom_avatar_url', 'include_timestamp', 'enabled', 'muted', 'folder'];
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase(); // camelCase to snake_case
      if (allowedFields.includes(dbKey)) {
        setClauses.push(`${dbKey} = $${paramIndex}`);
        values.push(dbKey === 'config' ? JSON.stringify(value) : value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) return null;

    setClauses.push(`updated_at = NOW()`);
    values.push(id, oauthUserId);

    const result = await query(
      `UPDATE user_webhooks SET ${setClauses.join(', ')} 
       WHERE id = $${paramIndex} AND oauth_user_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  /**
   * Reset trigger count for a user webhook
   */
  static async resetTriggerCount(id, oauthUserId) {
    const result = await query(
      `UPDATE user_webhooks SET trigger_count = 0, updated_at = NOW()
       WHERE id = $1 AND oauth_user_id = $2
       RETURNING *`,
      [id, oauthUserId]
    );
    return result.rows[0];
  }

  /**
   * Get unique folders for a user
   */
  static async getUserFolders(oauthUserId) {
    const result = await query(
      `SELECT DISTINCT folder FROM user_webhooks 
       WHERE oauth_user_id = $1 AND folder IS NOT NULL
       ORDER BY folder`,
      [oauthUserId]
    );
    return result.rows.map(r => r.folder);
  }

  /**
   * Duplicate a user webhook
   */
  static async duplicateUserWebhook(id, oauthUserId, newName) {
    const original = await this.getUserWebhookById(id, oauthUserId);
    if (!original) return null;

    const result = await query(
      `INSERT INTO user_webhooks 
       (oauth_user_id, name, webhook_url, webhook_type, config, embed_color, custom_username, custom_avatar_url, include_timestamp, folder)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        oauthUserId,
        newName || `${original.name} (copy)`,
        original.webhook_url,
        original.webhook_type,
        JSON.stringify(original.config),
        original.embed_color,
        original.custom_username,
        original.custom_avatar_url,
        original.include_timestamp,
        original.folder,
      ]
    );

    return result.rows[0];
  }

  /**
   * Delete a user webhook
   */
  static async deleteUserWebhook(id, oauthUserId) {
    const result = await query(
      `DELETE FROM user_webhooks WHERE id = $1 AND oauth_user_id = $2 RETURNING id`,
      [id, oauthUserId]
    );
    return result.rows[0];
  }

  /**
   * Get enabled webhooks by type (excludes muted webhooks)
   */
  static async getEnabledWebhooksByType(webhookType) {
    const result = await query(
      `SELECT w.*, u.username as owner_username 
       FROM user_webhooks w
       JOIN oauth_users u ON w.oauth_user_id = u.id
       WHERE w.webhook_type = $1 AND w.enabled = TRUE AND w.muted = FALSE AND w.consecutive_failures < 5`,
      [webhookType]
    );
    return result.rows;
  }

  /**
   * Record webhook trigger (success or failure)
   */
  static async recordTrigger(id, success, error = null, isAdmin = false) {
    const table = isAdmin ? 'admin_webhooks' : 'user_webhooks';
    
    if (success) {
      await query(
        `UPDATE ${table} SET 
         last_triggered_at = NOW(), 
         trigger_count = trigger_count + 1,
         consecutive_failures = 0,
         last_error = NULL,
         updated_at = NOW()
         WHERE id = $1`,
        [id]
      );
    } else {
      await query(
        `UPDATE ${table} SET 
         consecutive_failures = consecutive_failures + 1,
         last_error = $2,
         updated_at = NOW()
         WHERE id = $1`,
        [id, error]
      );
    }
  }

  /**
   * Log webhook delivery
   */
  static async logDelivery(webhookId, webhookTable, eventType, payload, result) {
    try {
      await query(
        `INSERT INTO webhook_logs 
         (webhook_id, webhook_table, event_type, payload, response_status, success, error_message, delivery_time_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          webhookId,
          webhookTable,
          eventType,
          JSON.stringify(payload),
          result.status || null,
          result.success,
          result.error || null,
          result.deliveryTime || null
        ]
      );
    } catch (error) {
      logger.error('Failed to log webhook delivery:', error.message);
    }
  }

  // ============ Admin Webhooks ============

  /**
   * Create an admin webhook
   */
  static async createAdminWebhook(data) {
    const {
      name,
      webhookUrl,
      webhookType,
      config = {},
      embedColor = '#ED4245',
      customUsername = 'Chatterbox Admin',
      customAvatarUrl,
      createdBy,
    } = data;

    const result = await query(
      `INSERT INTO admin_webhooks 
       (name, webhook_url, webhook_type, config, embed_color, custom_username, custom_avatar_url, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [name, webhookUrl, webhookType, JSON.stringify(config), embedColor, customUsername, customAvatarUrl, createdBy]
    );

    return result.rows[0];
  }

  /**
   * Get all admin webhooks
   */
  static async getAdminWebhooks() {
    const result = await query(
      `SELECT w.*, u.username as created_by_username 
       FROM admin_webhooks w
       LEFT JOIN oauth_users u ON w.created_by = u.id
       ORDER BY w.created_at DESC`
    );
    return result.rows;
  }

  /**
   * Get admin webhook by ID
   */
  static async getAdminWebhookById(id) {
    const result = await query(
      `SELECT * FROM admin_webhooks WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  }

  /**
   * Update admin webhook
   */
  static async updateAdminWebhook(id, updates) {
    const allowedFields = ['name', 'webhook_url', 'config', 'embed_color', 'custom_username', 'custom_avatar_url', 'enabled'];
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(dbKey)) {
        setClauses.push(`${dbKey} = $${paramIndex}`);
        values.push(dbKey === 'config' ? JSON.stringify(value) : value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) return null;

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE admin_webhooks SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows[0];
  }

  /**
   * Delete admin webhook
   */
  static async deleteAdminWebhook(id) {
    const result = await query(
      `DELETE FROM admin_webhooks WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rows[0];
  }

  /**
   * Get enabled admin webhooks by type
   */
  static async getEnabledAdminWebhooksByType(webhookType) {
    const result = await query(
      `SELECT * FROM admin_webhooks 
       WHERE webhook_type = $1 AND enabled = TRUE AND consecutive_failures < 5`,
      [webhookType]
    );
    return result.rows;
  }

  /**
   * Get webhook logs
   */
  static async getLogs(options = {}) {
    const { webhookId, webhookTable, limit = 50, offset = 0 } = options;
    
    let sql = `SELECT * FROM webhook_logs WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    if (webhookId) {
      sql += ` AND webhook_id = $${paramIndex}`;
      params.push(webhookId);
      paramIndex++;
    }

    if (webhookTable) {
      sql += ` AND webhook_table = $${paramIndex}`;
      params.push(webhookTable);
      paramIndex++;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Get user's tracked user webhooks that match a username
   */
  static async getMatchingTrackedUserWebhooks(username) {
    const result = await query(
      `SELECT * FROM user_webhooks 
       WHERE webhook_type = 'tracked_user_message' 
       AND enabled = TRUE 
       AND consecutive_failures < 5
       AND (
         config->'tracked_usernames' ? $1
         OR config->>'tracked_usernames' LIKE $2
       )`,
      [username.toLowerCase(), `%"${username.toLowerCase()}"%`]
    );
    return result.rows;
  }

  /**
   * Get mod action webhooks that match criteria
   */
  static async getMatchingModActionWebhooks(actionType, channelName) {
    const result = await query(
      `SELECT * FROM user_webhooks 
       WHERE webhook_type = 'mod_action' 
       AND enabled = TRUE 
       AND consecutive_failures < 5
       AND (
         config->'action_types' IS NULL 
         OR config->'action_types' ? $1
         OR config->>'action_types' LIKE $2
       )
       AND (
         config->'channels' IS NULL 
         OR config->'channels' ? $3
         OR config->>'channels' LIKE $4
       )`,
      [actionType, `%"${actionType}"%`, channelName.toLowerCase(), `%"${channelName.toLowerCase()}"%`]
    );
    return result.rows;
  }

  /**
   * Get channel status webhooks that match a channel
   */
  static async getMatchingChannelWebhooks(webhookType, channelName) {
    const result = await query(
      `SELECT * FROM user_webhooks 
       WHERE webhook_type = $1 
       AND enabled = TRUE 
       AND muted = FALSE
       AND consecutive_failures < 5
       AND (
         config->'channels' IS NULL 
         OR config->'channels' = '[]'::jsonb
         OR config->'channels' ? $2
         OR config->>'channels' LIKE $3
       )`,
      [webhookType, channelName.toLowerCase(), `%"${channelName.toLowerCase()}"%`]
    );
    return result.rows;
  }

  /**
   * Get bits webhooks that match criteria (channel + minimum bits)
   */
  static async getMatchingBitsWebhooks(channelName, bitsAmount) {
    const result = await query(
      `SELECT * FROM user_webhooks 
       WHERE webhook_type = 'channel_bits' 
       AND enabled = TRUE 
       AND muted = FALSE
       AND consecutive_failures < 5
       AND (
         config->'channels' IS NULL 
         OR config->'channels' = '[]'::jsonb
         OR config->'channels' ? $1
         OR config->>'channels' LIKE $2
       )
       AND (
         config->>'min_bits' IS NULL 
         OR (config->>'min_bits')::int <= $3
       )`,
      [channelName.toLowerCase(), `%"${channelName.toLowerCase()}"%`, bitsAmount]
    );
    return result.rows;
  }

  /**
   * Get subscription webhooks that match criteria
   */
  static async getMatchingSubscriptionWebhooks(channelName, subType, cumulativeMonths = 0) {
    const result = await query(
      `SELECT * FROM user_webhooks 
       WHERE webhook_type = 'channel_subscription' 
       AND enabled = TRUE 
       AND muted = FALSE
       AND consecutive_failures < 5
       AND (
         config->'channels' IS NULL 
         OR config->'channels' = '[]'::jsonb
         OR config->'channels' ? $1
         OR config->>'channels' LIKE $2
       )
       AND (
         config->'sub_types' IS NULL 
         OR config->'sub_types' = '[]'::jsonb
         OR config->'sub_types' ? $3
         OR config->>'sub_types' LIKE $4
       )
       AND (
         config->>'min_months' IS NULL 
         OR (config->>'min_months')::int <= $5
       )`,
      [channelName.toLowerCase(), `%"${channelName.toLowerCase()}"%`, subType, `%"${subType}"%`, cumulativeMonths]
    );
    return result.rows;
  }

  /**
   * Get gift sub webhooks that match criteria (channel + minimum gift count)
   */
  static async getMatchingGiftSubWebhooks(channelName, giftCount) {
    const result = await query(
      `SELECT * FROM user_webhooks 
       WHERE webhook_type = 'channel_gift_sub' 
       AND enabled = TRUE 
       AND muted = FALSE
       AND consecutive_failures < 5
       AND (
         config->'channels' IS NULL 
         OR config->'channels' = '[]'::jsonb
         OR config->'channels' ? $1
         OR config->>'channels' LIKE $2
       )
       AND (
         config->>'min_gift_count' IS NULL 
         OR (config->>'min_gift_count')::int <= $3
       )`,
      [channelName.toLowerCase(), `%"${channelName.toLowerCase()}"%`, giftCount]
    );
    return result.rows;
  }

  /**
   * Get raid webhooks that match criteria (channel + minimum viewers)
   */
  static async getMatchingRaidWebhooks(channelName, viewerCount) {
    const result = await query(
      `SELECT * FROM user_webhooks 
       WHERE webhook_type = 'channel_raid' 
       AND enabled = TRUE 
       AND muted = FALSE
       AND consecutive_failures < 5
       AND (
         config->'channels' IS NULL 
         OR config->'channels' = '[]'::jsonb
         OR config->'channels' ? $1
         OR config->>'channels' LIKE $2
       )
       AND (
         config->>'min_viewers' IS NULL 
         OR (config->>'min_viewers')::int <= $3
       )`,
      [channelName.toLowerCase(), `%"${channelName.toLowerCase()}"%`, viewerCount]
    );
    return result.rows;
  }

  /**
   * Get admin webhooks by webhook type
   */
  static async getAdminWebhooksByType(webhookType) {
    const result = await query(
      `SELECT * FROM admin_webhooks 
       WHERE webhook_type = $1 AND enabled = TRUE AND consecutive_failures < 5`,
      [webhookType]
    );
    return result.rows;
  }

  /**
   * Update user webhook success status
   */
  static async updateUserWebhookSuccess(id) {
    await query(
      `UPDATE user_webhooks 
       SET last_triggered_at = NOW(), consecutive_failures = 0, trigger_count = trigger_count + 1 
       WHERE id = $1`,
      [id]
    );
  }

  /**
   * Update user webhook failure status
   */
  static async updateUserWebhookFailure(id) {
    await query(
      `UPDATE user_webhooks 
       SET consecutive_failures = consecutive_failures + 1 
       WHERE id = $1`,
      [id]
    );
  }

  /**
   * Update admin webhook success status
   */
  static async updateAdminWebhookSuccess(id) {
    await query(
      `UPDATE admin_webhooks 
       SET last_triggered_at = NOW(), consecutive_failures = 0, trigger_count = trigger_count + 1 
       WHERE id = $1`,
      [id]
    );
  }

  /**
   * Update admin webhook failure status
   */
  static async updateAdminWebhookFailure(id) {
    await query(
      `UPDATE admin_webhooks 
       SET consecutive_failures = consecutive_failures + 1 
       WHERE id = $1`,
      [id]
    );
  }

  // ============ Webhook URL Bank ============

  /**
   * Get all saved webhook URLs for a user
   */
  static async getSavedUrls(oauthUserId) {
    const result = await query(
      `SELECT * FROM webhook_urls 
       WHERE oauth_user_id = $1 
       ORDER BY last_used_at DESC NULLS LAST, created_at DESC`,
      [oauthUserId]
    );
    return result.rows;
  }

  /**
   * Save a webhook URL to the bank
   */
  static async saveUrl(oauthUserId, name, webhookUrl) {
    const result = await query(
      `INSERT INTO webhook_urls (oauth_user_id, name, webhook_url)
       VALUES ($1, $2, $3)
       ON CONFLICT (oauth_user_id, webhook_url) 
       DO UPDATE SET name = $2, last_used_at = NOW()
       RETURNING *`,
      [oauthUserId, name, webhookUrl]
    );
    return result.rows[0];
  }

  /**
   * Update a saved webhook URL
   */
  static async updateSavedUrl(id, oauthUserId, name) {
    const result = await query(
      `UPDATE webhook_urls SET name = $1 WHERE id = $2 AND oauth_user_id = $3 RETURNING *`,
      [name, id, oauthUserId]
    );
    return result.rows[0];
  }

  /**
   * Delete a saved webhook URL
   */
  static async deleteSavedUrl(id, oauthUserId) {
    const result = await query(
      `DELETE FROM webhook_urls WHERE id = $1 AND oauth_user_id = $2 RETURNING id`,
      [id, oauthUserId]
    );
    return result.rows[0];
  }

  /**
   * Mark a saved URL as used
   */
  static async markUrlUsed(oauthUserId, webhookUrl) {
    await query(
      `UPDATE webhook_urls SET last_used_at = NOW() 
       WHERE oauth_user_id = $1 AND webhook_url = $2`,
      [oauthUserId, webhookUrl]
    );
  }

  /**
   * Count saved URLs for a user
   */
  static async countSavedUrls(oauthUserId) {
    const result = await query(
      `SELECT COUNT(*) as count FROM webhook_urls WHERE oauth_user_id = $1`,
      [oauthUserId]
    );
    return parseInt(result.rows[0].count);
  }
}

export default Webhook;
