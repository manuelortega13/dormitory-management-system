-- Add 'suite' to room_type enum and keep 'quad' for backward compatibility
ALTER TABLE rooms MODIFY COLUMN room_type ENUM('single', 'double', 'triple', 'quad', 'suite') DEFAULT 'double';
