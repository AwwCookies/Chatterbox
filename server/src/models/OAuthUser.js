import { query } from '../config/database.js';
import crypto from 'crypto';

/**
 * OAuth User Model
 * Handles Twitch OAuth users who log in to the application
 */
class OAuthUser {
  /**
   * Create or update a user from Twitch OAuth data
   */
  static async upsertFromTwitch(twitchData, tokens) {
    const { id: twitchId, login: username, display_name, email, profile_image_url } = twitchData;
    const { access_token, refresh_token, expires_in, scope } = tokens;
    
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);
    const scopes = Array.isArray(scope) ? scope : (scope ? scope.split(' ') : []);

    const result = await query(`
      INSERT INTO oauth_users (
        twitch_id, username, display_name, email, profile_image_url,
        access_token, refresh_token, token_expires_at, scopes, last_login
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (twitch_id) DO UPDATE SET
        username = EXCLUDED.username,
        display_name = EXCLUDED.display_name,
        email = EXCLUDED.email,
        profile_image_url = EXCLUDED.profile_image_url,
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_expires_at = EXCLUDED.token_expires_at,
        scopes = EXCLUDED.scopes,
        last_login = NOW()
      RETURNING *
    `, [twitchId, username, display_name, email, profile_image_url, 
        access_token, refresh_token, tokenExpiresAt, scopes]);

