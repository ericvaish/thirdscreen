CREATE TABLE IF NOT EXISTS rss_feeds (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  title TEXT,
  site_url TEXT,
  last_fetched_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rss_feeds_user ON rss_feeds(user_id);

CREATE TABLE IF NOT EXISTS rss_articles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  feed_id TEXT NOT NULL REFERENCES rss_feeds(id) ON DELETE CASCADE,
  guid TEXT NOT NULL,
  title TEXT NOT NULL,
  link TEXT,
  pub_date TEXT,
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rss_articles_feed ON rss_articles(feed_id);
CREATE INDEX IF NOT EXISTS idx_rss_articles_user ON rss_articles(user_id);
