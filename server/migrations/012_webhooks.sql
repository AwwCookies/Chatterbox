-- Discord Webhooks for user notifications
CREATE TABLE IF NOT EXISTS user_webhooks (
    id SERIAL PRIMARY KEY,
    oauth_user_id INTEGER NOT NULL REFERENCES oauth_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    webhook_url TEXT NOT NULL,
    webhook_type VARCHAR(50) NOT NULL CHECK (webhook_type IN (
        'tracked_user_message',
        'mod_action',
        'channel_live',
        'channel_offline',
        'channel_game_change'
    )),
    -- Configuration (JSON) - varies by type
    -- For tracked_user_message: { "tracked_usernames": ["user1", "user2"] }
    -- For mod_action: { "action_types": ["ban", "timeout"], "channels": ["channel1"] or null for all }
    -- For channel events: { "channels": ["channel1", "channel2"] or null for all }
    config JSONB NOT NULL DEFAULT '{}',
    -- Customization
    embed_color VARCHAR(7) DEFAULT '#5865F2', -- Discord blurple default
    custom_username VARCHAR(80), -- Custom bot name for webhook
    custom_avatar_url TEXT, -- Custom avatar URL
    include_timestamp BOOLEAN DEFAULT TRUE,
    -- Status
    enabled BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMPTZ,
    trigger_count INTEGER DEFAULT 0,
    last_error TEXT,
    consecutive_failures INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin webhooks for system events
CREATE TABLE IF NOT EXISTS admin_webhooks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    webhook_url TEXT NOT NULL,
    webhook_type VARCHAR(50) NOT NULL CHECK (webhook_type IN (
        'user_signup',
        'data_request',
        'system_event',
        'error_alert'
    )),
    config JSONB NOT NULL DEFAULT '{}',
    embed_color VARCHAR(7) DEFAULT '#ED4245', -- Discord red for admin alerts
    custom_username VARCHAR(80) DEFAULT 'Chatterbox Admin',
    custom_avatar_url TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMPTZ,
    trigger_count INTEGER DEFAULT 0,
    last_error TEXT,
    consecutive_failures INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES oauth_users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook delivery log (for debugging)
CREATE TABLE IF NOT EXISTS webhook_logs (
    id SERIAL PRIMARY KEY,
    webhook_id INTEGER, -- Can be null if webhook deleted
    webhook_table VARCHAR(20) NOT NULL CHECK (webhook_table IN ('user_webhooks', 'admin_webhooks')),
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    delivery_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_webhooks_oauth_user ON user_webhooks(oauth_user_id);
CREATE INDEX IF NOT EXISTS idx_user_webhooks_type ON user_webhooks(webhook_type);
CREATE INDEX IF NOT EXISTS idx_user_webhooks_enabled ON user_webhooks(enabled) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_admin_webhooks_type ON admin_webhooks(webhook_type);
CREATE INDEX IF NOT EXISTS idx_admin_webhooks_enabled ON admin_webhooks(enabled) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook ON webhook_logs(webhook_id, webhook_table);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON webhook_logs(created_at);

-- Clean up old webhook logs (keep last 7 days)
CREATE OR REPLACE FUNCTION cleanup_webhook_logs() RETURNS void AS $$
BEGIN
    DELETE FROM webhook_logs WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
