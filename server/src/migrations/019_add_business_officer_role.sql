-- Migration: Add 'business_officer' to the users.role ENUM
-- Business Officer is a staff role scoped to the Payments page and Payment Settings

ALTER TABLE users MODIFY COLUMN role
  ENUM('resident', 'parent', 'admin', 'security_guard', 'home_dean', 'vpsas', 'business_officer')
  NOT NULL DEFAULT 'resident';
