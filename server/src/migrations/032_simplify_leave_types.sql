-- Migration: leave requests carry two types now - Special Pass and Campus Leave.
--
-- The old five are mapped onto them rather than dropped, so past requests stay readable:
-- a short trip out (errand, emergency, other) becomes a special pass; anything that kept the
-- occupant out overnight (overnight, weekend) becomes campus leave.
--
-- The column is widened first so the old and new values can coexist for the length of the
-- UPDATE, then narrowed to just the two.

ALTER TABLE leave_requests
  MODIFY COLUMN leave_type ENUM(
    'errand', 'overnight', 'weekend', 'emergency', 'other',
    'special_pass', 'campus_leave'
  ) NOT NULL;

UPDATE leave_requests SET leave_type = 'special_pass'
  WHERE leave_type IN ('errand', 'emergency', 'other');

UPDATE leave_requests SET leave_type = 'campus_leave'
  WHERE leave_type IN ('overnight', 'weekend');

ALTER TABLE leave_requests
  MODIFY COLUMN leave_type ENUM('special_pass', 'campus_leave') NOT NULL DEFAULT 'special_pass';
