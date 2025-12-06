-- Fix foreign key constraints to allow OAuth user deletion

-- Drop and recreate admin_webhooks.created_by with SET NULL on delete
ALTER TABLE admin_webhooks DROP CONSTRAINT IF EXISTS admin_webhooks_created_by_fkey;
ALTER TABLE admin_webhooks ADD CONSTRAINT admin_webhooks_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES oauth_users(id) ON DELETE SET NULL;

-- Drop and recreate user_requests.processed_by with SET NULL on delete
ALTER TABLE user_requests DROP CONSTRAINT IF EXISTS user_requests_processed_by_fkey;
ALTER TABLE user_requests ADD CONSTRAINT user_requests_processed_by_fkey 
  FOREIGN KEY (processed_by) REFERENCES oauth_users(id) ON DELETE SET NULL;
