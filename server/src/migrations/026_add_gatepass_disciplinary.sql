-- Migration: Add per-gatepass disciplinary review state + late-return grace setting
-- A gatepass needs dean review (disciplinary_status = 'pending') when the occupant
-- returns late OR requested an extension. The dean then assigns a task or waives.

ALTER TABLE gatepasses
  ADD COLUMN disciplinary_status ENUM('none', 'pending', 'task_assigned', 'waived')
  NOT NULL DEFAULT 'none' AFTER overdue_notified_at;

-- Grace period (minutes) past the deadline before a return counts as late
INSERT INTO system_settings (category, setting_key, setting_value, setting_type, description, options) VALUES
  ('gatepass', 'late_grace_minutes', '5', 'number', 'Minutes past the deadline before a gatepass return is flagged late for dean review', NULL)
ON DUPLICATE KEY UPDATE category = category;
