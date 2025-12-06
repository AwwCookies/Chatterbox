-- OAuth user accounts (logged-in Twitch users)
CREATE TABLE IF NOT EXISTS oauth_users (
    id SERIAL PRIMARY KEY,
    twitch_id VARCHAR(50) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    display_name VARCHAR(100),
    email VARCHAR(255),
    profile_image_url TEXT,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ NOT NULL,
    scopes TEXT[], -- Array of granted scopes
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ DEFAULT NOW()
);

-- User data requests (deletion, export)
CREATE TABLE IF NOT EXISTS user_requests (
    id SERIAL PRIMARY KEY,
    oauth_user_id INTEGER NOT NULL REFERENCES oauth_users(id) ON DELETE CASCADE,
    request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('delete', 'export')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'completed')),
    reason TEXT, -- User's reason for request
    admin_notes TEXT, -- Admin notes on decision
    processed_by INTEGER REFERENCES oauth_users(id), -- Admin who processed
    processed_at TIMESTAMPTZ,
    download_url TEXT, -- For export requests, the download URL
    download_expires_at TIMESTAMPTZ, -- When download expires
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table for JWT refresh tokens
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    oauth_user_id INTEGER NOT NULL REFERENCES oauth_users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of refresh token
    user_agent TEXT,
    ip_address VARCHAR(45),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_oauth_users_twitch_id ON oauth_users(twitch_id);
CREATE INDEX IF NOT EXISTS idx_oauth_users_username ON oauth_users(username);
CREATE INDEX IF NOT EXISTS idx_user_requests_oauth_user ON user_requests(oauth_user_id);
CREATE INDEX IF NOT EXISTS idx_user_requests_status ON user_requests(status);
CREATE INDEX IF NOT EXISTS idx_user_requests_type_status ON user_requests(request_type, status);
CREATE INDEX IF NOT EXISTS idx_user_sessions_oauth_user ON user_sessions(oauth_user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_token ON user_sessions(refresh_token_hash);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_requests_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_requests
DROP TRIGGER IF EXISTS update_user_requests_timestamp ON user_requests;
CREATE TRIGGER update_user_requests_timestamp
    BEFORE UPDATE ON user_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_user_requests_timestamp();
