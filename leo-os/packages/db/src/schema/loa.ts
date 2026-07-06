import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const loaTable = pgTable("loa_entries", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  passportId: integer("passport_id"),
  companyName: text("company_name"),
  companyAddress: text("company_address"),
  companyEmail: text("company_email"),
  companyPhone: text("company_phone"),
  companyCountry: text("company_country"),
  companyRegistrationNumber: text("company_registration_number"),
  candidateName: text("candidate_name"),
  candidateAddress: text("candidate_address"),
  candidateNationality: text("candidate_nationality"),
  candidateDateOfBirth: text("candidate_date_of_birth"),
  candidatePassportNumber: text("candidate_passport_number"),
  candidateEmergencyContact: text("candidate_emergency_contact"),
  jobTitle: text("job_title"),
  workType: text("work_type"),
  basicSalary: text("basic_salary"),
  salaryPaymentDate: text("salary_payment_date"),
  workSite: text("work_site"),
  dateOfCommence: text("date_of_commence"),
  jobDescription: text("job_description"),
  workingHours: text("working_hours"),
  workStatus: text("work_status"),
  contractDuration: text("contract_duration"),
  signatoryName: text("signatory_name"),
  signatoryDesignation: text("signatory_designation"),
  signatureDate: text("signature_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Loa = typeof loaTable.$inferSelect;
export type InsertLoa = typeof loaTable.$inferInsert;
