import { pgTable, text, serial, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies.js";

export const LOA_OPTION_CATEGORIES = ["work_type", "work_site", "job_title"] as const;
export type LoaOptionCategory = (typeof LOA_OPTION_CATEGORIES)[number];

export const loaOptionsTable = pgTable(
  "loa_options",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    value: text("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("loa_options_company_category_value_idx").on(
      t.companyId,
      t.category,
      t.value,
    ),
  ],
);

export type LoaOption = typeof loaOptionsTable.$inferSelect;
export type InsertLoaOption = typeof loaOptionsTable.$inferInsert;
