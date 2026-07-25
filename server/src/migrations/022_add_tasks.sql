-- Migration: Create tasks table
-- Disciplinary tasks a dean assigns to an occupant (e.g. as a consequence of a gatepass
-- extension). Only staff can mark a task completed.

CREATE TABLE IF NOT EXISTS tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  assigned_by INT NULL,
  gatepass_id INT NULL,
  extension_id INT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date DATE NULL,
  status ENUM('pending', 'completed') NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (gatepass_id) REFERENCES gatepasses(id) ON DELETE SET NULL,
  FOREIGN KEY (extension_id) REFERENCES gatepass_extensions(id) ON DELETE SET NULL
);

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
