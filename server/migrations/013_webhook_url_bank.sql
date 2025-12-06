-- 013: Webhook URL Bank
-- Allows users to save and reuse Discord webhook URLs

CREATE TABLE IF NOT EXISTS webhook_urls (
    id SERIAL PRIMARY KEY,
    oauth_user_id INTEGER NOT NULL REFERENCES oauth_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    webhook_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    UNIQUE(oauth_user_id, webhook_url)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_webhook_urls_user ON webhook_urls(oauth_user_id);
