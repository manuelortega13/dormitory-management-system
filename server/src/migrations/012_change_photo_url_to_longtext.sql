-- Change photo_url from VARCHAR(500) to LONGTEXT to support base64 data URLs
ALTER TABLE users MODIFY COLUMN photo_url LONGTEXT NULL;
