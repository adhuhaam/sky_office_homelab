import { pgTable, text, timestamp, json } from "drizzle-orm/pg-core";

export const sessionTable = pgTable("session", {
  sid: text("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6, withTimezone: false }).notNull(),
});
