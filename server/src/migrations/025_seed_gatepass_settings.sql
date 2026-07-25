-- Migration: Seed admin-configurable gatepass settings (category 'gatepass')
-- Idempotent via the system_settings UNIQUE (category, setting_key).

INSERT INTO system_settings (category, setting_key, setting_value, setting_type, description, options) VALUES
  ('gatepass', 'pass_duration_minutes', '60', 'number', 'Gatepass validity window in minutes, starting when the guard records exit', NULL),
  ('gatepass', 'extension_duration_minutes', '60', 'number', 'Length of each gatepass extension in minutes', NULL),
  ('gatepass', 'max_extensions', '3', 'number', 'Maximum number of extensions an occupant can request per gatepass', NULL)
ON DUPLICATE KEY UPDATE category = category;
