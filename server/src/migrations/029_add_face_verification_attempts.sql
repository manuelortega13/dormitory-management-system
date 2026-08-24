-- Migration: 029_add_face_verification_attempts
-- Description: Audit log of every parent face-verification attempt. Serves two
--              purposes: it is the attempt counter the rate limiter reads, and it
--              records the measured descriptor distance so FACE_MATCH_THRESHOLD can
--              be tuned against this deployment's real population instead of a
--              generic default.
-- Created: 2026-08-24

CREATE TABLE IF NOT EXISTS face_verification_attempts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    -- 'leave_request_parent_approve' | 'gatepass_parent_approve' | 'parent_registration'
    purpose VARCHAR(48) NOT NULL,
    reference_id INT NULL,
    outcome ENUM('matched', 'rejected', 'error', 'blocked') NOT NULL,
    -- Server-side only. Never returned to the client: exposing the distance turns
    -- a failed attempt into an oracle an attacker can hill-climb against.
    distance DECIMAL(6, 4) NULL,
    threshold DECIMAL(6, 4) NULL,
    reason VARCHAR(64) NULL,
    stored_score DECIMAL(6, 4) NULL,
    captured_score DECIMAL(6, 4) NULL,
    captured_face_count SMALLINT NULL,
    captured_width_ratio DECIMAL(6, 4) NULL,
    captured_sharpness DECIMAL(12, 2) NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    -- Supports the rate-limit lookup (recent attempts by this user).
    INDEX idx_fva_user_created (user_id, created_at),
    INDEX idx_fva_target (purpose, reference_id, created_at)
);
