-- Migration: 002_add_notification_types
-- Description: Add leave_request_admin_approved and leave_request_cancelled notification types
-- Created: 2026-02-24

ALTER TABLE notifications 
MODIFY COLUMN type ENUM(
    'leave_request_new', 
    'leave_request_admin_approved', 
    'leave_request_approved', 
    'leave_request_declined', 
    'leave_request_cancelled',
    'parent_approval_needed', 
    'child_left_campus', 
    'child_returned_campus'
) NOT NULL;
