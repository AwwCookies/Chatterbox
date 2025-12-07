-- Migration: Add monetization webhook types
-- New webhook types: channel_bits, channel_subscription, channel_gift_sub, channel_raid

-- Add comments documenting the new webhook types and their config options
COMMENT ON TABLE user_webhooks IS 'User webhooks with types: tracked_user_message, mod_action, channel_live, channel_offline, channel_game_change, channel_bits, channel_subscription, channel_gift_sub, channel_raid';

-- The config JSON for monetization webhooks can include:
-- channel_bits: { channels: [], min_bits: 100 }
-- channel_subscription: { channels: [], sub_types: ['sub', 'resub', 'prime'], min_months: 0 }
-- channel_gift_sub: { channels: [], min_gift_count: 1 }
-- channel_raid: { channels: [], min_viewers: 10 }

-- No schema changes needed - we just use the existing webhook_type and config columns
-- This migration serves as documentation for the new webhook types
