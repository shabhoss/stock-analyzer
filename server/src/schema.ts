import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const analysisCache = sqliteTable("analysis_cache", {
  ticker: text("ticker").primaryKey(),
  payloadJson: text("payload_json").notNull(),
  asOf: text("as_of"),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
});
