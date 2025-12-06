-- User management features
-- Add blocked column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notes TEXT;

-- Index for blocked users
CREATE INDEX IF NOT EXISTS idx_users_is_blocked ON users(is_blocked) WHERE is_blocked = TRUE;

-- Function to get top users by message count
CREATE OR REPLACE FUNCTION get_top_users(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_channel_id INTEGER DEFAULT NULL,
  p_since TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_until TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  id INTEGER,
  username VARCHAR(100),
  display_name VARCHAR(100),
  twitch_id VARCHAR(50),
  first_seen TIMESTAMP,
  last_seen TIMESTAMP,
  is_blocked BOOLEAN,
  message_count BIGINT,
  timeout_count BIGINT,
  ban_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.username,
    u.display_name,
    u.twitch_id,
    u.first_seen,
    u.last_seen,
    u.is_blocked,
    COUNT(m.id)::BIGINT as message_count,
    COALESCE((SELECT COUNT(*) FROM mod_actions ma WHERE ma.target_user_id = u.id AND ma.action_type = 'timeout'), 0)::BIGINT as timeout_count,
    COALESCE((SELECT COUNT(*) FROM mod_actions ma WHERE ma.target_user_id = u.id AND ma.action_type = 'ban'), 0)::BIGINT as ban_count
  FROM users u
  LEFT JOIN messages m ON u.id = m.user_id
    AND (p_channel_id IS NULL OR m.channel_id = p_channel_id)
    AND (p_since IS NULL OR m.timestamp >= p_since)
    AND (p_until IS NULL OR m.timestamp <= p_until)
  GROUP BY u.id
  ORDER BY COUNT(m.id) DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;
