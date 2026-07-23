-- Migration: Add suspension reason tracking to users table
-- Persists why a user (staff/resident) was suspended and when, so it can be displayed later

ALTER TABLE users ADD COLUMN suspension_reason TEXT NULL AFTER status;
ALTER TABLE users ADD COLUMN suspended_at TIMESTAMP NULL AFTER suspension_reason;