    return result.rows[0];
  }

  /**
   * Get user by ID
   */
  static async getById(id) {
    const result = await query(
      'SELECT * FROM oauth_users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get user by Twitch ID
   */
  static async getByTwitchId(twitchId) {
    const result = await query(
      'SELECT * FROM oauth_users WHERE twitch_id = $1',
      [twitchId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get user by username
   */
  static async getByUsername(username) {
    const result = await query(
      'SELECT * FROM oauth_users WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    return result.rows[0] || null;
  }

  /**
   * Update user tokens
   */
  static async updateTokens(userId, tokens) {
    const { access_token, refresh_token, expires_in } = tokens;
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    const result = await query(`
      UPDATE oauth_users 
      SET access_token = $2, refresh_token = $3, token_expires_at = $4
      WHERE id = $1
      RETURNING *
    `, [userId, access_token, refresh_token, tokenExpiresAt]);

    return result.rows[0];
  }

  /**
   * Check if user's token needs refresh (expires in less than 5 minutes)
   */
  static needsTokenRefresh(user) {
    if (!user.token_expires_at) return true;
    const expiresAt = new Date(user.token_expires_at);
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    return expiresAt <= fiveMinutesFromNow;
  }

  /**
   * Set admin status for a user
   */
  static async setAdmin(userId, isAdmin) {
    const result = await query(
      'UPDATE oauth_users SET is_admin = $2 WHERE id = $1 RETURNING *',
      [userId, isAdmin]
    );
    return result.rows[0];
  }

  /**
   * Get all admin users
   */
  static async getAdmins() {
    const result = await query(
      'SELECT id, twitch_id, username, display_name, profile_image_url, created_at, last_login FROM oauth_users WHERE is_admin = true'
    );
    return result.rows;
  }

  /**
   * Delete user and all associated data
   */
  static async deleteUser(userId) {
    // Sessions and requests are CASCADE deleted
    await query('DELETE FROM oauth_users WHERE id = $1', [userId]);
  }

  /**
   * Get public profile (without sensitive token data)
   */
  static sanitize(user) {
    if (!user) return null;
    return {
      id: user.id,
      twitch_id: user.twitch_id,
      username: user.username,
      display_name: user.display_name,
      profile_image_url: user.profile_image_url,
      is_admin: user.is_admin,
      created_at: user.created_at,
      last_login: user.last_login
    };
  }
}

/**
 * User Session Model
 * Handles JWT refresh token sessions
 */
class UserSession {
  /**
   * Create a new session
   */
  static async create(oauthUserId, refreshToken, userAgent, ipAddress, expiresInDays = 30) {
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const result = await query(`
      INSERT INTO user_sessions (oauth_user_id, refresh_token_hash, user_agent, ip_address, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [oauthUserId, refreshTokenHash, userAgent, ipAddress, expiresAt]);

    return result.rows[0];
  }

  /**
   * Find session by refresh token
   */
  static async findByRefreshToken(refreshToken) {
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    
    const result = await query(`
      SELECT s.*, u.* 
      FROM user_sessions s
      JOIN oauth_users u ON s.oauth_user_id = u.id
      WHERE s.refresh_token_hash = $1 AND s.expires_at > NOW()
    `, [refreshTokenHash]);

    return result.rows[0] || null;
  }

  /**
   * Update last used timestamp
   */
  static async updateLastUsed(sessionId) {
    await query(
      'UPDATE user_sessions SET last_used_at = NOW() WHERE id = $1',
      [sessionId]
    );
  }

  /**
   * Delete session (logout)
   */
  static async delete(sessionId) {
    await query('DELETE FROM user_sessions WHERE id = $1', [sessionId]);
  }

  /**
   * Delete session by refresh token
   */
  static async deleteByRefreshToken(refreshToken) {
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await query('DELETE FROM user_sessions WHERE refresh_token_hash = $1', [refreshTokenHash]);
  }

  /**
   * Delete all sessions for a user (logout everywhere)
   */
  static async deleteAllForUser(oauthUserId) {
    await query('DELETE FROM user_sessions WHERE oauth_user_id = $1', [oauthUserId]);
  }

  /**
   * Clean up expired sessions
   */
  static async cleanupExpired() {
    const result = await query('DELETE FROM user_sessions WHERE expires_at < NOW()');
    return result.rowCount;
  }
}

/**
 * User Request Model
 * Handles data deletion and export requests
 */
class UserRequest {
  /**
   * Create a new request
   */
  static async create(oauthUserId, requestType, reason = null) {
    // Check for existing pending request of same type
    const existing = await query(`
      SELECT * FROM user_requests 
      WHERE oauth_user_id = $1 AND request_type = $2 AND status = 'pending'
    `, [oauthUserId, requestType]);

    if (existing.rows.length > 0) {
      throw new Error(`You already have a pending ${requestType} request`);
    }

    const result = await query(`
      INSERT INTO user_requests (oauth_user_id, request_type, reason)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [oauthUserId, requestType, reason]);

    return result.rows[0];
  }

  /**
   * Get request by ID
   */
  static async getById(id) {
    const result = await query(`
      SELECT r.*, u.username, u.display_name, u.twitch_id, u.profile_image_url
      FROM user_requests r
      JOIN oauth_users u ON r.oauth_user_id = u.id
      WHERE r.id = $1
    `, [id]);
    return result.rows[0] || null;
  }

  /**
   * Get all requests for a user
   */
  static async getByUserId(oauthUserId) {
    const result = await query(`
      SELECT * FROM user_requests 
      WHERE oauth_user_id = $1
      ORDER BY created_at DESC
    `, [oauthUserId]);
    return result.rows;
  }

  /**
   * Get all pending requests (for admin)
   */
  static async getPending(requestType = null) {
    let sql = `
      SELECT r.*, u.username, u.display_name, u.twitch_id, u.profile_image_url
      FROM user_requests r
      JOIN oauth_users u ON r.oauth_user_id = u.id
      WHERE r.status = 'pending'
    `;
    const params = [];

    if (requestType) {
      sql += ' AND r.request_type = $1';
      params.push(requestType);
    }

    sql += ' ORDER BY r.created_at ASC';

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Get all requests (for admin) with pagination
   */
  static async getAll(limit = 50, offset = 0, status = null, requestType = null) {
    let sql = `
      SELECT r.*, u.username, u.display_name, u.twitch_id, u.profile_image_url
      FROM user_requests r
      JOIN oauth_users u ON r.oauth_user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status) {
      sql += ` AND r.status = $${paramIndex++}`;
      params.push(status);
    }

    if (requestType) {
      sql += ` AND r.request_type = $${paramIndex++}`;
      params.push(requestType);
    }

    sql += ` ORDER BY r.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    // Get total count
    let countSql = 'SELECT COUNT(*) FROM user_requests WHERE 1=1';
    const countParams = [];
    let countParamIndex = 1;

    if (status) {
      countSql += ` AND status = $${countParamIndex++}`;
      countParams.push(status);
    }
    if (requestType) {
      countSql += ` AND request_type = $${countParamIndex}`;
      countParams.push(requestType);
    }

    const countResult = await query(countSql, countParams);

    return {
      requests: result.rows,
      total: parseInt(countResult.rows[0].count),
      hasMore: offset + result.rows.length < parseInt(countResult.rows[0].count)
    };
  }

  /**
   * Approve a request
   */
  static async approve(requestId, adminUserId, adminNotes = null, downloadUrl = null) {
    const downloadExpiresAt = downloadUrl ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null;

    const result = await query(`
      UPDATE user_requests 
      SET status = 'approved', 
          processed_by = $2, 
          processed_at = NOW(), 
          admin_notes = $3,
          download_url = $4,
          download_expires_at = $5
      WHERE id = $1
      RETURNING *
    `, [requestId, adminUserId, adminNotes, downloadUrl, downloadExpiresAt]);

    return result.rows[0];
  }

  /**
   * Deny a request
   */
  static async deny(requestId, adminUserId, adminNotes = null) {
    const result = await query(`
      UPDATE user_requests 
      SET status = 'denied', 
          processed_by = $2, 
          processed_at = NOW(), 
          admin_notes = $3
      WHERE id = $1
      RETURNING *
    `, [requestId, adminUserId, adminNotes]);

    return result.rows[0];
  }

  /**
   * Mark request as completed
   */
  static async complete(requestId) {
    const result = await query(`
      UPDATE user_requests SET status = 'completed' WHERE id = $1 RETURNING *
    `, [requestId]);
    return result.rows[0];
  }

  /**
   * Cancel a pending request
   */
  static async cancel(requestId, oauthUserId) {
    const result = await query(`
      DELETE FROM user_requests 
      WHERE id = $1 AND oauth_user_id = $2 AND status = 'pending'
      RETURNING *
    `, [requestId, oauthUserId]);
    return result.rows[0];
  }
}

export { OAuthUser, UserSession, UserRequest };
