-- Migration: 003_add_student_resident_id_and_parent_approval
-- Description: Add student_resident_id for residents and registration_status for parent approval workflow
-- Created: 2026-02-26

-- Add student_resident_id column for identifying student residents (format: PAC-XXXXXX)
ALTER TABLE users ADD COLUMN student_resident_id VARCHAR(20) UNIQUE NULL AFTER face_image;

-- Add registration_status for parent approval workflow
ALTER TABLE users ADD COLUMN registration_status ENUM('pending', 'approved', 'declined') DEFAULT 'approved' AFTER student_resident_id;

-- Add registration_reviewed_by to track who approved/declined
ALTER TABLE users ADD COLUMN registration_reviewed_by INT NULL AFTER registration_status;

-- Add registration_reviewed_at timestamp
ALTER TABLE users ADD COLUMN registration_reviewed_at TIMESTAMP NULL AFTER registration_reviewed_by;

-- Add foreign key for registration_reviewed_by
ALTER TABLE users ADD CONSTRAINT fk_registration_reviewed_by FOREIGN KEY (registration_reviewed_by) REFERENCES users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_users_student_resident_id ON users(student_resident_id);
CREATE INDEX idx_users_registration_status ON users(registration_status);
