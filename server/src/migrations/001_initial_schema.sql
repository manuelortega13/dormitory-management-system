-- Migration: 001_initial_schema
-- Description: Initial database schema (consolidated)
-- Created: 2026-02-24
-- Updated: 2026-02-26 (consolidated all migrations)

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    gender ENUM('male', 'female') NULL,
    address TEXT NULL,
    course VARCHAR(255) NULL,
    year_level INT NULL,
    role ENUM('resident', 'parent', 'admin', 'security_guard', 'home_dean', 'vpsas') NOT NULL DEFAULT 'resident',
    dean_type ENUM('male', 'female') NULL,
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    parent_id INT,
    photo_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id INT PRIMARY KEY AUTO_INCREMENT,
    room_number VARCHAR(20) UNIQUE NOT NULL,
    floor INT NOT NULL,
    capacity INT NOT NULL DEFAULT 2,
    room_type ENUM('single', 'double', 'triple', 'quad') DEFAULT 'double',
    status ENUM('available', 'occupied', 'maintenance', 'reserved') DEFAULT 'available',
    price_per_month DECIMAL(10,2) DEFAULT NULL,
    amenities JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Room assignments
CREATE TABLE IF NOT EXISTS room_assignments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    room_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    status ENUM('active', 'ended', 'transferred') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- Leave requests
CREATE TABLE IF NOT EXISTS leave_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    leave_type ENUM('errand', 'overnight', 'weekend', 'emergency', 'other') NOT NULL,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    reason TEXT NOT NULL,
    destination VARCHAR(255),
    spending_leave_with VARCHAR(255),
    emergency_contact VARCHAR(100),
    emergency_phone VARCHAR(20),
    status ENUM('pending_dean', 'pending_admin', 'pending_parent', 'pending_vpsas', 'approved', 'declined', 'cancelled', 'active', 'completed', 'expired') DEFAULT 'pending_dean',
    admin_status ENUM('pending', 'approved', 'declined') DEFAULT 'pending',
    admin_reviewed_by INT,
    admin_reviewed_at TIMESTAMP NULL,
    admin_notes TEXT,
    parent_status ENUM('pending', 'approved', 'declined', 'not_required') DEFAULT 'pending',
    parent_reviewed_at TIMESTAMP NULL,
    parent_notes TEXT,
    vpsas_status ENUM('pending', 'approved', 'declined', 'not_required') DEFAULT 'pending',
    vpsas_reviewed_by INT,
    vpsas_reviewed_at TIMESTAMP NULL,
    vpsas_notes TEXT,
    qr_code VARCHAR(255) UNIQUE,
    qr_generated_at TIMESTAMP NULL,
    exit_time TIMESTAMP NULL,
    exit_recorded_by INT,
    return_time TIMESTAMP NULL,
    return_recorded_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (vpsas_reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (exit_recorded_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (return_recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Check-in/out logs
CREATE TABLE IF NOT EXISTS check_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    leave_request_id INT,
    type ENUM('check-in', 'check-out') NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    method ENUM('manual', 'qr_scan') DEFAULT 'manual',
    recorded_by INT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id) ON DELETE SET NULL,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Visitors (external people visiting residents)
CREATE TABLE IF NOT EXISTS visitors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    visiting_user_id INT NOT NULL,
    name VARCHAR(200) NOT NULL,
    id_type VARCHAR(50),
    id_number VARCHAR(100),
    relationship VARCHAR(100),
    phone VARCHAR(20),
    purpose TEXT,
    check_in_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    check_out_time TIMESTAMP NULL,
    recorded_by INT,
    status ENUM('inside', 'left') DEFAULT 'inside',
    FOREIGN KEY (visiting_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Incidents
CREATE TABLE IF NOT EXISTS incidents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    incident_type ENUM('safety', 'maintenance', 'behavioral', 'medical', 'other') DEFAULT 'other',
    severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    status ENUM('reported', 'investigating', 'resolved', 'closed') DEFAULT 'reported',
    location VARCHAR(255),
    reported_by INT,
    involved_users JSON,
    resolved_by INT,
    resolved_at TIMESTAMP NULL,
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
    type ENUM('leave_request_new', 'leave_request_admin_approved', 'leave_request_dean_approved', 'leave_request_parent_approved', 'leave_request_vpsas_approved', 'leave_request_approved', 'leave_request_declined', 'leave_request_cancelled', 'parent_approval_needed', 'vpsas_approval_needed', 'child_left_campus', 'child_returned_campus') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    reference_id INT,
    reference_type VARCHAR(50),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Performance indexes
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_parent_id ON users(parent_id);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_room_assignments_status ON room_assignments(status);
CREATE INDEX idx_room_assignments_user_id ON room_assignments(user_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_user_id ON leave_requests(user_id);
CREATE INDEX idx_leave_requests_qr_code ON leave_requests(qr_code);
CREATE INDEX idx_check_logs_user_id ON check_logs(user_id);
CREATE INDEX idx_check_logs_created_at ON check_logs(created_at);
CREATE INDEX idx_visitors_status ON visitors(status);
CREATE INDEX idx_visitors_visiting_user_id ON visitors(visiting_user_id);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
