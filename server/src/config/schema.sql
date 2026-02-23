-- Dormitory Management System Database Schema

CREATE DATABASE IF NOT EXISTS dormitory_db;
USE dormitory_db;

-- Users table (for admins, security guards, residents, parents, and deans)
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role ENUM('admin', 'security_guard', 'resident', 'parent', 'dean') NOT NULL DEFAULT 'resident',
    phone VARCHAR(20),
    photo_url VARCHAR(255),
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    -- Parent/Guardian info for residents
    parent_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id INT PRIMARY KEY AUTO_INCREMENT,
    room_number VARCHAR(10) UNIQUE NOT NULL,
    floor INT NOT NULL,
    capacity INT NOT NULL DEFAULT 1,
    status ENUM('available', 'occupied', 'maintenance', 'reserved') DEFAULT 'available',
    room_type ENUM('single', 'double', 'triple', 'suite') DEFAULT 'single',
    price_per_month DECIMAL(10, 2),
    amenities JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Room assignments (residents to rooms)
CREATE TABLE IF NOT EXISTS room_assignments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    room_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    status ENUM('active', 'ended', 'pending') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- Leave/Go-out requests
CREATE TABLE IF NOT EXISTS leave_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    leave_type ENUM('errand', 'overnight', 'weekend', 'holiday', 'emergency', 'other') NOT NULL,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    reason TEXT NOT NULL,
    destination VARCHAR(255) NOT NULL,
    
    -- Emergency contact for the trip
    emergency_contact VARCHAR(100),
    emergency_phone VARCHAR(20),
    
    -- Admin/Dean approval
    admin_status ENUM('pending', 'approved', 'declined') DEFAULT 'pending',
    admin_reviewed_by INT,
    admin_reviewed_at TIMESTAMP,
    admin_notes TEXT,
    
    -- Parent/Guardian approval
    parent_status ENUM('pending', 'approved', 'declined', 'not_required') DEFAULT 'pending',
    parent_reviewed_at TIMESTAMP,
    parent_notes TEXT,
    
    -- QR Code for verification (generated after both approvals)
    qr_code VARCHAR(64) UNIQUE,
    qr_generated_at TIMESTAMP,
    
    -- Exit/Return tracking
    exit_time TIMESTAMP,
    exit_recorded_by INT,
    return_time TIMESTAMP,
    return_recorded_by INT,
    
    -- Overall status
    status ENUM('pending_admin', 'pending_parent', 'approved', 'active', 'completed', 'declined', 'cancelled', 'expired') DEFAULT 'pending_admin',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (exit_recorded_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (return_recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Check-in/Check-out logs (linked to leave requests)
CREATE TABLE IF NOT EXISTS check_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    leave_request_id INT,
    type ENUM('check-in', 'check-out') NOT NULL,
    method ENUM('qr_scan', 'manual', 'card') DEFAULT 'qr_scan',
    recorded_by INT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id) ON DELETE SET NULL,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Visitor logs
CREATE TABLE IF NOT EXISTS visitors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    id_type ENUM('national_id', 'passport', 'drivers_license', 'other') NOT NULL,
    id_number VARCHAR(50) NOT NULL,
    visiting_user_id INT NOT NULL,
    purpose VARCHAR(255),
    check_in_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    check_out_time TIMESTAMP,
    recorded_by INT,
    status ENUM('inside', 'left') DEFAULT 'inside',
    FOREIGN KEY (visiting_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Incidents
CREATE TABLE IF NOT EXISTS incidents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'low',
    location VARCHAR(255),
    reported_by INT,
    status ENUM('open', 'investigating', 'resolved', 'closed') DEFAULT 'open',
    resolved_by INT,
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type ENUM('leave_request_new', 'leave_request_approved', 'leave_request_declined', 'parent_approval_needed', 'child_left_campus', 'child_returned_campus') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    reference_id INT,
    reference_type VARCHAR(50),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Push subscriptions for web push notifications
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    subscription JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_parent ON users(parent_id);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_room_assignments_status ON room_assignments(status);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_user ON leave_requests(user_id);
CREATE INDEX idx_leave_requests_qr ON leave_requests(qr_code);
CREATE INDEX idx_leave_requests_admin_status ON leave_requests(admin_status);
CREATE INDEX idx_leave_requests_parent_status ON leave_requests(parent_status);
CREATE INDEX idx_check_logs_user ON check_logs(user_id);
CREATE INDEX idx_check_logs_created ON check_logs(created_at);
CREATE INDEX idx_check_logs_leave_request ON check_logs(leave_request_id);
CREATE INDEX idx_visitors_status ON visitors(status);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at);
