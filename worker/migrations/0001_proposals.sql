CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  song_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS proposals_song_created
  ON proposals(song_id, created_at DESC);
