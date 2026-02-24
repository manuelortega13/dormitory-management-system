-- Dormitory Management System Database Schema
-- NOTE: This file is kept for reference. Use migrations for actual schema changes.
-- The canonical schema is defined by the migration files in src/migrations/

CREATE DATABASE IF NOT EXISTS dormitory_db;
USE dormitory_db;

-- Users table (for admins, security guards, residents, parents, and deans)
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role ENUM('resident', 'parent', 'admin', 'security_guard', 'dean') NOT NULL DEFAULT 'resident',
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
    amenities JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Room assignments (residents to rooms)
CREATE TABLE IF NOT EXISTS room_assignments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    room_id INT NOT NULL,
    assigned_date DATE NOT NULL,
    end_date DATE,
    status ENUM('active', 'ended', 'transferred') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- Leave/Go-out requests
CREATE TABLE IF NOT EXISTS leave_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    leave_type ENUM('errand', 'overnight', 'weekend', 'emergency', 'other') NOT NULL,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    reason TEXT NOT NULL,
    destination VARCHAR(255),
    emergency_contact VARCHAR(100),
    emergency_phone VARCHAR(20),
    status ENUM('pending_admin', 'pending_parent', 'approved', 'declined', 'cancelled', 'active', 'completed', 'expired') DEFAULT 'pending_admin',
    admin_status ENUM('pending', 'approved', 'declined') DEFAULT 'pending',
    admin_reviewed_by INT,
    admin_reviewed_at TIMESTAMP NULL,
    admin_notes TEXT,
    parent_status ENUM('pending', 'approved', 'declined', 'not_required') DEFAULT 'pending',
    parent_reviewed_at TIMESTAMP NULL,
    parent_notes TEXT,
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
    FOREIGN KEY (exit_recorded_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (return_recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Check-in/Check-out logs
CREATE TABLE IF NOT EXISTS check_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    leave_request_id INT,
    type ENUM('check-in', 'check-out') NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    method ENUM('manual', 'qr_scan') DEFAULT 'manual',
    recorded_by INT,
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id) ON DELETE SET NULL,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Visitors
CREATE TABLE IF NOT EXISTS visitors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    resident_id INT NOT NULL,
    visitor_name VARCHAR(200) NOT NULL,
    relationship VARCHAR(100),
    phone VARCHAR(20),
    purpose TEXT,
    check_in_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    check_out_time TIMESTAMP NULL,
    recorded_by INT,
    status ENUM('checked_in', 'checked_out') DEFAULT 'checked_in',
    FOREIGN KEY (resident_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Incidents
CREATE TABLE IF NOT EXISTS incidents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    incident_type ENUM('safety', 'maintenance', 'behavioral', 'medical', 'other') NOT NULL,
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
    type ENUM('leave_request_new', 'leave_request_admin_approved', 'leave_request_approved', 'leave_request_declined', 'leave_request_cancelled', 'parent_approval_needed', 'child_left_campus', 'child_returned_campus') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    reference_id INT,
    reference_type VARCHAR(50),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Note: Indexes are created by migration 003_add_indexes.sql
