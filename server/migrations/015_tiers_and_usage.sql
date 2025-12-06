-- Migration: 015_tiers_and_usage.sql
-- Description: Add user tiers system and API usage tracking

-- ============================================
-- TIERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tiers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Limits (-1 = unlimited)
    max_webhooks INTEGER NOT NULL DEFAULT 2,
    max_channels INTEGER NOT NULL DEFAULT 10,
    max_api_calls_per_minute INTEGER NOT NULL DEFAULT 30,
    max_search_results INTEGER NOT NULL DEFAULT 50,
    max_history_days INTEGER DEFAULT 7, -- NULL = unlimited
    
    -- Feature flags
    can_export BOOLEAN NOT NULL DEFAULT FALSE,
    can_use_websocket BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Pricing (for future Stripe integration)
    price_monthly DECIMAL(10, 2),
    price_yearly DECIMAL(10, 2),
    
    -- Meta
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure only one default tier
CREATE UNIQUE INDEX IF NOT EXISTS idx_tiers_single_default 
    ON tiers (is_default) WHERE is_default = TRUE;

-- ============================================
-- USER TIERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_tiers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES oauth_users(id) ON DELETE CASCADE,
    tier_id INTEGER NOT NULL REFERENCES tiers(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by VARCHAR(100), -- Admin username who assigned
    expires_at TIMESTAMP WITH TIME ZONE, -- NULL = never expires
    notes TEXT,
    
    UNIQUE(user_id) -- One tier per user
);

