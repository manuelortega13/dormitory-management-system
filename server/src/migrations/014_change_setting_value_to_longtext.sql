-- Change setting_value to LONGTEXT to support large base64 data (QR codes)
ALTER TABLE payment_settings MODIFY COLUMN setting_value LONGTEXT NULL;
