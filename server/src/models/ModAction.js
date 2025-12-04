import { query } from '../config/database.js';
import logger from '../utils/logger.js';

class ModAction {
  /**
   * Create a new mod action
   */
  static async create(actionData) {
    const {
      channelId,
      moderatorId,
      targetUserId,
      actionType,
      durationSeconds = null,
      reason = null,
      timestamp,
      relatedMessageId = null,
      metadata = {}
    } = actionData;
    
    const result = await query(
      `INSERT INTO mod_actions 
       (channel_id, moderator_id, target_user_id, action_type, duration_seconds, reason, timestamp, related_message_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [channelId, moderatorId, targetUserId, actionType, durationSeconds, reason, timestamp, relatedMessageId, JSON.stringify(metadata)]
    );
    
    logger.info(`Mod action recorded: ${actionType} on user ${targetUserId} in channel ${channelId}`);
    return result.rows[0];
  }

  /**
   * Get mod actions with filters
   */
  static async getAll(options = {}) {
    const {
      type,
      channel,
      moderator,
      target,
      since,
      until,
      limit = 50,
      offset = 0
    } = options;
    
    let sql = `
      SELECT ma.*, 
             c.name as channel_name,
             m.username as moderator_username, m.display_name as moderator_display_name,
             t.username as target_username, t.display_name as target_display_name
      FROM mod_actions ma
      JOIN channels c ON ma.channel_id = c.id
      LEFT JOIN users m ON ma.moderator_id = m.id
      JOIN users t ON ma.target_user_id = t.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (type) {
      sql += ` AND ma.action_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    
    if (channel) {
      sql += ` AND c.name = $${paramIndex}`;
      params.push(channel.toLowerCase());
      paramIndex++;
    }
    
    if (moderator) {
      sql += ` AND m.username = $${paramIndex}`;
      params.push(moderator.toLowerCase());
      paramIndex++;
    }
    
    if (target) {
      sql += ` AND t.username = $${paramIndex}`;
      params.push(target.toLowerCase());
      paramIndex++;
    }
    
    if (since) {
      sql += ` AND ma.timestamp >= $${paramIndex}`;
      params.push(since);
      paramIndex++;
    }
    
    if (until) {
      sql += ` AND ma.timestamp <= $${paramIndex}`;
      params.push(until);
      paramIndex++;
    }
    
    // Get total count
    const countResult = await query(
      sql.replace(/SELECT .+ FROM/, 'SELECT COUNT(*) FROM'),
      params
    );
    const total = parseInt(countResult.rows[0].count);
    
    // Add ordering and pagination
    sql += ` ORDER BY ma.timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const result = await query(sql, params);
    
    return {
      actions: result.rows,
      total,
      hasMore: offset + result.rows.length < total
    };
  }

  /**
   * Get recent mod actions
   */
  static async getRecent(limit = 100) {
    const result = await query(
      `SELECT ma.*, 
              c.name as channel_name,
              m.username as moderator_username,
              t.username as target_username
       FROM mod_actions ma
       JOIN channels c ON ma.channel_id = c.id
       LEFT JOIN users m ON ma.moderator_id = m.id
       JOIN users t ON ma.target_user_id = t.id
       ORDER BY ma.timestamp DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  /**
   * Get mod action statistics
   */
  static async getStats(options = {}) {
    const { channel, since, until } = options;
    
    let sql = `
      SELECT 
        action_type,
        COUNT(*) as count
      FROM mod_actions ma
      JOIN channels c ON ma.channel_id = c.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (channel) {
      sql += ` AND c.name = $${paramIndex}`;
      params.push(channel.toLowerCase());
      paramIndex++;
    }
    
    if (since) {
      sql += ` AND ma.timestamp >= $${paramIndex}`;
      params.push(since);
      paramIndex++;
    }
    
    if (until) {
      sql += ` AND ma.timestamp <= $${paramIndex}`;
      params.push(until);
      paramIndex++;
    }
    
    sql += ` GROUP BY action_type ORDER BY count DESC`;
    
    const actionCounts = await query(sql, params);
    
    // Get most active moderators
    let modSql = `
      SELECT u.username, u.display_name, COUNT(*) as action_count
      FROM mod_actions ma
      JOIN users u ON ma.moderator_id = u.id
      JOIN channels c ON ma.channel_id = c.id
      WHERE ma.moderator_id IS NOT NULL
    `;
    
    const modParams = [];
    let modParamIndex = 1;
    
    if (channel) {
      modSql += ` AND c.name = $${modParamIndex}`;
      modParams.push(channel.toLowerCase());
      modParamIndex++;
    }
    
    if (since) {
      modSql += ` AND ma.timestamp >= $${modParamIndex}`;
      modParams.push(since);
      modParamIndex++;
    }
    
    if (until) {
      modSql += ` AND ma.timestamp <= $${modParamIndex}`;
      modParams.push(until);
      modParamIndex++;
    }
    
    modSql += ` GROUP BY u.id ORDER BY action_count DESC LIMIT 10`;
    
    const topMods = await query(modSql, modParams);
    
    return {
      action_counts: actionCounts.rows,
      top_moderators: topMods.rows
    };
  }

  /**
   * Get actions against a specific user
   */
  static async getByTargetUser(userId, options = {}) {
    const { limit = 50, offset = 0 } = options;
    
    const result = await query(
      `SELECT ma.*, 
              c.name as channel_name,
              m.username as moderator_username
       FROM mod_actions ma
       JOIN channels c ON ma.channel_id = c.id
       LEFT JOIN users m ON ma.moderator_id = m.id
       WHERE ma.target_user_id = $1
       ORDER BY ma.timestamp DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  }
}

export default ModAction;
