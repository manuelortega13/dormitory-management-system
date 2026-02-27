-- Migration: Add registration type to notifications ENUM
-- This migration adds the 'registration' type to the notifications type enum for parent registration notifications

ALTER TABLE notifications MODIFY COLUMN type ENUM(
    'leave_request_new', 
    'leave_request_admin_approved', 
    'leave_request_dean_approved', 
    'leave_request_parent_approved', 
    'leave_request_vpsas_approved', 
    'leave_request_approved', 
    'leave_request_declined', 
    'leave_request_cancelled', 
    'parent_approval_needed', 
    'vpsas_approval_needed', 
    'child_left_campus', 
    'child_returned_campus',
    'registration',
    'registration_approved',
    'registration_declined'
) NOT NULL;
