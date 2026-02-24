-- Migration: 003_add_indexes
-- Description: Add performance indexes (safe to run multiple times)
-- Created: 2026-02-24

-- Note: MySQL CREATE INDEX doesn't support IF NOT EXISTS
-- We use a trick: create and ignore duplicate key errors
-- The migration runner handles errors gracefully

-- Leave requests indexes
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_user_id ON leave_requests(user_id);

-- Notifications indexes  
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- Check logs indexes
CREATE INDEX idx_check_logs_user_id ON check_logs(user_id);

-- Room assignments indexes
CREATE INDEX idx_room_assignments_status ON room_assignments(status);
