-- Migration: the gatepass approval chain drops its VPSAS step.
-- A gatepass now runs parent -> home dean -> QR, so the dean is the final approver.
--
-- Passes already waiting on the VP have cleared the parent and the dean, which is the whole
-- chain from now on, so they are approved here and given the QR code they were waiting for.
-- vpsas_status is deliberately left as it is: no VP ever reviewed these, and the reports read
-- those columns to count who decided what.

UPDATE gatepasses
SET status = 'approved',
    qr_code = SHA2(CONCAT(UUID(), '-', id), 256),
    qr_generated_at = NOW()
WHERE status = 'pending_vpsas'
  AND (qr_code IS NULL OR qr_code = '');

-- Any left over already had a QR code; just move them out of the retired state.
UPDATE gatepasses SET status = 'approved' WHERE status = 'pending_vpsas';
