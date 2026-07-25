-- Migration: Add gatepass notification types to the notifications ENUM
-- Restates the full existing type list (as of migration 011) plus the new gatepass types.

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
    'registration_declined',
    'announcement',
    'payment',
    'gatepass_new',
    'gatepass_parent_approved',
    'gatepass_dean_approved',
    'gatepass_approved',
    'gatepass_declined',
    'gatepass_exit',
    'gatepass_returned',
    'gatepass_overdue',
    'gatepass_extended',
    'gatepass_task_assigned',
    'gatepass_cancelled'
) NOT NULL;
