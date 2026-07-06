import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  boolean,
  numeric,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients.js";
import { companiesTable } from "./companies.js";

export const passportsTable = pgTable("passports", {
  id: serial("id").primaryKey(),
  fullName: text("full_name"),
  passportNumber: text("passport_number"),
  dateOfBirth: text("date_of_birth"),
  dateOfIssue: text("date_of_issue"),
  dateOfExpiry: text("date_of_expiry"),
  address: text("address"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  nationality: text("nationality"),
  status: text("status").notNull().default("processing"),
  submitted: boolean("submitted").notNull().default(false),
  errorMessage: text("error_message"),
  originalFilename: text("original_filename"),
  companyId: integer("company_id").references((): AnyPgColumn => companiesTable.id, {
    onDelete: "set null",
  }),
  clientId: integer("client_id").references((): AnyPgColumn => clientsTable.id, {
    onDelete: "set null",
  }),
  workPermitNumber: text("work_permit_number"),
  agent: text("agent"),
  agencySalary: numeric("agency_salary", { precision: 12, scale: 2 }),
  clientSalary: numeric("client_salary", { precision: 12, scale: 2 }),
  agentRate: numeric("agent_rate", { precision: 12, scale: 2 }),
  employeeType: text("employee_type").notNull().default("casual"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Passport = typeof passportsTable.$inferSelect;
