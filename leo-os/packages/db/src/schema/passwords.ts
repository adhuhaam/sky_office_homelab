import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies.js";

export const passwordsTable = pgTable(
  "passwords",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    efaasUsername: text("efaas_username").notNull().default(""),
    efaasPassword: text("efaas_password").notNull().default(""),
    gmailUsername: text("gmail_username").notNull().default(""),
    gmailPassword: text("gmail_password").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("passwords_company_id_idx").on(t.companyId)],
);

export type PasswordRecord = typeof passwordsTable.$inferSelect;
export type InsertPassword = typeof passwordsTable.$inferInsert;
