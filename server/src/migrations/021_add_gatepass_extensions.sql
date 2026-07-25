-- Migration: Create gatepass_extensions table
-- Occupants can extend an active gatepass (+ configurable minutes). Each extension needs
-- a reason and a supporting image, requires no approval, and is later reviewed by the dean
-- (assign a disciplinary task or waive).

CREATE TABLE IF NOT EXISTS gatepass_extensions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  gatepass_id INT NOT NULL,
  requested_by INT NOT NULL,
  reason TEXT NOT NULL,
  image LONGTEXT NOT NULL,
  new_deadline TIMESTAMP NULL,

  -- Dean review outcome (after the occupant returns)
  review_status ENUM('pending_review', 'task_assigned', 'waived') NOT NULL DEFAULT 'pending_review',
  reviewed_by INT NULL,
  reviewed_at TIMESTAMP NULL,
  review_notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (gatepass_id) REFERENCES gatepasses(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_gatepass_extensions_gatepass_id ON gatepass_extensions(gatepass_id);
CREATE INDEX idx_gatepass_extensions_review_status ON gatepass_extensions(review_status);
