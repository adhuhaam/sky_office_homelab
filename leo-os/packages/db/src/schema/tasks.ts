import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  date,
} from "drizzle-orm/pg-core";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("medium"),
  dueDate: date("due_date"),
  parentId: integer("parent_id"),
  position: integer("position").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type TaskRecord = typeof tasksTable.$inferSelect;
export type InsertTask = typeof tasksTable.$inferInsert;
