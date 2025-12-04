import { query } from '../config/database.js';
import logger from '../utils/logger.js';

class User {
  /**
   * Find or create a user, updating last_seen
   */
  static async findOrCreate(username, twitchId = null, displayName = null) {
    const normalizedUsername = username.toLowerCase();
    
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
      `SELECT * FROM users 
       WHERE username ILIKE $1 OR display_name ILIKE $1
       ORDER BY last_seen DESC
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
      results.push(result);
    }
    return results;
  }
}

export default User;
