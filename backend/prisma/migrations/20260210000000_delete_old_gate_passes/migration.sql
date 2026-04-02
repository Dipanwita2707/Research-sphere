-- Delete all existing gate passes and related records
-- This is a clean slate migration for the simplified gate pass system

-- Delete all gate pass notifications
DELETE FROM "gate_pass_notifications";

-- Delete all gate pass history
DELETE FROM "gate_pass_history";

-- Delete all gate passes
DELETE FROM "gate_passes";

-- Reset sequences (optional, keeps IDs clean)
-- ALTER SEQUENCE gate_passes_id_seq RESTART WITH 1;
