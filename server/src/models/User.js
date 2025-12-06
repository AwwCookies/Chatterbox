import { query } from '../config/database.js';
import logger from '../utils/logger.js';

class User {
  /**
   * Find or create a user, updating last_seen
   * Skips blocked users if skipBlocked is true
   */
  static async findOrCreate(username, twitchId = null, displayName = null, skipBlocked = true) {
    const normalizedUsername = username.toLowerCase();
    
    // Check if user is blocked
    if (skipBlocked) {
      const existing = await query(
        'SELECT is_blocked FROM users WHERE username = $1',
        [normalizedUsername]
      );
      if (existing.rows[0]?.is_blocked) {
        return null; // Skip blocked users
      }
    }
    
    // Try upsert
    const result = await query(
      `INSERT INTO users (username, twitch_id, display_name, first_seen, last_seen)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (username) 
       DO UPDATE SET 
         last_seen = NOW(),
         twitch_id = COALESCE(EXCLUDED.twitch_id, users.twitch_id),
         display_name = COALESCE(EXCLUDED.display_name, users.display_name)
       RETURNING *`,
      [normalizedUsername, twitchId, displayName || username]
    );
    
    return result.rows[0];
  }

  /**
   * Check if a user is blocked
   */
  static async isBlocked(username) {
    const result = await query(
      'SELECT is_blocked FROM users WHERE username = $1',
      [username.toLowerCase()]
    );
    return result.rows[0]?.is_blocked || false;
  }

  /**
   * Get user by username
   */
  static async getByUsername(username) {
    const result = await query(
      'SELECT * FROM users WHERE username = $1',
      [username.toLowerCase()]
    );
    return result.rows[0] || null;
  }

