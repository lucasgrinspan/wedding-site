-- Cloudflare D1 Schema for Wedding RSVP Pipeline
-- Append-only audit log of every RSVP submission (never updated/deleted except email delivery flags)
CREATE TABLE IF NOT EXISTS rsvp_submissions (
  id TEXT PRIMARY KEY,
  party_key TEXT NOT NULL,
  submitted_by TEXT,
  party_json TEXT NOT NULL,
  accepting_count INTEGER NOT NULL DEFAULT 0,
  declining_count INTEGER NOT NULL DEFAULT 0,
  dietary TEXT,
  email TEXT,
  email_valid INTEGER NOT NULL DEFAULT 0,
  lang TEXT NOT NULL DEFAULT 'en',
  extras_json TEXT,
  is_test INTEGER NOT NULL DEFAULT 0,
  notification_sent INTEGER NOT NULL DEFAULT 0,
  notification_error TEXT,
  notification_attempts INTEGER NOT NULL DEFAULT 0,
  confirmation_sent INTEGER,
  confirmation_error TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rsvp_submissions_party_key
  ON rsvp_submissions(party_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rsvp_submissions_pending_notify
  ON rsvp_submissions(notification_sent, is_test, notification_attempts);

-- Materialized latest RSVP response per invited party
CREATE TABLE IF NOT EXISTS party_rsvp_latest (
  party_key TEXT PRIMARY KEY,
  latest_submission_id TEXT NOT NULL,
  revision_count INTEGER NOT NULL DEFAULT 1,
  submitted_by TEXT,
  party_json TEXT NOT NULL,
  accepting_count INTEGER NOT NULL DEFAULT 0,
  declining_count INTEGER NOT NULL DEFAULT 0,
  dietary TEXT,
  email TEXT,
  lang TEXT NOT NULL DEFAULT 'en',
  extras_json TEXT,
  is_test INTEGER NOT NULL DEFAULT 0,
  first_submitted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Diagnostic log of 404 name lookups so hosts can spot invited guests having trouble matching
CREATE TABLE IF NOT EXISTS lookup_misses (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lookup_misses_created_at
  ON lookup_misses(created_at DESC);
