-- Migration: 016_webhook_enhancements.sql
-- Add muted flag and folder support for webhooks

-- Add muted column to user_webhooks (muted webhooks don't fire but keep config)
ALTER TABLE user_webhooks ADD COLUMN IF NOT EXISTS muted BOOLEAN DEFAULT FALSE;

-- Add folder column for organizing webhooks
ALTER TABLE user_webhooks ADD COLUMN IF NOT EXISTS folder VARCHAR(100) DEFAULT NULL;

-- Add muted column to admin_webhooks
ALTER TABLE admin_webhooks ADD COLUMN IF NOT EXISTS muted BOOLEAN DEFAULT FALSE;

-- Add folder column to admin_webhooks
ALTER TABLE admin_webhooks ADD COLUMN IF NOT EXISTS folder VARCHAR(100) DEFAULT NULL;

-- Create index on folder for filtering
CREATE INDEX IF NOT EXISTS idx_user_webhooks_folder ON user_webhooks(oauth_user_id, folder);
CREATE INDEX IF NOT EXISTS idx_admin_webhooks_folder ON admin_webhooks(folder);

-- Add comment
COMMENT ON COLUMN user_webhooks.muted IS 'When true, webhook is silenced but not deleted';
COMMENT ON COLUMN user_webhooks.folder IS 'Optional folder name for organizing webhooks';
COMMENT ON COLUMN admin_webhooks.muted IS 'When true, webhook is silenced but not deleted';
COMMENT ON COLUMN admin_webhooks.folder IS 'Optional folder name for organizing webhooks';
