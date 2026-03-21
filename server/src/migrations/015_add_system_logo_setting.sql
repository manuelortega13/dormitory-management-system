-- Add system logo setting and ensure setting_value can hold base64 images
ALTER TABLE system_settings MODIFY COLUMN setting_value LONGTEXT NULL;

-- Extend setting_type enum to include 'image' (must come before INSERT)
ALTER TABLE system_settings MODIFY COLUMN setting_type ENUM('text', 'number', 'toggle', 'select', 'image') NOT NULL DEFAULT 'text';

INSERT INTO system_settings (category, setting_key, setting_value, setting_type, description, options) VALUES
  ('general', 'system_logo', '', 'image', 'System logo displayed on PWA home screen icon and login page', NULL)
ON DUPLICATE KEY UPDATE category = category;
