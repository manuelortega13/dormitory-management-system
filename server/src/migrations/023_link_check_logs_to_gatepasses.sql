-- Migration: Link check logs to gatepasses
-- Guard exit/return scans for a gatepass are recorded as check_logs rows, mirroring the
-- leave_request_id linkage.

ALTER TABLE check_logs ADD COLUMN gatepass_id INT NULL AFTER leave_request_id;
ALTER TABLE check_logs ADD CONSTRAINT fk_check_logs_gatepass
  FOREIGN KEY (gatepass_id) REFERENCES gatepasses(id) ON DELETE SET NULL;
