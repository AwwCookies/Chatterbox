import { query, getClient } from '../config/database.js';
import logger from '../utils/logger.js';

class Message {
  /**
   * Insert a single message
   */
  static async create(messageData) {
    const {
      channelId,
      userId,
      messageText,
      timestamp,
      messageId,
      badges = [],
      emotes = [],
      replyToMessageId = null,
      replyToUserId = null,
      replyToUsername = null,
      mentionedUsers = null
    } = messageData;
    
    const result = await query(
      `INSERT INTO messages (channel_id, user_id, message_text, timestamp, message_id, badges, emotes, reply_to_message_id, reply_to_user_id, reply_to_username, mentioned_users)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (message_id) DO NOTHING
       RETURNING *`,
      [channelId, userId, messageText, timestamp, messageId, JSON.stringify(badges), JSON.stringify(emotes), replyToMessageId, replyToUserId, replyToUsername, mentionedUsers ? JSON.stringify(mentionedUsers) : null]
    );
    
    return result.rows[0];
  }

  /**
   * Batch insert messages for better performance
   */
  static async bulkCreate(messages) {
    if (messages.length === 0) return [];
    
    const client = await getClient();
    try {
      await client.query('BEGIN');
      
      const insertedMessages = [];
      for (const msg of messages) {
        const result = await client.query(
          `INSERT INTO messages (channel_id, user_id, message_text, timestamp, message_id, badges, emotes, reply_to_message_id, reply_to_user_id, reply_to_username, mentioned_users)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (message_id) DO NOTHING
           RETURNING *`,
          [
            msg.channelId,
            msg.userId,
            msg.messageText,
            msg.timestamp,
            msg.messageId,
            JSON.stringify(msg.badges || []),
            JSON.stringify(msg.emotes || []),
            msg.replyToMessageId || null,
            msg.replyToUserId || null,
            msg.replyToUsername || null,
            msg.mentionedUsers ? JSON.stringify(msg.mentionedUsers) : null
          ]
        );
        if (result.rows[0]) {
          insertedMessages.push(result.rows[0]);
        }
      }
      
      await client.query('COMMIT');
      logger.debug(`Bulk inserted ${insertedMessages.length} messages`);
      return insertedMessages;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Bulk insert failed:', error.message);
      logger.error('Bulk insert error details:', { code: error.code, detail: error.detail, hint: error.hint });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get messages with filters
   */
  static async getAll(options = {}) {
    const {
      channel,
      user,
      limit = 50,
      offset = 0,
      since,
      until,
      search,
      includeDeleted = false
    } = options;
    
    let sql = `
      SELECT m.*, 
             u.username, u.display_name as user_display_name,
             c.name as channel_name, c.display_name as channel_display_name,
             c.twitch_id as channel_twitch_id,
             del.username as deleted_by_username
      FROM messages m
      JOIN users u ON m.user_id = u.id
      JOIN channels c ON m.channel_id = c.id
      LEFT JOIN users del ON m.deleted_by_id = del.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (!includeDeleted) {
      sql += ` AND m.is_deleted = FALSE`;
    }
    
    if (channel) {
      sql += ` AND c.name = $${paramIndex}`;
      params.push(channel.toLowerCase());
      paramIndex++;
    }
    
    if (user) {
      sql += ` AND u.username = $${paramIndex}`;
      params.push(user.toLowerCase());
      paramIndex++;
    }
    
    if (since) {
      sql += ` AND m.timestamp >= $${paramIndex}`;
      params.push(since);
      paramIndex++;
    }
    
    if (until) {
      sql += ` AND m.timestamp <= $${paramIndex}`;
      params.push(until);
      paramIndex++;
    }
    
    if (search) {
      sql += ` AND to_tsvector('english', m.message_text) @@ plainto_tsquery('english', $${paramIndex})`;
      params.push(search);
      paramIndex++;
    }
    
    // Get total count - build count query separately to avoid regex issues
    let countSql = `
      SELECT COUNT(*) 
      FROM messages m
      JOIN users u ON m.user_id = u.id
      JOIN channels c ON m.channel_id = c.id
      LEFT JOIN users del ON m.deleted_by_id = del.id
      WHERE 1=1
    `;
    
    // Re-apply the same WHERE conditions for count
    let countParamIndex = 1;
    const countParams = [];
    
    if (!includeDeleted) {
      countSql += ` AND m.is_deleted = FALSE`;
    }
    
    if (channel) {
      countSql += ` AND c.name = $${countParamIndex}`;
      countParams.push(channel.toLowerCase());
      countParamIndex++;
    }
    
    if (user) {
      countSql += ` AND u.username = $${countParamIndex}`;
      countParams.push(user.toLowerCase());
      countParamIndex++;
    }
    
    if (since) {
      countSql += ` AND m.timestamp >= $${countParamIndex}`;
      countParams.push(since);
      countParamIndex++;
    }
    
    if (until) {
      countSql += ` AND m.timestamp <= $${countParamIndex}`;
      countParams.push(until);
      countParamIndex++;
    }
    
    if (search) {
      countSql += ` AND to_tsvector('english', m.message_text) @@ plainto_tsquery('english', $${countParamIndex})`;
      countParams.push(search);
      countParamIndex++;
    }
    
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count);
    
    // Add ordering and pagination
    sql += ` ORDER BY m.timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const result = await query(sql, params);
    
    return {
      messages: result.rows,
      total,
      hasMore: offset + result.rows.length < total
    };
  }

  /**
   * Get a specific message by ID
   */
  static async getById(id) {
    const result = await query(
      `SELECT m.*, 
              u.username, u.display_name as user_display_name,
              c.name as channel_name, c.twitch_id as channel_twitch_id
       FROM messages m
       JOIN users u ON m.user_id = u.id
       JOIN channels c ON m.channel_id = c.id
       WHERE m.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get message by Twitch message ID
   */
  static async getByMessageId(messageId) {
    const result = await query(
      `SELECT m.*, u.username 
       FROM messages m
       JOIN users u ON m.user_id = u.id
       WHERE m.message_id = $1`,
      [messageId]
    );
    return result.rows[0] || null;
  }

  /**
   * Mark a message as deleted
   */
  static async markDeleted(messageId, deletedById = null) {
    const result = await query(
      `UPDATE messages 
       SET is_deleted = TRUE, deleted_at = NOW(), deleted_by_id = $2
       WHERE message_id = $1
       RETURNING *`,
      [messageId, deletedById]
    );
    return result.rows[0] || null;
  }

  /**
   * Full-text search messages
   */
  static async search(searchTerm, options = {}) {
    const { channel, user, limit = 50, offset = 0 } = options;
    
    // Build WHERE clause
    let whereClause = `
      WHERE to_tsvector('english', m.message_text) @@ plainto_tsquery('english', $1)
        AND m.is_deleted = FALSE
    `;
    
    const params = [searchTerm];
    let paramIndex = 2;
    
    if (channel) {
      whereClause += ` AND c.name = $${paramIndex}`;
      params.push(channel.toLowerCase());
      paramIndex++;
    }
    
    if (user) {
      whereClause += ` AND u.username = $${paramIndex}`;
      params.push(user.toLowerCase());
      paramIndex++;
    }

    // Count query
    const countSql = `
      SELECT COUNT(*) as total
      FROM messages m
      JOIN users u ON m.user_id = u.id
      JOIN channels c ON m.channel_id = c.id
      ${whereClause}
    `;
    const countResult = await query(countSql, params.slice(0, paramIndex - 1));
    const total = parseInt(countResult.rows[0].total, 10);
    
    // Data query
    const sql = `
      SELECT m.*, 
             u.username, u.display_name as user_display_name,
             c.name as channel_name, c.twitch_id as channel_twitch_id,
             ts_rank(to_tsvector('english', m.message_text), plainto_tsquery('english', $1)) as rank
      FROM messages m
      JOIN users u ON m.user_id = u.id
      JOIN channels c ON m.channel_id = c.id
      ${whereClause}
      ORDER BY rank DESC, m.timestamp DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);
    
    const result = await query(sql, params);
    const messages = result.rows;
    const hasMore = offset + messages.length < total;
    
    return { messages, total, hasMore };
  }

  /**
   * Get user's messages
   */
  static async getByUser(userId, options = {}) {
    const { channel, limit = 50, offset = 0, since, until } = options;
    
    let sql = `
      SELECT m.*, c.name as channel_name, c.twitch_id as channel_twitch_id
      FROM messages m
      JOIN channels c ON m.channel_id = c.id
      WHERE m.user_id = $1 AND m.is_deleted = FALSE
    `;
    
    const params = [userId];
    let paramIndex = 2;
    
    if (channel) {
      sql += ` AND c.name = $${paramIndex}`;
      params.push(channel.toLowerCase());
      paramIndex++;
    }
    
    if (since) {
      sql += ` AND m.timestamp >= $${paramIndex}`;
      params.push(since);
      paramIndex++;
    }
    
    if (until) {
      sql += ` AND m.timestamp <= $${paramIndex}`;
      params.push(until);
      paramIndex++;
    }
    
    // Build count query
    let countSql = `
      SELECT COUNT(*)
      FROM messages m
      JOIN channels c ON m.channel_id = c.id
      WHERE m.user_id = $1 AND m.is_deleted = FALSE
    `;
    const countParams = [userId];
    let countParamIndex = 2;
    
    if (channel) {
      countSql += ` AND c.name = $${countParamIndex}`;
      countParams.push(channel.toLowerCase());
      countParamIndex++;
    }
    
    if (since) {
      countSql += ` AND m.timestamp >= $${countParamIndex}`;
      countParams.push(since);
      countParamIndex++;
    }
    
    if (until) {
      countSql += ` AND m.timestamp <= $${countParamIndex}`;
      countParams.push(until);
      countParamIndex++;
    }
    
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count);
    
    sql += ` ORDER BY m.timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const result = await query(sql, params);
    return {
      messages: result.rows,
      total,
      hasMore: offset + result.rows.length < total
    };
  }

  /**
   * Get messages containing links for a channel
   */
  static async getMessagesWithLinks(channelId, options = {}) {
    const { limit = 50, offset = 0, since, until } = options;
    
    // Regex pattern to match URLs
    const urlPattern = '(https?://[^\\s]+)';
    
    let sql = `
      SELECT m.*, 
             u.username, 
             u.display_name as user_display_name,
             c.name as channel_name,
             c.twitch_id as channel_twitch_id
      FROM messages m
      JOIN users u ON m.user_id = u.id
      JOIN channels c ON m.channel_id = c.id
      WHERE m.channel_id = $1 
        AND m.message_text ~ $2
        AND m.is_deleted = FALSE
    `;
    
    const params = [channelId, urlPattern];
    let paramIndex = 3;
    
    if (since) {
      sql += ` AND m.timestamp >= $${paramIndex}`;
      params.push(since);
      paramIndex++;
    }
    
    if (until) {
      sql += ` AND m.timestamp <= $${paramIndex}`;
      params.push(until);
      paramIndex++;
    }
    
    sql += ` ORDER BY m.timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const result = await query(sql, params);
    
    // Also get total count
    let countSql = `
      SELECT COUNT(*) as total
      FROM messages m
      WHERE m.channel_id = $1 
        AND m.message_text ~ $2
        AND m.is_deleted = FALSE
    `;
    const countParams = [channelId, urlPattern];
    
    if (since) {
      countSql += ` AND m.timestamp >= $3`;
      countParams.push(since);
    }
    
    const countResult = await query(countSql, countParams);
    
    return {
      messages: result.rows,
      total: parseInt(countResult.rows[0]?.total || 0)
    };
  }
}

export default Message;
