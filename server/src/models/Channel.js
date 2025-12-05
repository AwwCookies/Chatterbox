import { query } from '../config/database.js';
import logger from '../utils/logger.js';

class Channel {
  /**
   * Find or create a channel by name
   */
  static async findOrCreate(channelName, twitchId = null) {
    const name = channelName.toLowerCase().replace(/^#/, '');
    
    // Try to find existing
    const existing = await query(
      'SELECT * FROM channels WHERE name = $1',
      [name]
    );
    
    if (existing.rows.length > 0) {
      // Update twitch_id if we now have it but didn't before
      if (twitchId && !existing.rows[0].twitch_id) {
        const updated = await query(
          'UPDATE channels SET twitch_id = $1 WHERE name = $2 RETURNING *',
          [twitchId, name]
        );
        return updated.rows[0];
      }
      return existing.rows[0];
    }
    
    // Create new
    const result = await query(
      `INSERT INTO channels (name, twitch_id, display_name, is_active)
       VALUES ($1, $2, $3, TRUE)
       RETURNING *`,
      [name, twitchId, channelName]
    );
    
    logger.info('Created new channel:', name);
    return result.rows[0];
  }

  /**
   * Get all channels
   */
  static async getAll(activeOnly = false) {
    let sql = `
      SELECT c.*, 
             COUNT(DISTINCT m.id) as message_count
      FROM channels c
      LEFT JOIN messages m ON c.id = m.channel_id
    `;
    
    if (activeOnly) {
      sql += ' WHERE c.is_active = TRUE';
    }
    
    sql += ' GROUP BY c.id ORDER BY c.name';
    
    const result = await query(sql);
    return result.rows;
  }

  /**
   * Get channel by name
   */
  static async getByName(name) {
    const result = await query(
      'SELECT * FROM channels WHERE name = $1',
      [name.toLowerCase()]
    );
    return result.rows[0] || null;
  }

  /**
   * Get channel by ID
   */
  static async getById(id) {
    const result = await query(
      'SELECT * FROM channels WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Update channel status
   */
  static async updateStatus(name, isActive) {
    const result = await query(
      `UPDATE channels SET is_active = $1 WHERE name = $2 RETURNING *`,
      [isActive, name.toLowerCase()]
    );
    return result.rows[0] || null;
  }

  /**
   * Get channel statistics
   */
  static async getStats(channelId, since = null, until = null) {
    const params = [channelId];
    let dateFilter = '';
    
    if (since) {
      params.push(since);
      dateFilter += ` AND m.timestamp >= $${params.length}`;
    }
    if (until) {
      params.push(until);
      dateFilter += ` AND m.timestamp <= $${params.length}`;
    }
    
    // Get message stats
    const messageStats = await query(`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(CASE WHEN is_deleted THEN 1 END) as deleted_messages
      FROM messages m
      WHERE channel_id = $1 ${dateFilter}
    `, params);
    
    // Get mod action stats
    const modParams = [channelId];
    let modDateFilter = '';
    if (since) {
      modParams.push(since);
      modDateFilter += ` AND timestamp >= $${modParams.length}`;
    }
    if (until) {
      modParams.push(until);
      modDateFilter += ` AND timestamp <= $${modParams.length}`;
    }
    
    const modStats = await query(`
      SELECT 
        action_type,
        COUNT(*) as count
      FROM mod_actions
      WHERE channel_id = $1 ${modDateFilter}
      GROUP BY action_type
    `, modParams);
    
    return {
      ...messageStats.rows[0],
      mod_actions: modStats.rows
    };
  }

  /**
   * Get active channel names
   */
  static async getActiveNames() {
    const result = await query(
      'SELECT name FROM channels WHERE is_active = TRUE'
    );
    return result.rows.map(r => r.name);
  }

  /**
   * Get top users by message count in a channel
   */
  static async getTopUsers(channelId, limit = 10, since = null, until = null) {
    const params = [channelId, limit];
    let dateFilter = '';
    
    if (since) {
      params.push(since);
      dateFilter += ` AND m.timestamp >= $${params.length}`;
    }
    if (until) {
      params.push(until);
      dateFilter += ` AND m.timestamp <= $${params.length}`;
    }
    
    const result = await query(`
      SELECT 
        u.id,
        u.username,
        u.display_name,
        u.twitch_id,
        COUNT(m.id) as message_count,
        MAX(m.timestamp) as last_message_at
      FROM users u
      JOIN messages m ON u.id = m.user_id
      WHERE m.channel_id = $1 ${dateFilter}
      GROUP BY u.id, u.username, u.display_name, u.twitch_id
      ORDER BY message_count DESC
      LIMIT $2
    `, params);
    
    return result.rows;
  }
}

export default Channel;
