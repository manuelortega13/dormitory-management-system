-- Migration: Create system settings table
-- This migration creates a general settings table for system configuration

-- System settings table - stores all system configuration
CREATE TABLE IF NOT EXISTS system_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT NULL,
  setting_type ENUM('text', 'number', 'toggle', 'select') NOT NULL DEFAULT 'text',
  description VARCHAR(255) NULL,
  options JSON NULL,
  updated_by INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_category_key (category, setting_key),
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Insert default system settings
INSERT INTO system_settings (category, setting_key, setting_value, setting_type, description, options) VALUES
  -- General Settings
  ('general', 'dorm_name', 'University Dormitory', 'text', 'Name displayed throughout the system', NULL),
  ('general', 'timezone', 'Asia/Manila', 'select', 'System timezone for all timestamps', '["Asia/Manila", "Asia/Singapore", "UTC"]'),
  ('general', 'maintenance_mode', 'false', 'toggle', 'Enable to prevent user access during maintenance', NULL),
  
  -- Notification Settings
  ('notifications', 'email_notifications', 'true', 'toggle', 'Send email notifications for important events', NULL),
  ('notifications', 'sms_notifications', 'false', 'toggle', 'Send SMS for urgent notifications', NULL),
  ('notifications', 'notification_digest', 'daily', 'select', 'How often to send notification summaries', '["realtime", "hourly", "daily", "weekly"]'),
  
  -- Security Settings
  ('security', 'session_timeout', '30', 'number', 'Auto logout after inactivity (minutes)', NULL),
  ('security', 'two_factor_auth', 'false', 'toggle', 'Require 2FA for admin accounts', NULL),
  ('security', 'password_expiry', '90', 'number', 'Force password change after days (0 = never)', NULL),
  
  -- Payment Settings
  ('payments', 'currency', 'PHP', 'select', 'Default currency for payments', '["PHP", "USD", "EUR"]'),
  ('payments', 'late_fee_percentage', '5', 'number', 'Percentage charged for late payments', NULL),
  ('payments', 'grace_period_days', '7', 'number', 'Days after due date before late fees apply', NULL)
ON DUPLICATE KEY UPDATE category = category;

-- Index for faster category lookups
CREATE INDEX idx_system_settings_category ON system_settings(category);