CREATE INDEX IF NOT EXISTS idx_user_tiers_user_id ON user_tiers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tiers_tier_id ON user_tiers(tier_id);
CREATE INDEX IF NOT EXISTS idx_user_tiers_expires_at ON user_tiers(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================
-- API USAGE TABLE (raw call logs)
-- ============================================
CREATE TABLE IF NOT EXISTS api_usage (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES oauth_users(id) ON DELETE SET NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for querying usage
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_usage_user_time ON api_usage(user_id, created_at DESC);

-- Partition-friendly index for cleanup
CREATE INDEX IF NOT EXISTS idx_api_usage_cleanup ON api_usage(created_at) WHERE created_at < NOW() - INTERVAL '90 days';

-- ============================================
-- USER USAGE STATS TABLE (aggregated)
-- ============================================
CREATE TABLE IF NOT EXISTS user_usage_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES oauth_users(id) ON DELETE CASCADE,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Counts
    total_api_calls INTEGER NOT NULL DEFAULT 0,
    total_search_queries INTEGER NOT NULL DEFAULT 0,
    total_exports INTEGER NOT NULL DEFAULT 0,
    
    -- Endpoint breakdown
    endpoint_counts JSONB DEFAULT '{}',
    
    -- Performance
    avg_response_time_ms DECIMAL(10, 2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_user_usage_stats_user_period ON user_usage_stats(user_id, period_start DESC);

-- ============================================
-- RATE LIMITING TABLE (sliding window)
-- ============================================
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES oauth_users(id) ON DELETE CASCADE,
    bucket_key VARCHAR(100) NOT NULL, -- e.g., 'api_calls', 'search', 'export'
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    
    UNIQUE(user_id, bucket_key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_user_key ON rate_limit_buckets(user_id, bucket_key);
CREATE INDEX IF NOT EXISTS idx_rate_limit_cleanup ON rate_limit_buckets(window_start);

-- ============================================
-- SEED DEFAULT TIERS
-- ============================================
INSERT INTO tiers (name, display_name, description, max_webhooks, max_channels, max_api_calls_per_minute, max_search_results, max_history_days, can_export, can_use_websocket, is_default, sort_order)
VALUES 
    ('free', 'Free', 'Basic access with limited features', 2, 10, 30, 50, 7, FALSE, TRUE, TRUE, 1),
    ('pro', 'Pro', 'Enhanced access for power users', 10, 50, 100, 500, 90, TRUE, TRUE, FALSE, 2),
    ('enterprise', 'Enterprise', 'Unlimited access for organizations', -1, -1, -1, -1, NULL, TRUE, TRUE, FALSE, 3)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    max_webhooks = EXCLUDED.max_webhooks,
    max_channels = EXCLUDED.max_channels,
    max_api_calls_per_minute = EXCLUDED.max_api_calls_per_minute,
    max_search_results = EXCLUDED.max_search_results,
    max_history_days = EXCLUDED.max_history_days,
    can_export = EXCLUDED.can_export,
    can_use_websocket = EXCLUDED.can_use_websocket,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get user's effective tier (with expiration check)
CREATE OR REPLACE FUNCTION get_user_tier(p_user_id INTEGER)
RETURNS TABLE (
    tier_id INTEGER,
    tier_name VARCHAR(50),
    display_name VARCHAR(100),
    max_webhooks INTEGER,
    max_channels INTEGER,
    max_api_calls_per_minute INTEGER,
    max_search_results INTEGER,
    max_history_days INTEGER,
    can_export BOOLEAN,
    can_use_websocket BOOLEAN,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_expired BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.name,
        t.display_name,
        t.max_webhooks,
        t.max_channels,
        t.max_api_calls_per_minute,
        t.max_search_results,
        t.max_history_days,
        t.can_export,
        t.can_use_websocket,
        ut.expires_at,
        CASE 
            WHEN ut.expires_at IS NOT NULL AND ut.expires_at < NOW() THEN TRUE
            ELSE FALSE
        END as is_expired
    FROM user_tiers ut
    JOIN tiers t ON t.id = ut.tier_id
    WHERE ut.user_id = p_user_id
    
    UNION ALL
    
    -- Fallback to default tier if no tier assigned or expired
    SELECT 
        t.id,
        t.name,
        t.display_name,
        t.max_webhooks,
        t.max_channels,
        t.max_api_calls_per_minute,
        t.max_search_results,
        t.max_history_days,
        t.can_export,
        t.can_use_websocket,
        NULL::TIMESTAMP WITH TIME ZONE,
        FALSE
    FROM tiers t
    WHERE t.is_default = TRUE
    AND NOT EXISTS (
        SELECT 1 FROM user_tiers ut 
        WHERE ut.user_id = p_user_id 
        AND (ut.expires_at IS NULL OR ut.expires_at >= NOW())
    )
    
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to increment rate limit counter
CREATE OR REPLACE FUNCTION increment_rate_limit(
    p_user_id INTEGER,
    p_bucket_key VARCHAR(100),
    p_window_minutes INTEGER DEFAULT 1
)
RETURNS INTEGER AS $$
DECLARE
    v_window_start TIMESTAMP WITH TIME ZONE;
    v_count INTEGER;
BEGIN
    -- Calculate window start (rounded to minute)
    v_window_start := date_trunc('minute', NOW());
    
    -- Upsert and return new count
    INSERT INTO rate_limit_buckets (user_id, bucket_key, window_start, count)
    VALUES (p_user_id, p_bucket_key, v_window_start, 1)
    ON CONFLICT (user_id, bucket_key, window_start)
    DO UPDATE SET count = rate_limit_buckets.count + 1
    RETURNING count INTO v_count;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get current rate limit count
CREATE OR REPLACE FUNCTION get_rate_limit_count(
    p_user_id INTEGER,
    p_bucket_key VARCHAR(100),
    p_window_minutes INTEGER DEFAULT 1
)
RETURNS INTEGER AS $$
DECLARE
    v_total INTEGER;
BEGIN
    SELECT COALESCE(SUM(count), 0) INTO v_total
    FROM rate_limit_buckets
    WHERE user_id = p_user_id
    AND bucket_key = p_bucket_key
    AND window_start >= NOW() - (p_window_minutes || ' minutes')::INTERVAL;
    
    RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate daily usage stats
CREATE OR REPLACE FUNCTION aggregate_daily_usage(p_date DATE DEFAULT CURRENT_DATE - 1)
RETURNS INTEGER AS $$
DECLARE
    v_rows_inserted INTEGER;
BEGIN
    INSERT INTO user_usage_stats (user_id, period_start, period_end, total_api_calls, total_search_queries, total_exports, endpoint_counts, avg_response_time_ms)
    SELECT 
        user_id,
        p_date::TIMESTAMP WITH TIME ZONE AS period_start,
        (p_date + 1)::TIMESTAMP WITH TIME ZONE AS period_end,
        COUNT(*) AS total_api_calls,
        COUNT(*) FILTER (WHERE endpoint LIKE '%/search%' OR endpoint LIKE '%/messages%') AS total_search_queries,
        COUNT(*) FILTER (WHERE endpoint LIKE '%/export%') AS total_exports,
        jsonb_object_agg(endpoint, endpoint_count) AS endpoint_counts,
        AVG(response_time_ms) AS avg_response_time_ms
    FROM (
        SELECT 
            user_id,
            endpoint,
            response_time_ms,
            COUNT(*) OVER (PARTITION BY user_id, endpoint) AS endpoint_count
        FROM api_usage
        WHERE created_at >= p_date::TIMESTAMP WITH TIME ZONE
        AND created_at < (p_date + 1)::TIMESTAMP WITH TIME ZONE
        AND user_id IS NOT NULL
    ) sub
    GROUP BY user_id
    ON CONFLICT (user_id, period_start) 
    DO UPDATE SET
        total_api_calls = EXCLUDED.total_api_calls,
        total_search_queries = EXCLUDED.total_search_queries,
        total_exports = EXCLUDED.total_exports,
        endpoint_counts = EXCLUDED.endpoint_counts,
        avg_response_time_ms = EXCLUDED.avg_response_time_ms;
    
    GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
    RETURN v_rows_inserted;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old api_usage records
CREATE OR REPLACE FUNCTION cleanup_old_api_usage(p_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM api_usage
    WHERE created_at < NOW() - (p_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old rate limit buckets
CREATE OR REPLACE FUNCTION cleanup_rate_limit_buckets()
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM rate_limit_buckets
    WHERE window_start < NOW() - INTERVAL '1 hour';
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER TO UPDATE updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_tiers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tiers_updated_at ON tiers;
CREATE TRIGGER trigger_tiers_updated_at
    BEFORE UPDATE ON tiers
    FOR EACH ROW
    EXECUTE FUNCTION update_tiers_updated_at();

-- ============================================
-- GRANT PERMISSIONS (if needed)
-- ============================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON tiers TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON user_tiers TO your_app_user;
-- GRANT SELECT, INSERT ON api_usage TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE ON user_usage_stats TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limit_buckets TO your_app_user;