  /**
   * Get user by ID
   */
  static async getById(id) {
    const result = await query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Search users by username
   */
  static async search(searchTerm, limit = 50, offset = 0) {
    const result = await query(
      `SELECT 
        u.*,
        COUNT(DISTINCT m.id)::BIGINT as message_count,
        COALESCE((SELECT COUNT(*) FROM mod_actions ma WHERE ma.target_user_id = u.id AND ma.action_type = 'timeout'), 0)::BIGINT as timeout_count,
        COALESCE((SELECT COUNT(*) FROM mod_actions ma WHERE ma.target_user_id = u.id AND ma.action_type = 'ban'), 0)::BIGINT as ban_count
       FROM users u
       LEFT JOIN messages m ON u.id = m.user_id
       WHERE u.username ILIKE $1 OR u.display_name ILIKE $1
       GROUP BY u.id
       ORDER BY u.last_seen DESC
       LIMIT $2 OFFSET $3`,
      [`%${searchTerm}%`, limit, offset]
    );
    return result.rows;
  }

  /**
   * Get all users with pagination
   */
  static async getAll(limit = 50, offset = 0, channel = null) {
    let sql = `
      SELECT DISTINCT u.* FROM users u
    `;
    const params = [];
    
    if (channel) {
      sql += `
        JOIN messages m ON u.id = m.user_id
        JOIN channels c ON m.channel_id = c.id
        WHERE c.name = $1
      `;
      params.push(channel.toLowerCase());
    }
    
    sql += ` ORDER BY u.last_seen DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Get user statistics
   */
  static async getStats(userId) {
    const stats = await query(`
      SELECT 
        u.*,
        COUNT(DISTINCT m.id) as total_messages,
        COUNT(DISTINCT m.channel_id) as channels_count,
        (SELECT COUNT(*) FROM mod_actions WHERE target_user_id = u.id AND action_type = 'ban') as ban_count,
        (SELECT COUNT(*) FROM mod_actions WHERE target_user_id = u.id AND action_type = 'timeout') as timeout_count
      FROM users u
      LEFT JOIN messages m ON u.id = m.user_id
      WHERE u.id = $1
      GROUP BY u.id
    `, [userId]);
    
    // Get channels user is active in
    const channels = await query(`
      SELECT DISTINCT c.name, c.display_name, COUNT(m.id) as message_count
      FROM channels c
      JOIN messages m ON c.id = m.channel_id
      WHERE m.user_id = $1
      GROUP BY c.id
      ORDER BY message_count DESC
      LIMIT 10
    `, [userId]);
    
    return {
      ...stats.rows[0],
      active_channels: channels.rows
    };
  }

  /**
   * Bulk find or create users (for batch processing)
   */
  static async bulkFindOrCreate(users) {
    if (users.length === 0) return [];
    
    const results = [];
    for (const user of users) {
      const result = await this.findOrCreate(
        user.username,
        user.twitchId,
        user.displayName
      );
      if (result) {
        results.push(result);
      }
    }
    return results;
  }

  /**
   * Get top users by message count
   */
  static async getTopUsers(options = {}) {
    const { limit = 50, offset = 0, channelId = null, since = null, until = null } = options;
    
    const result = await query(
      'SELECT * FROM get_top_users($1, $2, $3, $4, $5)',
      [limit, offset, channelId, since, until]
    );
    
    // Get total count
    let countSql = 'SELECT COUNT(DISTINCT u.id) FROM users u';
    const countParams = [];
    
    if (channelId) {
      countSql += ' JOIN messages m ON u.id = m.user_id WHERE m.channel_id = $1';
      countParams.push(channelId);
    }
    
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count);
    
    return {
      users: result.rows,
      total,
      hasMore: offset + result.rows.length < total
    };
  }

  /**
   * Block a user from being logged
   */
  static async blockUser(userId, reason = null) {
    const result = await query(
      `UPDATE users 
       SET is_blocked = TRUE, blocked_at = NOW(), blocked_reason = $2
       WHERE id = $1
       RETURNING *`,
      [userId, reason]
    );
    return result.rows[0];
  }

  /**
   * Unblock a user
   */
  static async unblockUser(userId) {
    const result = await query(
      `UPDATE users 
       SET is_blocked = FALSE, blocked_at = NULL, blocked_reason = NULL
       WHERE id = $1
       RETURNING *`,
      [userId]
    );
    return result.rows[0];
  }

  /**
   * Update user notes
   */
  static async updateNotes(userId, notes) {
    const result = await query(
      'UPDATE users SET notes = $2 WHERE id = $1 RETURNING *',
      [userId, notes]
    );
    return result.rows[0];
  }

  /**
   * Delete all messages for a user
   */
  static async deleteAllMessages(userId) {
    const result = await query(
      'DELETE FROM messages WHERE user_id = $1 RETURNING id',
      [userId]
    );
    return result.rowCount;
  }

  /**
   * Delete user and all their data (messages, mod actions)
   */
  static async deleteUser(userId) {
    // Delete messages
    const messagesDeleted = await query(
      'DELETE FROM messages WHERE user_id = $1',
      [userId]
    );
    
    // Delete mod actions where user is target
    const modActionsDeleted = await query(
      'DELETE FROM mod_actions WHERE target_user_id = $1',
      [userId]
    );
    
    // Delete the user
    const userDeleted = await query(
      'DELETE FROM users WHERE id = $1 RETURNING *',
      [userId]
    );
    
    return {
      user: userDeleted.rows[0],
      messagesDeleted: messagesDeleted.rowCount,
      modActionsDeleted: modActionsDeleted.rowCount
    };
  }

  /**
   * Export user data (GDPR compliance)
   */
  static async exportUserData(userId) {
    const user = await query('SELECT * FROM users WHERE id = $1', [userId]);
    const messages = await query(
      `SELECT m.*, c.name as channel_name 
       FROM messages m 
       JOIN channels c ON m.channel_id = c.id 
       WHERE m.user_id = $1 
       ORDER BY m.timestamp DESC`,
      [userId]
    );
    const modActions = await query(
      `SELECT ma.*, c.name as channel_name 
       FROM mod_actions ma 
       JOIN channels c ON ma.channel_id = c.id 
       WHERE ma.target_user_id = $1 
       ORDER BY ma.timestamp DESC`,
      [userId]
    );
    
    return {
      user: user.rows[0],
      messages: messages.rows,
      modActions: modActions.rows,
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Get all blocked users
   */
  static async getBlockedUsers(limit = 50, offset = 0) {
    const result = await query(
      `SELECT * FROM users 
       WHERE is_blocked = TRUE 
       ORDER BY blocked_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    const countResult = await query('SELECT COUNT(*) FROM users WHERE is_blocked = TRUE');
    
    return {
      users: result.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }
}

export default User;
