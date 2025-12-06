import pool from '../config/database.js';
import logger from '../utils/logger.js';

// In-memory cache for tier lookups
const tierCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

class Tier {
  /**
   * Get all tiers
   */
  static async getAll() {
    const result = await pool.query(`
      SELECT t.*, 
        (SELECT COUNT(*) FROM user_tiers ut WHERE ut.tier_id = t.id) as user_count
      FROM tiers t
      ORDER BY t.sort_order ASC, t.id ASC
    `);
    return result.rows;
  }

  /**
   * Get a tier by ID
   */
  static async getById(id) {
    const result = await pool.query(`
      SELECT t.*, 
        (SELECT COUNT(*) FROM user_tiers ut WHERE ut.tier_id = t.id) as user_count
      FROM tiers t
      WHERE t.id = $1
    `, [id]);
    return result.rows[0];
  }

  /**
   * Get tier by name
   */
  static async getByName(name) {
    const result = await pool.query(`
      SELECT * FROM tiers WHERE name = $1
    `, [name]);
    return result.rows[0];
  }

  /**
   * Get the default tier
   */
  static async getDefault() {
    const result = await pool.query(`
      SELECT * FROM tiers WHERE is_default = TRUE LIMIT 1
    `);
    return result.rows[0];
  }

  /**
   * Create a new tier
   */
  static async create(data) {
    const {
      name,
      displayName,
      description,
      maxWebhooks = 2,
      maxChannels = 10,
      maxApiCallsPerMinute = 30,
      maxSearchResults = 50,
      maxHistoryDays = 7,
      canExport = false,
      canUseWebsocket = true,
      priceMonthly = null,
      priceYearly = null,
      isDefault = false,
      sortOrder = 0,
    } = data;

    // If setting as default, unset other defaults first
    if (isDefault) {
      await pool.query(`UPDATE tiers SET is_default = FALSE WHERE is_default = TRUE`);
    }

    const result = await pool.query(`
      INSERT INTO tiers (
        name, display_name, description, 
        max_webhooks, max_channels, max_api_calls_per_minute, 
        max_search_results, max_history_days,
        can_export, can_use_websocket,
        price_monthly, price_yearly,
        is_default, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      name, displayName, description,
      maxWebhooks, maxChannels, maxApiCallsPerMinute,
      maxSearchResults, maxHistoryDays,
      canExport, canUseWebsocket,
      priceMonthly, priceYearly,
      isDefault, sortOrder,
    ]);

    this.clearCache();
    return result.rows[0];
  }

  /**
   * Update a tier
   */
  static async update(id, data) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const fieldMap = {
      name: 'name',
      displayName: 'display_name',
      description: 'description',
      maxWebhooks: 'max_webhooks',
      maxChannels: 'max_channels',
      maxApiCallsPerMinute: 'max_api_calls_per_minute',
      maxSearchResults: 'max_search_results',
      maxHistoryDays: 'max_history_days',
      canExport: 'can_export',
      canUseWebsocket: 'can_use_websocket',
      priceMonthly: 'price_monthly',
      priceYearly: 'price_yearly',
      isDefault: 'is_default',
      sortOrder: 'sort_order',
    };

    // If setting as default, unset other defaults first
    if (data.isDefault) {
      await pool.query(`UPDATE tiers SET is_default = FALSE WHERE is_default = TRUE AND id != $1`, [id]);
    }

    for (const [key, column] of Object.entries(fieldMap)) {
      if (data[key] !== undefined) {
        fields.push(`${column} = $${paramCount}`);
        values.push(data[key]);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return this.getById(id);
    }

    values.push(id);
    const result = await pool.query(`
      UPDATE tiers 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `, values);

    this.clearCache();
    return result.rows[0];
  }

  /**
   * Delete a tier (only if no users assigned)
   */
  static async delete(id) {
    // Check if tier has users
    const userCheck = await pool.query(
      `SELECT COUNT(*) as count FROM user_tiers WHERE tier_id = $1`,
      [id]
    );

    if (parseInt(userCheck.rows[0].count) > 0) {
      throw new Error('Cannot delete tier with assigned users');
    }

    // Check if it's the default tier
    const tier = await this.getById(id);
    if (tier?.is_default) {
      throw new Error('Cannot delete the default tier');
    }

    const result = await pool.query(
      `DELETE FROM tiers WHERE id = $1 RETURNING *`,
      [id]
    );

    this.clearCache();
    return result.rows[0];
  }

  /**
   * Get user's effective tier (with caching)
   */
  static async getUserTier(userId, isAdmin = false) {
    // Admin bypass - return unlimited tier
    if (isAdmin) {
      return {
        tier_id: null,
        tier_name: 'admin',
        display_name: 'Admin (Unlimited)',
        max_webhooks: -1,
        max_channels: -1,
        max_api_calls_per_minute: -1,
        max_search_results: -1,
        max_history_days: null,
        can_export: true,
        can_use_websocket: true,
        expires_at: null,
        is_expired: false,
        is_admin: true,
        unlimited: true,
      };
    }

    // Check cache
    const cacheKey = `user_tier_${userId}`;
    const cached = tierCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    // Query database using the helper function
    const result = await pool.query(
      `SELECT * FROM get_user_tier($1)`,
      [userId]
    );

    let tier = result.rows[0];

    // If no tier found (shouldn't happen with default), get default
    if (!tier) {
      const defaultTier = await this.getDefault();
      if (defaultTier) {
        tier = {
          tier_id: defaultTier.id,
          tier_name: defaultTier.name,
          display_name: defaultTier.display_name,
          max_webhooks: defaultTier.max_webhooks,
          max_channels: defaultTier.max_channels,
          max_api_calls_per_minute: defaultTier.max_api_calls_per_minute,
          max_search_results: defaultTier.max_search_results,
          max_history_days: defaultTier.max_history_days,
          can_export: defaultTier.can_export,
          can_use_websocket: defaultTier.can_use_websocket,
          expires_at: null,
          is_expired: false,
        };
      }
    }

    if (tier) {
      tier.unlimited = tier.max_webhooks === -1;
      tier.is_admin = false;
    }

    // Cache the result
    tierCache.set(cacheKey, {
      data: tier,
      expiry: Date.now() + CACHE_TTL,
    });

    return tier;
  }

  /**
   * Assign a tier to a user
   */
  static async assignToUser(userId, tierId, assignedBy, expiresAt = null, notes = null) {
    const result = await pool.query(`
      INSERT INTO user_tiers (user_id, tier_id, assigned_by, expires_at, notes)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        tier_id = $2, 
        assigned_by = $3, 
        assigned_at = NOW(),
        expires_at = $4, 
        notes = $5
      RETURNING *
    `, [userId, tierId, assignedBy, expiresAt, notes]);

    // Clear cache for this user
    tierCache.delete(`user_tier_${userId}`);

    return result.rows[0];
  }

  /**
   * Remove tier assignment from user (reverts to default)
   */
  static async removeFromUser(userId) {
    const result = await pool.query(
      `DELETE FROM user_tiers WHERE user_id = $1 RETURNING *`,
      [userId]
    );

    tierCache.delete(`user_tier_${userId}`);
    return result.rows[0];
  }

  /**
   * Get user's tier assignment details
   */
  static async getUserTierAssignment(userId) {
    const result = await pool.query(`
      SELECT ut.*, t.name as tier_name, t.display_name
      FROM user_tiers ut
      JOIN tiers t ON t.id = ut.tier_id
      WHERE ut.user_id = $1
    `, [userId]);
    return result.rows[0];
  }

  /**
   * Get users by tier
   */
  static async getUsersByTier(tierId, limit = 100, offset = 0) {
    const result = await pool.query(`
      SELECT ou.id, ou.twitch_id, ou.username, ou.display_name, ou.profile_image_url,
             ut.assigned_at, ut.expires_at, ut.notes
      FROM user_tiers ut
      JOIN oauth_users ou ON ou.id = ut.user_id
      WHERE ut.tier_id = $1
      ORDER BY ut.assigned_at DESC
      LIMIT $2 OFFSET $3
    `, [tierId, limit, offset]);
    return result.rows;
  }

  /**
   * Clear tier cache
   */
  static clearCache() {
    tierCache.clear();
  }

  /**
   * Clear cache for specific user
   */
  static clearUserCache(userId) {
    tierCache.delete(`user_tier_${userId}`);
  }

  /**
   * Check if a limit value means unlimited
   */
  static isUnlimited(value) {
    return value === -1 || value === null;
  }

  /**
   * Check if user is within a specific limit
   * @returns {object} { allowed: boolean, current: number, max: number, percentage: number }
   */
  static async checkLimit(userId, limitType, currentCount, isAdmin = false) {
    const tier = await this.getUserTier(userId, isAdmin);
    
    if (!tier) {
      return { allowed: false, current: currentCount, max: 0, percentage: 100, error: 'No tier found' };
    }

    const limitMap = {
      webhooks: tier.max_webhooks,
      channels: tier.max_channels,
      api_calls: tier.max_api_calls_per_minute,
      search_results: tier.max_search_results,
    };

    const max = limitMap[limitType];

    if (max === undefined) {
      return { allowed: true, current: currentCount, max: -1, percentage: 0 };
    }

    // Unlimited
    if (this.isUnlimited(max)) {
      return { allowed: true, current: currentCount, max: -1, percentage: 0, unlimited: true };
    }

    const percentage = Math.round((currentCount / max) * 100);
    const allowed = currentCount < max;

    return {
      allowed,
      current: currentCount,
      max,
      percentage,
      warning: percentage >= 80 && percentage < 100,
    };
  }
}

export default Tier;
