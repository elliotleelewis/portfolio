-- The whole board is one row, so reading it is one row read and saving a
-- score is one row write. See src/leaderboard/server.ts.
CREATE TABLE IF NOT EXISTS leaderboard (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	-- Goes up with every write, so two scores saved at once can't overwrite
	-- each other.
	version INTEGER NOT NULL DEFAULT 0,
	-- The day (UTC) the writes below were counted on.
	day TEXT NOT NULL DEFAULT '',
	writes INTEGER NOT NULL DEFAULT 0,
	-- The runs, best first, as JSON.
	entries TEXT NOT NULL DEFAULT '[]'
);

INSERT OR IGNORE INTO leaderboard (id) VALUES (1);
