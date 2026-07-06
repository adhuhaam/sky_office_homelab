import { pgTable, text, serial, integer, numeric, date, timestamp } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { expenseCategoriesTable } from "./expense-categories.js";

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id")
    .notNull()
    .references((): AnyPgColumn => expenseCategoriesTable.id, { onDelete: "restrict" }),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  expenseDate: date("expense_date"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Expense = typeof expensesTable.$inferSelect;
