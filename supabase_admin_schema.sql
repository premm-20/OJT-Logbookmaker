-- Supabase SQL Schema for User Login Tracking
-- Run this in your Supabase SQL Editor if you want database-level storage alongside local persistence.

CREATE TABLE IF NOT EXISTS user_logins (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  mobile TEXT NOT NULL,
  login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  device TEXT,
  browser TEXT
);

-- Index for speedy queries by login time and user
CREATE INDEX IF NOT EXISTS idx_user_logins_login_at ON user_logins (login_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_logins_email ON user_logins (email);
CREATE INDEX IF NOT EXISTS idx_user_logins_mobile ON user_logins (mobile);

-- Enable RLS (Row Level Security) and allow select/insert
ALTER TABLE user_logins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access to login logs"
  ON user_logins FOR SELECT
  USING (true);

CREATE POLICY "Allow anonymous insert access to login logs"
  ON user_logins FOR INSERT
  WITH CHECK (true);
