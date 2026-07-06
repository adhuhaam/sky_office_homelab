import {
  pgTable,
  serial,
  integer,
  numeric,
  text,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { billingDocumentsTable } from "./billing.js";
import { passportsTable } from "./passports.js";

export const salaryRecordsTable = pgTable(
  "salary_records",
  {
    id: serial("id").primaryKey(),
    employeeName: text("employee_name").notNull(),
    passportId: integer("passport_id").references((): AnyPgColumn => passportsTable.id, {
      onDelete: "set null",
    }),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    basicSalary: numeric("basic_salary", { precision: 14, scale: 2 }).notNull().default("0"),
    foodAllowance: numeric("food_allowance", { precision: 14, scale: 2 }).notNull().default("0"),
    transportAllowance: numeric("transport_allowance", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    otherAllowances: numeric("other_allowances", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    deductions: numeric("deductions", { precision: 14, scale: 2 }).notNull().default("0"),
    otherExpenses: numeric("other_expenses", { precision: 14, scale: 2 }).notNull().default("0"),
    netSalary: numeric("net_salary", { precision: 14, scale: 2 }).notNull().default("0"),
    clientSalary: numeric("client_salary", { precision: 14, scale: 2 }).notNull().default("0"),
    invoiceId: integer("invoice_id").references((): AnyPgColumn => billingDocumentsTable.id, {
      onDelete: "set null",
    }),
    daysWorked: integer("days_worked").notNull().default(0),
    notes: text("notes"),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("salary_records_employee_month_year_unique").on(
      t.employeeName,
      t.month,
      t.year,
    ),
    index("salary_records_invoice_id_idx").on(t.invoiceId),
  ],
);

export type SalaryRecord = typeof salaryRecordsTable.$inferSelect;
