-- Seed data for Dormitory Management System
-- Run this after schema.sql to create default users

USE dormitory_db;

-- Default admin user
-- Username: admin
-- Password: pass123
INSERT INTO users (email, password, first_name, last_name, role, status)
VALUES (
    'admin',
    '$2a$10$SNAn6WMNsxplP95vwYjI0uLzkfsb.iQmdm9VKNS6mcFfPXMAqqBD.',
    'System',
    'Administrator',
    'admin',
    'active'
) ON DUPLICATE KEY UPDATE id=id;

-- Default parent user
-- Username: parent
-- Password: pass123
INSERT INTO users (email, password, first_name, last_name, role, status)
VALUES (
    'parent',
    '$2a$10$jq7c6A/6IojAK4jSbMsHBOK6JsGRn6.5uleeNxHhMySeLICjOaMCm',
    'John',
    'Parent',
    'parent',
    'active'
) ON DUPLICATE KEY UPDATE id=id;

-- Default security guard user
-- Username: guard
-- Password: pass123
INSERT INTO users (email, password, first_name, last_name, role, status)
VALUES (
    'guard',
    '$2a$10$jq7c6A/6IojAK4jSbMsHBOK6JsGRn6.5uleeNxHhMySeLICjOaMCm',
    'Security',
    'Guard',
    'security_guard',
    'active'
) ON DUPLICATE KEY UPDATE id=id;

-- Default resident user (linked to parent)
-- Username: resident
-- Password: pass123
INSERT INTO users (email, password, first_name, last_name, role, status, parent_id)
VALUES (
    'resident',
    '$2a$10$jq7c6A/6IojAK4jSbMsHBOK6JsGRn6.5uleeNxHhMySeLICjOaMCm',
    'Jane',
    'Student',
    'resident',
    'active',
    (SELECT id FROM (SELECT id FROM users WHERE email = 'parent') AS tmp)
) ON DUPLICATE KEY UPDATE id=id;

-- Sample rooms
INSERT INTO rooms (room_number, floor, capacity, status, room_type, price_per_month, amenities)
VALUES 
    ('101', 1, 1, 'available', 'single', 650.00, '["AC", "WiFi"]'),
    ('102', 1, 2, 'available', 'double', 850.00, '["AC", "WiFi", "Attached Bath"]'),
    ('103', 1, 2, 'available', 'double', 850.00, '["AC", "WiFi", "Attached Bath"]'),
    ('201', 2, 2, 'available', 'suite', 1200.00, '["AC", "WiFi", "Attached Bath", "Balcony", "Mini Fridge"]'),
    ('202', 2, 3, 'available', 'triple', 1050.00, '["AC", "WiFi", "Attached Bath"]')
ON DUPLICATE KEY UPDATE id=id;
