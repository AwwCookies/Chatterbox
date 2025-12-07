-- Migration: 016_discord_oauth.sql
-- Description: Add Discord OAuth integration for automatic webhook creation

-- ============================================
-- UPDATE oauth_users TABLE FOR DISCORD
-- ============================================

-- Add Discord OAuth token storage and user info
ALTER TABLE oauth_users 
ADD COLUMN IF NOT EXISTS discord_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS discord_username VARCHAR(100),
ADD COLUMN IF NOT EXISTS discord_discriminator VARCHAR(10),
ADD COLUMN IF NOT EXISTS discord_avatar VARCHAR(100),
ADD COLUMN IF NOT EXISTS discord_access_token TEXT,
ADD COLUMN IF NOT EXISTS discord_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS discord_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS discord_connected_at TIMESTAMPTZ;

-- Index for Discord user lookup
CREATE INDEX IF NOT EXISTS idx_oauth_users_discord_id ON oauth_users(discord_id) WHERE discord_id IS NOT NULL;

-- ============================================
-- UPDATE user_webhooks TABLE FOR DISCORD
-- ============================================

-- Add Discord metadata for OAuth-created webhooks
ALTER TABLE user_webhooks
ADD COLUMN IF NOT EXISTS discord_guild_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS discord_guild_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS discord_channel_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS discord_channel_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS discord_webhook_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS created_via_oauth BOOLEAN DEFAULT FALSE;

-- Index for Discord webhooks
CREATE INDEX IF NOT EXISTS idx_user_webhooks_discord ON user_webhooks(discord_webhook_id) WHERE discord_webhook_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_webhooks_oauth_created ON user_webhooks(created_via_oauth) WHERE created_via_oauth = TRUE;

-- ============================================
-- USER DISCORD GUILDS CACHE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS user_discord_guilds (
    id SERIAL PRIMARY KEY,
    oauth_user_id INTEGER NOT NULL REFERENCES oauth_users(id) ON DELETE CASCADE,
    guild_id VARCHAR(50) NOT NULL,
    guild_name VARCHAR(100) NOT NULL,
    guild_icon VARCHAR(100),
    has_webhook_permission BOOLEAN NOT NULL DEFAULT FALSE,
    owner BOOLEAN NOT NULL DEFAULT FALSE,
    permissions VARCHAR(50),
    cached_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(oauth_user_id, guild_id)
);

CREATE INDEX IF NOT EXISTS idx_user_discord_guilds_user ON user_discord_guilds(oauth_user_id);
CREATE INDEX IF NOT EXISTS idx_user_discord_guilds_guild ON user_discord_guilds(guild_id);
CREATE INDEX IF NOT EXISTS idx_user_discord_guilds_permission ON user_discord_guilds(oauth_user_id, has_webhook_permission) 
    WHERE has_webhook_permission = TRUE;

-- ============================================
-- USER DISCORD CHANNELS CACHE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS user_discord_channels (
    id SERIAL PRIMARY KEY,
    oauth_user_id INTEGER NOT NULL REFERENCES oauth_users(id) ON DELETE CASCADE,
    guild_id VARCHAR(50) NOT NULL,
    channel_id VARCHAR(50) NOT NULL,
    channel_name VARCHAR(100) NOT NULL,
    channel_type INTEGER NOT NULL, -- 0 = GUILD_TEXT, 5 = GUILD_ANNOUNCEMENT
    position INTEGER NOT NULL DEFAULT 0,
    parent_id VARCHAR(50), -- Category parent
    parent_name VARCHAR(100), -- Category name
    cached_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(oauth_user_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_user_discord_channels_user ON user_discord_channels(oauth_user_id);
CREATE INDEX IF NOT EXISTS idx_user_discord_channels_guild ON user_discord_channels(oauth_user_id, guild_id);

-- ============================================
-- CLEANUP FUNCTION FOR STALE CACHE
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_discord_cache() RETURNS void AS $$
BEGIN
    -- Clean up Discord guilds/channels cache older than 1 hour
    DELETE FROM user_discord_guilds WHERE cached_at < NOW() - INTERVAL '1 hour';
    DELETE FROM user_discord_channels WHERE cached_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN oauth_users.discord_id IS 'Discord user ID';
COMMENT ON COLUMN oauth_users.discord_username IS 'Discord username (new format without discriminator for most users)';
COMMENT ON COLUMN oauth_users.discord_discriminator IS 'Discord discriminator (legacy, 0 for new usernames)';
COMMENT ON COLUMN oauth_users.discord_avatar IS 'Discord avatar hash for constructing avatar URL';
COMMENT ON COLUMN oauth_users.discord_access_token IS 'Discord OAuth2 access token';
COMMENT ON COLUMN oauth_users.discord_refresh_token IS 'Discord OAuth2 refresh token';
COMMENT ON COLUMN oauth_users.discord_token_expires_at IS 'When the Discord access token expires';
COMMENT ON COLUMN oauth_users.discord_connected_at IS 'When user connected their Discord account';

COMMENT ON COLUMN user_webhooks.discord_guild_id IS 'Discord server (guild) ID where webhook was created';
COMMENT ON COLUMN user_webhooks.discord_guild_name IS 'Discord server name at time of creation';
COMMENT ON COLUMN user_webhooks.discord_channel_id IS 'Discord channel ID where webhook was created';
COMMENT ON COLUMN user_webhooks.discord_channel_name IS 'Discord channel name at time of creation';
COMMENT ON COLUMN user_webhooks.discord_webhook_id IS 'Discord webhook ID for API operations';
COMMENT ON COLUMN user_webhooks.created_via_oauth IS 'TRUE if webhook was created via Discord OAuth, FALSE for manual paste';

COMMENT ON TABLE user_discord_guilds IS 'Cache of user Discord guilds for quick access, refreshed periodically';
COMMENT ON TABLE user_discord_channels IS 'Cache of Discord channels per guild, refreshed periodically';
