-- Migration: Add completion proof to tasks
-- Occupants can mark their own task completed, providing an optional note and a
-- required proof image (stored as a base64 data URL in a LONGTEXT column).

ALTER TABLE tasks ADD COLUMN completion_note TEXT NULL AFTER completed_at;
ALTER TABLE tasks ADD COLUMN completion_image LONGTEXT NULL AFTER completion_note;
