-- Migration: Create gatepasses table
-- A gatepass is a short off-campus pass with a parent -> dean -> vpsas approval chain,
-- a QR code, a timed validity window (configurable), and guard-recorded exit/return.

CREATE TABLE IF NOT EXISTS gatepasses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  reason TEXT NOT NULL,
  destination VARCHAR(255) NOT NULL,
  status ENUM(
    'pending_parent', 'pending_dean', 'pending_vpsas',
    'approved', 'active', 'completed', 'declined', 'cancelled'
  ) NOT NULL DEFAULT 'pending_parent',

  -- Parent approval (first). 'not_required' when the occupant has no linked parent.
  parent_status ENUM('pending', 'approved', 'declined', 'not_required') DEFAULT 'pending',
  parent_reviewed_by INT NULL,
  parent_reviewed_at TIMESTAMP NULL,
  parent_notes TEXT,

  -- Home Dean approval (second)
  dean_status ENUM('pending', 'approved', 'declined') DEFAULT 'pending',
  dean_reviewed_by INT NULL,
  dean_reviewed_at TIMESTAMP NULL,
  dean_notes TEXT,

  -- VPSAS approval (third, final -> QR generated)
  vpsas_status ENUM('pending', 'approved', 'declined') DEFAULT 'pending',
  vpsas_reviewed_by INT NULL,
  vpsas_reviewed_at TIMESTAMP NULL,
  vpsas_notes TEXT,

  qr_code VARCHAR(255) UNIQUE,
  qr_generated_at TIMESTAMP NULL,

  -- Guard-recorded movement
  exit_time TIMESTAMP NULL,
  exit_recorded_by INT NULL,
  return_time TIMESTAMP NULL,
  return_recorded_by INT NULL,

  -- Timer: set on exit (= exit_time + pass duration); recomputed on each extension.
  deadline TIMESTAMP NULL,
  overdue_notified_at TIMESTAMP NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (dean_reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (vpsas_reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (exit_recorded_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (return_recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_gatepasses_status ON gatepasses(status);
CREATE INDEX idx_gatepasses_user_id ON gatepasses(user_id);
CREATE INDEX idx_gatepasses_qr_code ON gatepasses(qr_code);
CREATE INDEX idx_gatepasses_deadline ON gatepasses(deadline);
