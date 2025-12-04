-- Twitch Chat Archive System - Initial Schema
-- Migration: 001_initial_schema.sql

-- Channels table
CREATE TABLE IF NOT EXISTS channels (
    id SERIAL PRIMARY KEY,
    twitch_id VARCHAR(50) UNIQUE,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    twitch_id VARCHAR(50) UNIQUE,
    username VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(100),
    first_seen TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_twitch_id ON users(twitch_id);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    channel_id INT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    message_id VARCHAR(100) UNIQUE,
    badges JSONB DEFAULT '[]',
    emotes JSONB DEFAULT '[]',
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by_id INT REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user_channel ON messages(user_id, channel_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_deleted ON messages(is_deleted, channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_message_id ON messages(message_id);
CREATE INDEX IF NOT EXISTS idx_messages_text_search ON messages USING gin(to_tsvector('english', message_text));

-- Mod Actions table
CREATE TABLE IF NOT EXISTS mod_actions (
    id BIGSERIAL PRIMARY KEY,
    channel_id INT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    moderator_id INT REFERENCES users(id),
    target_user_id INT NOT NULL REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL,
    duration_seconds INT,
    reason TEXT,
    timestamp TIMESTAMP NOT NULL,
    related_message_id BIGINT REFERENCES messages(id),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_mod_actions_target ON mod_actions(target_user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_mod_actions_moderator ON mod_actions(moderator_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_mod_actions_channel ON mod_actions(channel_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_mod_actions_type ON mod_actions(action_type, channel_id);
