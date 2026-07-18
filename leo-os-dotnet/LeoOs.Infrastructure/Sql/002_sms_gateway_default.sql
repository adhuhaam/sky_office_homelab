-- Exclusive default gateway node (org SMS pool)
ALTER TABLE sms_gateways
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- If no default exists yet, promote the oldest gateway
UPDATE sms_gateways
SET is_default = true
WHERE id = (
  SELECT id FROM sms_gateways ORDER BY id ASC LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM sms_gateways WHERE is_default = true);

INSERT INTO notification_templates (code, name, title, message, variables, enabled)
VALUES
  ('OrgFollowUp', 'Organization follow-up', 'Org notice',
   'Sky Office: {summary}', 'summary', true)
ON CONFLICT (code) DO NOTHING;
