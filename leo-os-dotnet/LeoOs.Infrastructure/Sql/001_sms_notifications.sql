-- Additive SMS / notification schema for leoos (idempotent)
CREATE TABLE IF NOT EXISTS sms_gateways (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  phone_number text,
  gateway_key_hash text NOT NULL,
  status text NOT NULL DEFAULT 'offline',
  last_heartbeat timestamptz,
  battery_level integer,
  signal_strength integer,
  network_type text,
  sim_operator text,
  android_version text,
  device_model text,
  app_version text,
  tailscale_ip text,
  device_id text,
  priority integer NOT NULL DEFAULT 0,
  last_seen timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sms_gateways_device_id_uidx ON sms_gateways (device_id) WHERE device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sms_gateways_status_idx ON sms_gateways (status);

CREATE TABLE IF NOT EXISTS sms_queue (
  id serial PRIMARY KEY,
  gateway_id integer REFERENCES sms_gateways(id) ON DELETE SET NULL,
  tenant_id integer,
  recipient text NOT NULL,
  message text NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Pending',
  retry_count integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  completed_at timestamptz,
  error_message text,
  reference_type text,
  reference_id text,
  template_code text
);

CREATE INDEX IF NOT EXISTS sms_queue_status_idx ON sms_queue (status, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS sms_queue_gateway_idx ON sms_queue (gateway_id);

CREATE TABLE IF NOT EXISTS sms_logs (
  id serial PRIMARY KEY,
  queue_id integer REFERENCES sms_queue(id) ON DELETE SET NULL,
  gateway_id integer REFERENCES sms_gateways(id) ON DELETE SET NULL,
  recipient text NOT NULL,
  message text NOT NULL,
  status text NOT NULL,
  provider text NOT NULL DEFAULT 'android-sim',
  sent_time timestamptz,
  response text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sms_logs_created_idx ON sms_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS notification_templates (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  title text,
  message text NOT NULL,
  variables text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO notification_templates (code, name, title, message, variables, enabled)
VALUES
  ('PermitExpiring', 'Work permit expiring', 'Permit expiring', 'Work permit for {name} ({passport}) expires on {expiryDate}.', 'name,passport,expiryDate', true),
  ('LoaCreated', 'LOA created', 'LOA ready', 'Letter of Appointment for {name} is ready.', 'name,loaId', true),
  ('EmployeeCreated', 'Employee created', 'New employee', 'Employee record created for {name}.', 'name', true)
ON CONFLICT (code) DO NOTHING;
