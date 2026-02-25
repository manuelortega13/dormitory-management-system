-- Migration: Add dean_type column for home_dean users
-- This allows distinguishing between Dean for Males and Dean for Females

ALTER TABLE users
ADD COLUMN dean_type ENUM('male', 'female') NULL AFTER role;

-- Add comment to clarify the usage
-- dean_type is only applicable when role = 'home_dean'
