import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const appSettingsTable = pgTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  appName: text("app_name").notNull().default("LEO OS"),
  accentHue: integer("accent_hue").notNull().default(162),
  companyName: text("company_name"),
  companyAddress: text("company_address"),
  companyPhone: text("company_phone"),
  companyEmail: text("company_email"),
  companyWebsite: text("company_website"),
  companyRegistrationNumber: text("company_registration_number"),
  logoImage: text("logo_image"),
  logoImageDark: text("logo_image_dark"),
  deepseekApiKey: text("deepseek_api_key"),
  deepseekOcrBaseUrl: text("deepseek_ocr_base_url"),
  deepseekOcrModel: text("deepseek_ocr_model"),
  passwordHash: text("password_hash"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type AppSettings = typeof appSettingsTable.$inferSelect;
