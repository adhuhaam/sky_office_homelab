import { eq, count, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  rolePermissionsTable,
  expenseCategoriesTable,
  companiesTable,
  appSettingsTable,
} from "@leo/db";
import { hashPassword } from "./crypto.js";
import { DEFAULT_ROLE_PERMISSIONS } from "./default-permissions.js";

export async function bootstrap(): Promise<void> {
  await ensureSchemaExtensions();
  await seedAppSettings();
  await seedSuperuser();
  await seedRolePermissions();
  await seedExpenseCategories();
  await seedIssuerCompany();
}

async function ensureSchemaExtensions(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS extension_token TEXT
  `);
  await db.execute(sql`
    ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS password_hash TEXT
  `);
  await db.execute(sql`
    ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS logo_image_dark TEXT
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS loa_entries (
      id SERIAL PRIMARY KEY,
      company_id INTEGER,
      passport_id INTEGER,
      company_name TEXT,
      company_address TEXT,
      company_email TEXT,
      company_phone TEXT,
      company_country TEXT,
      company_registration_number TEXT,
      candidate_name TEXT,
      candidate_address TEXT,
      candidate_nationality TEXT,
      candidate_date_of_birth TEXT,
      candidate_passport_number TEXT,
      candidate_emergency_contact TEXT,
      job_title TEXT,
      work_type TEXT,
      basic_salary TEXT,
      salary_payment_date TEXT,
      work_site TEXT,
      date_of_commence TEXT,
      job_description TEXT,
      working_hours TEXT,
      work_status TEXT,
      contract_duration TEXT,
      signatory_name TEXT,
      signatory_designation TEXT,
      signature_date TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS loa_options (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS loa_options_company_category_value_idx
      ON loa_options (company_id, category, value)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS passwords (
      id SERIAL PRIMARY KEY,
      website TEXT NOT NULL,
      owner TEXT NOT NULL,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    ALTER TABLE passwords ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE
  `);
  await db.execute(sql`
    ALTER TABLE passwords ADD COLUMN IF NOT EXISTS efaas_username TEXT NOT NULL DEFAULT ''
  `);
  await db.execute(sql`
    ALTER TABLE passwords ADD COLUMN IF NOT EXISTS efaas_password TEXT NOT NULL DEFAULT ''
  `);
  await db.execute(sql`
    ALTER TABLE passwords ADD COLUMN IF NOT EXISTS gmail_username TEXT NOT NULL DEFAULT ''
  `);
  await db.execute(sql`
    ALTER TABLE passwords ADD COLUMN IF NOT EXISTS gmail_password TEXT NOT NULL DEFAULT ''
  `);
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'passwords' AND column_name = 'website'
      ) THEN
        DELETE FROM passwords;
        ALTER TABLE passwords DROP COLUMN website;
        ALTER TABLE passwords DROP COLUMN owner;
        ALTER TABLE passwords DROP COLUMN username;
        ALTER TABLE passwords DROP COLUMN password;
      END IF;
    END $$
  `);
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'passwords' AND column_name = 'company_id'
      ) AND NOT EXISTS (SELECT 1 FROM passwords LIMIT 1) THEN
        ALTER TABLE passwords ALTER COLUMN company_id SET NOT NULL;
      END IF;
    END $$
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS passwords_company_id_idx ON passwords (company_id)
  `);
  await db.execute(sql`
    INSERT INTO passwords (company_id, efaas_username, efaas_password, gmail_username, gmail_password)
    SELECT c.id, '', '', '', ''
    FROM companies c
    WHERE NOT EXISTS (SELECT 1 FROM passwords p WHERE p.company_id = c.id)
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS expense_categories_name_lower_idx
      ON expense_categories (lower(name))
  `);
  await db.execute(sql`
    ALTER TABLE passports ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT
  `);
  await db.execute(sql`
    ALTER TABLE passports ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      priority TEXT NOT NULL DEFAULT 'medium',
      due_date DATE,
      parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function seedAppSettings(): Promise<void> {
  await db.insert(appSettingsTable).values({ id: 1 }).onConflictDoNothing();
}

async function seedSuperuser(): Promise<void> {
  const email = process.env["SUPERUSER_EMAIL"];
  const password = process.env["SUPERUSER_PASSWORD"];
  if (!email || !password) {
    console.warn("SUPERUSER_EMAIL/PASSWORD not set; skipping superuser seed");
    return;
  }

  const [existing] = await db
    .select({ count: count() })
    .from(usersTable)
    .where(eq(usersTable.role, "superuser"));

  if ((existing?.count ?? 0) > 0) {
    return;
  }

  const normalEmail = email.toLowerCase().trim();
  const passwordHash = await hashPassword(password);

  await db.insert(usersTable).values({
    email: normalEmail,
    name: "Superuser",
    role: "superuser",
    isApproved: true,
    isBlocked: false,
    passwordHash,
  });

  console.log(`Seeded superuser: ${normalEmail}`);
}

async function seedRolePermissions(): Promise<void> {
  const [existing] = await db
    .select({ count: count() })
    .from(rolePermissionsTable);

  if ((existing?.count ?? 0) > 0) {
    return;
  }

  await db.insert(rolePermissionsTable).values(DEFAULT_ROLE_PERMISSIONS);
  console.log("Seeded default role permissions");
}

const DEFAULT_CATEGORIES = [
  { name: "Office", color: "blue" },
  { name: "Travel", color: "amber" },
  { name: "Utilities", color: "teal" },
  { name: "Miscellaneous", color: "slate" },
];

async function seedExpenseCategories(): Promise<void> {
  const [existing] = await db.select({ count: count() }).from(expenseCategoriesTable);
  if ((existing?.count ?? 0) > 0) return;
  await db.insert(expenseCategoriesTable).values(DEFAULT_CATEGORIES);
  console.log("Seeded default expense categories");
}

async function seedIssuerCompany(): Promise<void> {
  const name = "LEO EMPLOYMENT SERVICES PVT LTD";
  const [existing] = await db
    .select({ id: companiesTable.id })
    .from(companiesTable)
    .where(eq(companiesTable.name, name))
    .limit(1);
  if (existing) return;
  await db.insert(companiesTable).values({
    name,
    registrationNumber: "C20542025",
  });
  console.log("Seeded default issuer company");
}
