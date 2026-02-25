-- Migration: Add VPSAS role
-- VPSAS (Vice President for Student Affairs and Services) has the same access as admin/dean

-- Alter users table to add 'vpsas' to the role enum
ALTER TABLE users 
MODIFY COLUMN role ENUM('resident', 'parent', 'admin', 'security_guard', 'dean', 'vpsas') NOT NULL DEFAULT 'resident';
