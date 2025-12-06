-- Migration: Add threading and reply support to messages
-- This enables conversation threading by tracking reply relationships and @mentions

-- Add threading columns to messages table
-- Note: reply_to_user_id stores the Twitch user ID (not our internal ID) since the user might not exist in our database
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_message_id VARCHAR(100);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_user_id INT;  -- Twitch user ID, no FK constraint
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_username VARCHAR(100);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS mentioned_users JSONB DEFAULT '[]';

-- Index for efficient thread lookups
CREATE INDEX IF NOT EXISTS idx_messages_reply_to_msg ON messages(reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_reply_to_user ON messages(reply_to_user_id) WHERE reply_to_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_mentioned_users ON messages USING GIN (mentioned_users) WHERE mentioned_users != '[]'::jsonb;

-- Function to get a thread (parent message + all replies)
CREATE OR REPLACE FUNCTION get_message_thread(
  target_message_id VARCHAR(100),
  max_replies INT DEFAULT 100
)
RETURNS TABLE (
  id BIGINT,
  channel_id INT,
  user_id INT,
  username VARCHAR,
  display_name VARCHAR,
  message_text TEXT,
  msg_timestamp TIMESTAMP,
  message_id VARCHAR,
  badges JSONB,
  emotes JSONB,
  is_deleted BOOLEAN,
  reply_to_message_id VARCHAR,
  reply_to_user_id INT,
  reply_to_username VARCHAR,
  is_parent BOOLEAN,
  reply_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH parent AS (
    -- Get the parent message (either the target or its parent if target is a reply)
    SELECT 
      COALESCE(msg.reply_to_message_id, msg.message_id) as root_message_id
    FROM messages msg
    WHERE msg.message_id = target_message_id
  ),
  thread_messages AS (
    -- Get the root message
    SELECT msg.*, TRUE as is_parent
    FROM messages msg
    WHERE msg.message_id = (SELECT root_message_id FROM parent)
    
    UNION ALL
    
    -- Get all replies to the root message (limited)
    SELECT msg.*, FALSE as is_parent
    FROM messages msg
    WHERE msg.reply_to_message_id = (SELECT root_message_id FROM parent)
      AND msg.is_deleted = FALSE
  )
  SELECT 
    tm.id,
    tm.channel_id,
    tm.user_id,
    u.username,
    u.display_name,
    tm.message_text,
    tm.timestamp as msg_timestamp,
    tm.message_id,
    tm.badges,
    tm.emotes,
    tm.is_deleted,
    tm.reply_to_message_id,
    tm.reply_to_user_id,
    tm.reply_to_username,
    tm.is_parent,
    (SELECT COUNT(*) FROM messages r WHERE r.reply_to_message_id = tm.message_id) as reply_count
  FROM thread_messages tm
  JOIN users u ON tm.user_id = u.id
  ORDER BY tm.is_parent DESC, tm.timestamp ASC
  LIMIT max_replies + 1;  -- +1 to account for the parent message
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get messages mentioning a specific user
CREATE OR REPLACE FUNCTION get_messages_mentioning_user(
  target_username VARCHAR,
  channel_id_param INT DEFAULT NULL,
  days_back INT DEFAULT 7,
  max_results INT DEFAULT 100
)
RETURNS TABLE (
  id BIGINT,
  channel_id INT,
  channel_name VARCHAR,
  user_id INT,
  username VARCHAR,
  display_name VARCHAR,
  message_text TEXT,
  msg_timestamp TIMESTAMP,
  message_id VARCHAR,
  badges JSONB,
  emotes JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.channel_id,
    c.name as channel_name,
    m.user_id,
    u.username,
    u.display_name,
    m.message_text,
    m.timestamp as msg_timestamp,
    m.message_id,
    m.badges,
    m.emotes
  FROM messages m
  JOIN users u ON m.user_id = u.id
  JOIN channels c ON m.channel_id = c.id
  WHERE (
    m.mentioned_users @> jsonb_build_array(LOWER(target_username))
    OR m.message_text ILIKE '%@' || target_username || '%'
  )
  AND (channel_id_param IS NULL OR m.channel_id = channel_id_param)
  AND m.timestamp > NOW() - (days_back || ' days')::INTERVAL
  AND m.is_deleted = FALSE
  ORDER BY m.timestamp DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to extract @mentions from message text (for backfilling)
CREATE OR REPLACE FUNCTION extract_mentions(message_text TEXT)
RETURNS JSONB AS $$
DECLARE
  mentions JSONB := '[]'::jsonb;
  mention TEXT;
BEGIN
  FOR mention IN
    SELECT DISTINCT LOWER(match[1])
    FROM regexp_matches(message_text, '@([a-zA-Z0-9_]{2,25})', 'g') as match
  LOOP
    mentions := mentions || jsonb_build_array(mention);
  END LOOP;
  RETURN mentions;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Backfill mentioned_users for existing messages (run in batches to avoid long locks)
-- This is commented out - run manually if needed for historical data
-- UPDATE messages 
-- SET mentioned_users = extract_mentions(message_text)
-- WHERE message_text LIKE '%@%' 
--   AND mentioned_users = '[]'::jsonb;
