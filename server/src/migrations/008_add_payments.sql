-- Migration: Create payments and billing tables
-- This migration creates the payment infrastructure for dormitory billing

-- Bills table - represents what residents owe
CREATE TABLE IF NOT EXISTS bills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  resident_id INT NOT NULL,
  type ENUM('rent', 'deposit', 'utility', 'fine', 'other') NOT NULL DEFAULT 'rent',
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  due_date DATE NOT NULL,
  status ENUM('unpaid', 'partial', 'paid', 'overdue', 'cancelled') NOT NULL DEFAULT 'unpaid',
  created_by INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (resident_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Payments table - represents actual payments made
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bill_id INT NOT NULL,
  resident_id INT NOT NULL,
  paid_by INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method ENUM('cash', 'gcash', 'maya', 'other') NOT NULL,
  reference_number VARCHAR(100) NULL,
  notes TEXT NULL,
  status ENUM('pending', 'verified', 'rejected') NOT NULL DEFAULT 'pending',
  verified_by INT NULL,
  verified_at DATETIME NULL,
  payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
  FOREIGN KEY (resident_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (paid_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Payment settings table - stores recipient information for each payment method
CREATE TABLE IF NOT EXISTS payment_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(50) NOT NULL UNIQUE,
  setting_value TEXT NULL,
  description VARCHAR(255) NULL,
  updated_by INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Insert default payment settings
INSERT INTO payment_settings (setting_key, setting_value, description) VALUES
  ('gcash_number', '', 'GCash mobile number for payments'),
  ('gcash_name', '', 'GCash account holder name'),
  ('maya_number', '', 'Maya mobile number for payments'),
  ('maya_name', '', 'Maya account holder name'),
  ('cash_instructions', 'Please proceed to the Admin Office (Room 101) during office hours (8AM-5PM, Mon-Fri) to make cash payments.', 'Instructions for cash payments'),
  ('payment_notes', '', 'Additional payment notes or instructions')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

-- Indexes for faster queries
CREATE INDEX idx_bills_resident_id ON bills(resident_id);
CREATE INDEX idx_bills_status ON bills(status);
CREATE INDEX idx_bills_due_date ON bills(due_date);
CREATE INDEX idx_payments_bill_id ON payments(bill_id);
CREATE INDEX idx_payments_resident_id ON payments(resident_id);
CREATE INDEX idx_payments_paid_by ON payments(paid_by);
CREATE INDEX idx_payments_status ON payments(status);
