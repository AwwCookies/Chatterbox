-- Migration: Add last_message column to mod_actions
-- This stores the message text at the time of the mod action
-- so historical mod actions show the correct context

ALTER TABLE mod_actions ADD COLUMN IF NOT EXISTS last_message TEXT;

-- Add a comment explaining the column
COMMENT ON COLUMN mod_actions.last_message IS 'The user''s last message at the time of the mod action (captured at action time for historical accuracy)';
