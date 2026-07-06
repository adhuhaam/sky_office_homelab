import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const companiesTable = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  email: text("email"),
  phone: text("phone"),
  country: text("country"),
  registrationNumber: text("registration_number"),
  signatoryName: text("signatory_name"),
  signatoryDesignation: text("signatory_designation"),
  letterheadImage: text("letterhead_image"),
  signatureImage: text("signature_image"),
  invoiceLogoImage: text("invoice_logo_image"),
  bankName: text("bank_name"),
  bankAccountNumber: text("bank_account_number"),
  bankAccountHolder: text("bank_account_holder"),
  bankSwiftCode: text("bank_swift_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Company = typeof companiesTable.$inferSelect;
