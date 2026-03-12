-- Add QR code settings for GCash and Maya
INSERT INTO payment_settings (setting_key, setting_value, description) VALUES
  ('gcash_qr', '', 'GCash QR code image (base64)'),
  ('maya_qr', '', 'Maya QR code image (base64)')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
