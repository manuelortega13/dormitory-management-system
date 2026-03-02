-- Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
  status ENUM('draft', 'published', 'expired') DEFAULT 'draft',
  audience ENUM('all', 'residents', 'parents', 'staff') DEFAULT 'all',
  created_by INT NOT NULL,
  expires_at DATETIME NULL,
  published_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for faster queries
CREATE INDEX idx_announcements_status ON announcements(status);
CREATE INDEX idx_announcements_audience ON announcements(audience);
CREATE INDEX idx_announcements_expires_at ON announcements(expires_at);
