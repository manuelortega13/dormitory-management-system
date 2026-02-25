-- Migration: Add resident profile fields
-- Adds gender, address, course, and year_level columns to users table

ALTER TABLE users 
ADD COLUMN gender ENUM('male', 'female') NULL AFTER phone;

ALTER TABLE users 
ADD COLUMN address TEXT NULL AFTER gender;

ALTER TABLE users 
ADD COLUMN course VARCHAR(255) NULL AFTER address;

ALTER TABLE users 
ADD COLUMN year_level INT NULL AFTER course;
