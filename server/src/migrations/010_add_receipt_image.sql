-- Migration: Add receipt image to payments table
-- Allows residents to upload e-receipt screenshots for payment verification

ALTER TABLE payments ADD COLUMN receipt_image LONGTEXT NULL AFTER notes;
