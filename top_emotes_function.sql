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
