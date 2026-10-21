CREATE TABLE IF NOT EXISTS comments (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	post_slug TEXT NOT NULL,
	author TEXT NOT NULL,
	body TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'pending'
		CONSTRAINT comments_status_check
		CHECK (status IN ('pending', 'approved', 'spam', 'deleted')),
	ip_hash TEXT,
	created_at TEXT NOT NULL
		CONSTRAINT comments_created_at_default
		DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_comments_post
	ON comments (post_slug, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_ip
	ON comments (ip_hash, created_at DESC);
