-- Performance optimization indexes for studio pages
-- Migration: 0004_performance_indexes

-- Core user account queries optimization
CREATE INDEX IF NOT EXISTS idx_account_user_provider ON account(user_id, provider_id);
CREATE INDEX IF NOT EXISTS idx_account_user_provider_active ON account(user_id, provider_id, account_id);

-- Tweet queries optimization for published tweets
CREATE INDEX IF NOT EXISTS idx_tweets_user_published ON tweets(user_id, is_published, created_at DESC) WHERE is_published = true;

-- Tweet queries optimization for scheduled tweets  
CREATE INDEX IF NOT EXISTS idx_tweets_user_scheduled ON tweets(user_id, is_scheduled, scheduled_for) WHERE is_scheduled = true;

-- Account-specific tweet queries
CREATE INDEX IF NOT EXISTS idx_tweets_account_published ON tweets(account_id, is_published, created_at DESC) WHERE is_published = true;

-- Search optimization for tweet content
CREATE INDEX IF NOT EXISTS idx_tweets_content_search ON tweets USING gin(to_tsvector('english', content));

-- Composite index for complex queries combining user, account, and publication status
CREATE INDEX IF NOT EXISTS idx_tweets_user_account_published ON tweets(user_id, account_id, is_published, created_at DESC);

-- Index for scheduled tweets ordering
CREATE INDEX IF NOT EXISTS idx_tweets_scheduled_order ON tweets(is_scheduled, scheduled_for DESC) WHERE is_scheduled = true;