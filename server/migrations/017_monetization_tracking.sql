-- Migration: 017_monetization_tracking.sql
-- Track bits, subs, gift subs, and other monetization events for channels

-- Bits/Cheers table
CREATE TABLE IF NOT EXISTS channel_bits (
    id BIGSERIAL PRIMARY KEY,
    channel_id INT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bits_amount INT NOT NULL,
    message_text TEXT,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    message_id VARCHAR(100),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_channel_bits_channel ON channel_bits(channel_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_channel_bits_user ON channel_bits(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_channel_bits_amount ON channel_bits(channel_id, bits_amount DESC);

-- Subscriptions table (tracks sub, resub, gift sub events)
CREATE TABLE IF NOT EXISTS channel_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    channel_id INT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sub_type VARCHAR(50) NOT NULL, -- 'sub', 'resub', 'subgift', 'submysterygift', 'primepaidupgrade', 'giftpaidupgrade', 'anongiftpaidupgrade'
    tier VARCHAR(10) NOT NULL DEFAULT '1000', -- '1000' = Tier 1, '2000' = Tier 2, '3000' = Tier 3, 'Prime' for prime
    is_prime BOOLEAN DEFAULT FALSE,
    cumulative_months INT DEFAULT 1,
    streak_months INT,
    gift_recipient_id INT REFERENCES users(id) ON DELETE SET NULL, -- For gift subs
    gift_count INT DEFAULT 1, -- For mystery gifts, how many were gifted
    message_text TEXT, -- Sub message
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    message_id VARCHAR(100),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_channel_subs_channel ON channel_subscriptions(channel_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_channel_subs_user ON channel_subscriptions(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_channel_subs_type ON channel_subscriptions(channel_id, sub_type);
CREATE INDEX IF NOT EXISTS idx_channel_subs_gifter ON channel_subscriptions(user_id, gift_count DESC) WHERE sub_type IN ('subgift', 'submysterygift');
CREATE INDEX IF NOT EXISTS idx_channel_subs_recipient ON channel_subscriptions(gift_recipient_id, timestamp DESC);

-- Hype trains table
CREATE TABLE IF NOT EXISTS channel_hype_trains (
    id BIGSERIAL PRIMARY KEY,
    channel_id INT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    hype_train_id VARCHAR(100) NOT NULL,
    level INT NOT NULL DEFAULT 1,
    total_points INT NOT NULL DEFAULT 0,
    goal INT,
    top_contributions JSONB DEFAULT '[]', -- Array of {user_id, type, total}
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP,
    expires_at TIMESTAMP,
    is_golden_kappa BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_hype_trains_channel ON channel_hype_trains(channel_id, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hype_trains_id ON channel_hype_trains(hype_train_id);

-- Raids table
CREATE TABLE IF NOT EXISTS channel_raids (
    id BIGSERIAL PRIMARY KEY,
    channel_id INT NOT NULL REFERENCES channels(id) ON DELETE CASCADE, -- Channel being raided
    raider_channel_id INT REFERENCES channels(id) ON DELETE SET NULL, -- Channel doing the raid
    raider_name VARCHAR(100) NOT NULL,
    raider_display_name VARCHAR(100),
    viewer_count INT NOT NULL DEFAULT 0,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_raids_channel ON channel_raids(channel_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_raids_raider ON channel_raids(raider_channel_id, timestamp DESC);

-- Channel monetization summary (materialized view for quick stats)
CREATE MATERIALIZED VIEW IF NOT EXISTS channel_monetization_summary AS
SELECT
    c.id AS channel_id,
    c.name AS channel_name,
    -- Bits stats
    COALESCE(SUM(cb.bits_amount), 0) AS total_bits,
    COUNT(DISTINCT cb.id) AS total_bit_events,
    COUNT(DISTINCT cb.user_id) AS unique_bit_givers,
    -- Sub stats  
    COUNT(DISTINCT cs.id) FILTER (WHERE cs.sub_type = 'sub') AS total_new_subs,
    COUNT(DISTINCT cs.id) FILTER (WHERE cs.sub_type = 'resub') AS total_resubs,
    COUNT(DISTINCT cs.id) FILTER (WHERE cs.sub_type IN ('subgift', 'submysterygift')) AS total_gift_subs,
    COUNT(DISTINCT cs.id) FILTER (WHERE cs.is_prime = true) AS total_prime_subs,
    COALESCE(SUM(cs.gift_count) FILTER (WHERE cs.sub_type IN ('subgift', 'submysterygift')), 0) AS total_gifts_given,
    COUNT(DISTINCT cs.user_id) FILTER (WHERE cs.sub_type IN ('subgift', 'submysterygift')) AS unique_gifters,
    -- Hype train stats
    COUNT(DISTINCT ht.id) AS total_hype_trains,
    MAX(ht.level) AS max_hype_train_level,
    -- Raid stats
    COUNT(DISTINCT r.id) AS total_raids_received,
    COALESCE(SUM(r.viewer_count), 0) AS total_raid_viewers
FROM channels c
LEFT JOIN channel_bits cb ON c.id = cb.channel_id
LEFT JOIN channel_subscriptions cs ON c.id = cs.channel_id
LEFT JOIN channel_hype_trains ht ON c.id = ht.channel_id
LEFT JOIN channel_raids r ON c.id = r.channel_id
GROUP BY c.id, c.name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_monetization_summary_channel ON channel_monetization_summary(channel_id);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_monetization_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY channel_monetization_summary;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE channel_bits IS 'Tracks all bit/cheer events in monitored channels';
COMMENT ON TABLE channel_subscriptions IS 'Tracks subscription events including new subs, resubs, gifts, prime conversions';
COMMENT ON TABLE channel_hype_trains IS 'Tracks hype train events and their progress';
COMMENT ON TABLE channel_raids IS 'Tracks incoming raids to monitored channels';
COMMENT ON MATERIALIZED VIEW channel_monetization_summary IS 'Pre-computed monetization statistics per channel for quick access';
