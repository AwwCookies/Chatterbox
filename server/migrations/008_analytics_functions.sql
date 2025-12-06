-- Analytics functions for channel statistics
-- These functions efficiently compute aggregations for charting

-- Function to get hourly message counts for a channel over a time period
CREATE OR REPLACE FUNCTION get_channel_hourly_messages(
  channel_id_param INT,
  hours_back INT DEFAULT 24
)
RETURNS TABLE (
  hour TIMESTAMP,
  message_count BIGINT,
  unique_users BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    date_trunc('hour', m.timestamp) as hour,
    COUNT(*) as message_count,
    COUNT(DISTINCT m.user_id) as unique_users
  FROM messages m
  WHERE m.channel_id = channel_id_param
    AND m.timestamp > NOW() - (hours_back || ' hours')::INTERVAL
    AND m.is_deleted = FALSE
  GROUP BY date_trunc('hour', m.timestamp)
  ORDER BY hour DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get daily message counts for a channel
CREATE OR REPLACE FUNCTION get_channel_daily_messages(
  channel_id_param INT,
  days_back INT DEFAULT 30
)
RETURNS TABLE (
  day DATE,
  message_count BIGINT,
  unique_users BIGINT,
  avg_messages_per_user NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.timestamp::DATE as day,
    COUNT(*) as message_count,
    COUNT(DISTINCT m.user_id) as unique_users,
    ROUND(CAST(COUNT(*) AS NUMERIC) / NULLIF(COUNT(DISTINCT m.user_id), 0), 2) as avg_messages_per_user
  FROM messages m
  WHERE m.channel_id = channel_id_param
    AND m.timestamp > NOW() - (days_back || ' days')::INTERVAL
    AND m.is_deleted = FALSE
  GROUP BY m.timestamp::DATE
  ORDER BY day DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get top chatters for a channel in a time period
CREATE OR REPLACE FUNCTION get_channel_top_users(
  channel_id_param INT,
  days_back INT DEFAULT 7,
  limit_count INT DEFAULT 20
)
RETURNS TABLE (
  username VARCHAR,
  display_name VARCHAR,
  message_count BIGINT,
  unique_days BIGINT,
  avg_messages_per_day NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.username,
    u.display_name,
    COUNT(*) as message_count,
    COUNT(DISTINCT m.timestamp::DATE) as unique_days,
    ROUND(CAST(COUNT(*) AS NUMERIC) / NULLIF(COUNT(DISTINCT m.timestamp::DATE), 0), 2) as avg_messages_per_day
  FROM messages m
  JOIN users u ON m.user_id = u.id
  WHERE m.channel_id = channel_id_param
    AND m.timestamp > NOW() - (days_back || ' days')::INTERVAL
    AND m.is_deleted = FALSE
  GROUP BY u.id, u.username, u.display_name
  ORDER BY message_count DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get chat activity by hour of day (for heatmap)
CREATE OR REPLACE FUNCTION get_channel_hourly_distribution(
  channel_id_param INT,
  days_back INT DEFAULT 30
)
RETURNS TABLE (
  hour_of_day INT,
  day_of_week INT,
  message_count BIGINT,
  avg_messages NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXTRACT(HOUR FROM m.timestamp)::INT as hour_of_day,
    EXTRACT(DOW FROM m.timestamp)::INT as day_of_week,
    COUNT(*) as message_count,
    ROUND(CAST(COUNT(*) AS NUMERIC) / (days_back::NUMERIC / 7), 2) as avg_messages
  FROM messages m
  WHERE m.channel_id = channel_id_param
    AND m.timestamp > NOW() - (days_back || ' days')::INTERVAL
    AND m.is_deleted = FALSE
  GROUP BY EXTRACT(HOUR FROM m.timestamp), EXTRACT(DOW FROM m.timestamp)
  ORDER BY day_of_week, hour_of_day;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get mod action trends
CREATE OR REPLACE FUNCTION get_channel_mod_action_trends(
  channel_id_param INT,
  days_back INT DEFAULT 30
)
RETURNS TABLE (
  action_type VARCHAR,
  total_count BIGINT,
  today_count BIGINT,
  week_avg NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH action_stats AS (
    SELECT
      ma.action_type,
      COUNT(*) as total_count,
      COUNT(*) FILTER (WHERE ma.timestamp::DATE = CURRENT_DATE) as today_count,
      COUNT(*) FILTER (WHERE ma.timestamp > NOW() - INTERVAL '7 days') as week_count
    FROM mod_actions ma
    WHERE ma.channel_id = channel_id_param
      AND ma.timestamp > NOW() - (days_back || ' days')::INTERVAL
    GROUP BY ma.action_type
  )
  SELECT
    action_stats.action_type,
    action_stats.total_count,
    action_stats.today_count,
    ROUND(CAST(action_stats.week_count AS NUMERIC) / 7, 2) as week_avg
  FROM action_stats
  ORDER BY action_stats.total_count DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get engagement metrics
CREATE OR REPLACE FUNCTION get_channel_engagement_metrics(
  channel_id_param INT,
  days_back INT DEFAULT 30
)
RETURNS TABLE (
  metric_name VARCHAR,
  value NUMERIC,
  previous_period NUMERIC,
  percent_change NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH current_period AS (
    SELECT
      COUNT(*) as total_messages,
      COUNT(DISTINCT m.user_id) as unique_users,
      COUNT(*) FILTER (WHERE m.timestamp::DATE = CURRENT_DATE) as today_messages
    FROM messages m
    WHERE m.channel_id = channel_id_param
      AND m.timestamp > NOW() - (days_back || ' days')::INTERVAL
      AND m.is_deleted = FALSE
  ),
  previous_period AS (
    SELECT
      COUNT(*) as total_messages,
      COUNT(DISTINCT m.user_id) as unique_users,
      COUNT(*) FILTER (WHERE m.timestamp::DATE = (CURRENT_DATE - (days_back || ' days')::INTERVAL)::DATE) as today_messages
    FROM messages m
    WHERE m.channel_id = channel_id_param
      AND m.timestamp > NOW() - ((days_back * 2) || ' days')::INTERVAL
      AND m.timestamp <= NOW() - (days_back || ' days')::INTERVAL
      AND m.is_deleted = FALSE
  )
  SELECT
    'Total Messages'::VARCHAR as metric_name,
    ROUND(cp.total_messages::NUMERIC, 0) as value,
    ROUND(pp.total_messages::NUMERIC, 0) as previous_period,
    ROUND(((cp.total_messages - pp.total_messages)::NUMERIC / NULLIF(pp.total_messages, 0)) * 100, 2) as percent_change
  FROM current_period cp, previous_period pp
  UNION ALL
  SELECT
    'Unique Users'::VARCHAR,
    ROUND(cp.unique_users::NUMERIC, 0),
    ROUND(pp.unique_users::NUMERIC, 0),
    ROUND(((cp.unique_users - pp.unique_users)::NUMERIC / NULLIF(pp.unique_users, 0)) * 100, 2)
  FROM current_period cp, previous_period pp;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get user retention metrics
CREATE OR REPLACE FUNCTION get_channel_user_retention(
  channel_id_param INT,
  period_days INT DEFAULT 30
)
RETURNS TABLE (
  cohort_date DATE,
  cohort_size INT,
  day_1_retention NUMERIC,
  day_7_retention NUMERIC,
  day_30_retention NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH first_appearance AS (
    SELECT
      u.id,
      MIN(m.timestamp)::DATE as first_date
    FROM messages m
    JOIN users u ON m.user_id = u.id
    WHERE m.channel_id = channel_id_param
      AND m.timestamp > NOW() - ((period_days * 2) || ' days')::INTERVAL
    GROUP BY u.id
  ),
  cohorts AS (
    SELECT
      fa.first_date as cohort_date,
      COUNT(*) as cohort_size,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM messages m
        WHERE m.user_id = fa.id
        AND m.channel_id = channel_id_param
        AND m.timestamp::DATE = fa.first_date + 1
      )) as day_1_users,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM messages m
        WHERE m.user_id = fa.id
        AND m.channel_id = channel_id_param
        AND m.timestamp::DATE = fa.first_date + 7
      )) as day_7_users,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM messages m
        WHERE m.user_id = fa.id
        AND m.channel_id = channel_id_param
        AND m.timestamp::DATE = fa.first_date + 30
      )) as day_30_users
    FROM first_appearance fa
    WHERE fa.first_date > NOW()::DATE - (period_days || ' days')::INTERVAL
    GROUP BY fa.first_date
  )
  SELECT
    cohort_date,
    cohort_size,
    ROUND(CAST(day_1_users AS NUMERIC) / NULLIF(cohort_size, 0) * 100, 2) as day_1_retention,
    ROUND(CAST(day_7_users AS NUMERIC) / NULLIF(cohort_size, 0) * 100, 2) as day_7_retention,
    ROUND(CAST(day_30_users AS NUMERIC) / NULLIF(cohort_size, 0) * 100, 2) as day_30_retention
  FROM cohorts
  ORDER BY cohort_date DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get top emotes used in a channel
CREATE OR REPLACE FUNCTION get_channel_top_emotes(
  channel_id_param INT,
  days_back INT DEFAULT 30,
  limit_count INT DEFAULT 20
)
RETURNS TABLE (
  emote_id VARCHAR,
  emote_name VARCHAR,
  emote_code VARCHAR,
  usage_count BIGINT,
  unique_users BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH emote_usage AS (
    SELECT
      (e->>'id')::VARCHAR as emote_id,
      (e->>'name')::VARCHAR as emote_name,
      (e->>'code')::VARCHAR as emote_code,
      COUNT(*) as usage_count,
      COUNT(DISTINCT m.user_id) as unique_users
    FROM messages m
    CROSS JOIN LATERAL jsonb_array_elements(m.emotes) as e
    WHERE m.channel_id = channel_id_param
      AND m.timestamp > NOW() - (days_back || ' days')::INTERVAL
      AND m.is_deleted = FALSE
      AND m.emotes IS NOT NULL
      AND jsonb_array_length(m.emotes) > 0
    GROUP BY e->>'id', e->>'name', e->>'code'
  )
  SELECT
    emote_usage.emote_id,
    emote_usage.emote_name,
    emote_usage.emote_code,
    emote_usage.usage_count,
    emote_usage.unique_users
  FROM emote_usage
  WHERE emote_usage.emote_id IS NOT NULL
  ORDER BY emote_usage.usage_count DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_channel_timestamp ON messages(channel_id, timestamp DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_messages_user_channel_timestamp ON messages(user_id, channel_id, timestamp) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_mod_actions_channel_timestamp ON mod_actions(channel_id, timestamp DESC);
