import {
  pgTable,
  text,
  serial,
  integer,
  numeric,
  date,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies.js";
import { clientsTable } from "./clients.js";

export const billingDocumentsTable = pgTable(
  "billing_documents",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(),
    number: text("number").notNull(),
    companyId: integer("company_id")
      .notNull()
      .references((): AnyPgColumn => companiesTable.id, { onDelete: "restrict" }),
    clientId: integer("client_id").references((): AnyPgColumn => clientsTable.id, {
      onDelete: "set null",
    }),
    customerName: text("customer_name").notNull(),
    customerAddress: text("customer_address"),
    customerTin: text("customer_tin"),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date"),
    terms: text("terms"),
    gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    gstInclusive: boolean("gst_inclusive").notNull().default(true),
    notes: text("notes"),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("billing_documents_kind_number_unique").on(t.kind, t.number),
    index("billing_documents_kind_created_at_idx").on(t.kind, t.createdAt),
  ],
);

export const billingItemsTable = pgTable(
  "billing_items",
  {
    id: serial("id").primaryKey(),
    documentId: integer("document_id")
      .notNull()
      .references((): AnyPgColumn => billingDocumentsTable.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    description: text("description").notNull(),
    detail: text("detail"),
    qty: numeric("qty", { precision: 14, scale: 4 }).notNull().default("1"),
    rate: numeric("rate", { precision: 14, scale: 4 }).notNull().default("0"),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
  },
  (t) => [index("billing_items_document_id_idx").on(t.documentId)],
);

export type BillingDocument = typeof billingDocumentsTable.$inferSelect;
export type BillingItem = typeof billingItemsTable.$inferSelect;
