import pool from '../config/database.js';
import logger from '../utils/logger.js';

class ApiUsage {
  /**
   * Log an API call (async, non-blocking)
   */
  static async log(data) {
    const {
      userId,
      endpoint,
      method,
      statusCode,
      responseTimeMs,
      ipAddress,
      userAgent,
    } = data;

    try {
      await pool.query(`
        INSERT INTO api_usage (user_id, endpoint, method, status_code, response_time_ms, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [userId, endpoint, method, statusCode, responseTimeMs, ipAddress, userAgent]);
    } catch (error) {
      // Don't throw - we don't want usage logging to break requests
      logger.error('Error logging API usage:', error);
    }
  }

  /**
   * Get user's usage stats for a date range
   */
  static async getUserStats(userId, since, until) {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_calls,
        COUNT(*) FILTER (WHERE endpoint LIKE '%/search%' OR endpoint LIKE '%/messages%') as search_queries,
        COUNT(*) FILTER (WHERE endpoint LIKE '%/export%') as exports,
        AVG(response_time_ms)::INTEGER as avg_response_time,
        MIN(created_at) as first_call,
        MAX(created_at) as last_call
      FROM api_usage
      WHERE user_id = $1
        AND created_at >= $2
        AND created_at <= $3
    `, [userId, since, until]);

    return result.rows[0];
  }

  /**
   * Get user's usage breakdown by endpoint
   */
  static async getUserEndpointBreakdown(userId, since, until, limit = 20) {
    const result = await pool.query(`
      SELECT 
        endpoint,
        method,
        COUNT(*) as call_count,
        AVG(response_time_ms)::INTEGER as avg_response_time,
        COUNT(*) FILTER (WHERE status_code >= 400) as error_count
      FROM api_usage
      WHERE user_id = $1
        AND created_at >= $2
        AND created_at <= $3
      GROUP BY endpoint, method
      ORDER BY call_count DESC
      LIMIT $4
    `, [userId, since, until, limit]);

    return result.rows;
  }

  /**
   * Get user's usage over time (hourly or daily buckets)
   */
  static async getUserUsageOverTime(userId, since, until, bucket = 'hour') {
    const bucketExpression = bucket === 'day' 
      ? "date_trunc('day', created_at)" 
      : "date_trunc('hour', created_at)";

    const result = await pool.query(`
      SELECT 
        ${bucketExpression} as time_bucket,
        COUNT(*) as call_count,
        AVG(response_time_ms)::INTEGER as avg_response_time,
        COUNT(*) FILTER (WHERE status_code >= 400) as error_count
      FROM api_usage
      WHERE user_id = $1
        AND created_at >= $2
        AND created_at <= $3
      GROUP BY time_bucket
      ORDER BY time_bucket ASC
    `, [userId, since, until]);

    return result.rows;
  }

  /**
   * Get current rate limit count for user
   */
  static async getRateLimitCount(userId, bucketKey = 'api_calls', windowMinutes = 1) {
    const result = await pool.query(
      `SELECT get_rate_limit_count($1, $2, $3) as count`,
      [userId, bucketKey, windowMinutes]
    );
    return parseInt(result.rows[0].count) || 0;
  }

  /**
   * Increment rate limit counter
   */
  static async incrementRateLimit(userId, bucketKey = 'api_calls', windowMinutes = 1) {
    const result = await pool.query(
      `SELECT increment_rate_limit($1, $2, $3) as count`,
      [userId, bucketKey, windowMinutes]
    );
    return parseInt(result.rows[0].count) || 0;
  }

  /**
   * Get system-wide usage stats
   */
  static async getSystemStats(since, until) {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_calls,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(response_time_ms)::INTEGER as avg_response_time,
        COUNT(*) FILTER (WHERE status_code >= 400) as total_errors,
        COUNT(*) FILTER (WHERE status_code >= 500) as server_errors
      FROM api_usage
      WHERE created_at >= $1
        AND created_at <= $2
    `, [since, until]);

    return result.rows[0];
  }

  /**
   * Get top users by API calls
   */
  static async getTopUsers(since, until, limit = 20) {
    const result = await pool.query(`
      SELECT 
        au.user_id,
        ou.username,
        ou.display_name,
        ou.profile_image_url,
        ou.is_admin,
        COUNT(*) as call_count,
        AVG(au.response_time_ms)::INTEGER as avg_response_time,
        COUNT(*) FILTER (WHERE au.status_code >= 400) as error_count
      FROM api_usage au
      LEFT JOIN oauth_users ou ON ou.id = au.user_id
      WHERE au.created_at >= $1
        AND au.created_at <= $2
        AND au.user_id IS NOT NULL
      GROUP BY au.user_id, ou.username, ou.display_name, ou.profile_image_url, ou.is_admin
      ORDER BY call_count DESC
      LIMIT $3
    `, [since, until, limit]);

    return result.rows;
  }

  /**
   * Get most used endpoints
   */
  static async getTopEndpoints(since, until, limit = 20) {
    const result = await pool.query(`
      SELECT 
        endpoint,
        method,
        COUNT(*) as call_count,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(response_time_ms)::INTEGER as avg_response_time,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms)::INTEGER as p95_response_time,
        COUNT(*) FILTER (WHERE status_code >= 400) as error_count
      FROM api_usage
      WHERE created_at >= $1
        AND created_at <= $2
      GROUP BY endpoint, method
      ORDER BY call_count DESC
      LIMIT $3
    `, [since, until, limit]);

    return result.rows;
  }

  /**
   * Get system usage over time
   */
  static async getSystemUsageOverTime(since, until, bucket = 'hour') {
    const bucketExpression = bucket === 'day' 
      ? "date_trunc('day', created_at)" 
      : "date_trunc('hour', created_at)";

    const result = await pool.query(`
      SELECT 
        ${bucketExpression} as time_bucket,
        COUNT(*) as call_count,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(response_time_ms)::INTEGER as avg_response_time,
        COUNT(*) FILTER (WHERE status_code >= 400) as error_count
      FROM api_usage
      WHERE created_at >= $1
        AND created_at <= $2
      GROUP BY time_bucket
      ORDER BY time_bucket ASC
    `, [since, until]);

    return result.rows;
  }

  /**
   * Get response time distribution
   */
  static async getResponseTimeDistribution(since, until) {
    const result = await pool.query(`
      SELECT 
        CASE 
          WHEN response_time_ms < 100 THEN '< 100ms'
          WHEN response_time_ms < 500 THEN '100-500ms'
          WHEN response_time_ms < 1000 THEN '500ms-1s'
          WHEN response_time_ms < 5000 THEN '1-5s'
          ELSE '> 5s'
        END as bucket,
        COUNT(*) as count
      FROM api_usage
      WHERE created_at >= $1
        AND created_at <= $2
        AND response_time_ms IS NOT NULL
      GROUP BY bucket
      ORDER BY 
        CASE bucket
          WHEN '< 100ms' THEN 1
          WHEN '100-500ms' THEN 2
          WHEN '500ms-1s' THEN 3
          WHEN '1-5s' THEN 4
          ELSE 5
        END
    `, [since, until]);

    return result.rows;
  }

  /**
   * Get status code distribution
   */
  static async getStatusCodeDistribution(since, until) {
    const result = await pool.query(`
      SELECT 
        CASE 
          WHEN status_code >= 200 AND status_code < 300 THEN '2xx Success'
          WHEN status_code >= 300 AND status_code < 400 THEN '3xx Redirect'
          WHEN status_code >= 400 AND status_code < 500 THEN '4xx Client Error'
          WHEN status_code >= 500 THEN '5xx Server Error'
          ELSE 'Unknown'
        END as category,
        COUNT(*) as count
      FROM api_usage
      WHERE created_at >= $1
        AND created_at <= $2
      GROUP BY category
      ORDER BY count DESC
    `, [since, until]);

    return result.rows;
  }

  /**
   * Run daily aggregation
   */
  static async aggregateDaily(date) {
    const result = await pool.query(
      `SELECT aggregate_daily_usage($1) as rows_affected`,
      [date]
    );
    return parseInt(result.rows[0].rows_affected) || 0;
  }

  /**
   * Cleanup old usage records
   */
  static async cleanup(days = 90) {
    const result = await pool.query(
      `SELECT cleanup_old_api_usage($1) as deleted`,
      [days]
    );
    return parseInt(result.rows[0].deleted) || 0;
  }

  /**
   * Cleanup old rate limit buckets
   */
  static async cleanupRateLimits() {
    const result = await pool.query(
      `SELECT cleanup_rate_limit_buckets() as deleted`
    );
    return parseInt(result.rows[0].deleted) || 0;
  }

  /**
   * Get aggregated stats for a user
   */
  static async getAggregatedStats(userId, since, until) {
    const result = await pool.query(`
      SELECT 
        SUM(total_api_calls) as total_api_calls,
        SUM(total_search_queries) as total_search_queries,
        SUM(total_exports) as total_exports,
        AVG(avg_response_time_ms)::INTEGER as avg_response_time
      FROM user_usage_stats
      WHERE user_id = $1
        AND period_start >= $2
        AND period_end <= $3
    `, [userId, since, until]);

    return result.rows[0];
  }

  /**
   * Get daily aggregated stats for a user
   */
  static async getDailyStats(userId, since, until) {
    const result = await pool.query(`
      SELECT 
        period_start::DATE as date,
        total_api_calls,
        total_search_queries,
        total_exports,
        avg_response_time_ms,
        endpoint_counts
      FROM user_usage_stats
      WHERE user_id = $1
        AND period_start >= $2
        AND period_end <= $3
      ORDER BY period_start ASC
    `, [userId, since, until]);

    return result.rows;
  }
}

export default ApiUsage;
