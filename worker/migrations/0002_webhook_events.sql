CREATE TABLE IF NOT EXISTS webhook_events (
  delivery_id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  received_at INTEGER NOT NULL
);
