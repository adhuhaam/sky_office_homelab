import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().default("agent"),
  passwordHash: text("password_hash"),
  isApproved: boolean("is_approved").notNull().default(false),
  isBlocked: boolean("is_blocked").notNull().default(false),
  linkedEntityId: text("linked_entity_id"),
  phone: text("phone"),
  designation: text("designation"),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
