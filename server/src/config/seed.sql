-- Seed data for Dormitory Management System
-- Run this after migrations to create default users

USE railway;

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

-- Default Home Dean for Males
-- Username: dean_male
-- Password: pass123
INSERT INTO users (email, password, first_name, last_name, role, dean_type, status)
VALUES (
    'dean_male',
    '$2a$10$jq7c6A/6IojAK4jSbMsHBOK6JsGRn6.5uleeNxHhMySeLICjOaMCm',
    'Michael',
    'Dean',
    'home_dean',
    'male',
    'active'
) ON DUPLICATE KEY UPDATE id=id;

-- Default Home Dean for Females
-- Username: dean_female
-- Password: pass123
INSERT INTO users (email, password, first_name, last_name, role, dean_type, status)
VALUES (
    'dean_female',
    '$2a$10$jq7c6A/6IojAK4jSbMsHBOK6JsGRn6.5uleeNxHhMySeLICjOaMCm',
    'Maria',
    'Dean',
    'home_dean',
    'female',
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

-- Default VPSAS user
-- Username: vpsas
-- Password: pass123
INSERT INTO users (email, password, first_name, last_name, role, status)
VALUES (
    'vpsas',
    '$2a$10$jq7c6A/6IojAK4jSbMsHBOK6JsGRn6.5uleeNxHhMySeLICjOaMCm',
    'Vice President',
    'Student Affairs',
    'vpsas',
    'active'
) ON DUPLICATE KEY UPDATE id=id;

-- Default female resident user (linked to parent)
-- Username: resident_f
-- Password: pass123
INSERT INTO users (email, password, first_name, last_name, role, status, parent_id, gender, address, course, year_level, student_resident_id)
VALUES (
    'resident_f',
    '$2a$10$jq7c6A/6IojAK4jSbMsHBOK6JsGRn6.5uleeNxHhMySeLICjOaMCm',
    'Christine',
    'Student',
    'resident',
    'active',
    (SELECT id FROM (SELECT id FROM users WHERE email = 'parent') AS tmp),
    'female',
    '123 Main Street, City',
    'BS Computer Science',
    2,
    'PAC-000001'
) ON DUPLICATE KEY UPDATE id=id;

-- Default male resident user (linked to parent)
-- Username: resident_m
-- Password: pass123
INSERT INTO users (email, password, first_name, last_name, role, status, parent_id, gender, address, course, year_level, student_resident_id)
VALUES (
    'resident_m',
    '$2a$10$jq7c6A/6IojAK4jSbMsHBOK6JsGRn6.5uleeNxHhMySeLICjOaMCm',
    'Max',
    'Student',
    'resident',
    'active',
    (SELECT id FROM (SELECT id FROM users WHERE email = 'parent') AS tmp),
    'male',
    '456 Oak Avenue, City',
    'BS Information Technology',
    3,
    'PAC-000002'
) ON DUPLICATE KEY UPDATE id=id;

-- 6 Sample rooms
INSERT INTO rooms (room_number, floor, capacity, status, room_type, amenities)
VALUES 
    ('101', 1, 1, 'available', 'single', '["AC", "WiFi"]'),
    ('102', 1, 2, 'available', 'double', '["AC", "WiFi", "Attached Bath"]'),
    ('103', 1, 2, 'available', 'double', '["AC", "WiFi", "Attached Bath"]'),
    ('201', 2, 2, 'available', 'double', '["AC", "WiFi", "Attached Bath"]'),
    ('202', 2, 3, 'available', 'triple', '["AC", "WiFi", "Attached Bath"]'),
    ('203', 2, 4, 'available', 'quad', '["AC", "WiFi", "Attached Bath", "Balcony", "Mini Fridge"]')
ON DUPLICATE KEY UPDATE id=id;
