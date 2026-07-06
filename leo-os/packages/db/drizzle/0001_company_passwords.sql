-- Migrate passwords from generic website/owner model to one record per company.

ALTER TABLE passwords ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE passwords ADD COLUMN IF NOT EXISTS efaas_username TEXT NOT NULL DEFAULT '';
ALTER TABLE passwords ADD COLUMN IF NOT EXISTS efaas_password TEXT NOT NULL DEFAULT '';
ALTER TABLE passwords ADD COLUMN IF NOT EXISTS gmail_username TEXT NOT NULL DEFAULT '';
ALTER TABLE passwords ADD COLUMN IF NOT EXISTS gmail_password TEXT NOT NULL DEFAULT '';

DELETE FROM passwords;

ALTER TABLE passwords DROP COLUMN IF EXISTS website;
ALTER TABLE passwords DROP COLUMN IF EXISTS owner;
ALTER TABLE passwords DROP COLUMN IF EXISTS username;
ALTER TABLE passwords DROP COLUMN IF EXISTS password;

ALTER TABLE passwords ALTER COLUMN company_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS passwords_company_id_idx ON passwords (company_id);

INSERT INTO passwords (company_id, efaas_username, efaas_password, gmail_username, gmail_password)
SELECT c.id, '', '', '', ''
FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM passwords p WHERE p.company_id = c.id);
