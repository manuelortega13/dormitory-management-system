-- Migration: Rename 'dean' role to 'home_dean'
-- This updates the ENUM to use 'home_dean' instead of 'dean'

-- Step 1: Add 'home_dean' to the ENUM
ALTER TABLE users 
MODIFY COLUMN role ENUM('resident', 'parent', 'admin', 'security_guard', 'dean', 'vpsas', 'home_dean') NOT NULL DEFAULT 'resident';

-- Step 2: Update existing dean users to home_dean
UPDATE users SET role = 'home_dean' WHERE role = 'dean';

-- Step 3: Remove 'dean' from the ENUM (by modifying without it)
ALTER TABLE users 
MODIFY COLUMN role ENUM('resident', 'parent', 'admin', 'security_guard', 'home_dean', 'vpsas') NOT NULL DEFAULT 'resident';
