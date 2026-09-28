DROP TABLE IF EXISTS entries;
--> statement-breakpoint
CREATE TABLE analysis_cache (
  ticker TEXT PRIMARY KEY NOT NULL,
  payload_json TEXT NOT NULL,
  as_of TEXT,
  fetched_at INTEGER NOT NULL
);
