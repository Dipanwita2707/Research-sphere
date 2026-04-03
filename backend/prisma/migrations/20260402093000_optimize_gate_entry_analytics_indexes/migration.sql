-- Gate Entry analytics performance indexes
-- Speeds up status/date aggregations, recent activity sorting, and guest house analytics scans.

CREATE INDEX IF NOT EXISTS gate_pass_pass_status_idx ON gate_pass(pass_status);
CREATE INDEX IF NOT EXISTS gate_pass_visit_date_pass_status_idx ON gate_pass(visit_date, pass_status);
CREATE INDEX IF NOT EXISTS gate_pass_entry_guard_idx ON gate_pass(entry_guard_id);
CREATE INDEX IF NOT EXISTS gate_pass_exit_guard_idx ON gate_pass(exit_guard_id);
CREATE INDEX IF NOT EXISTS gate_pass_actual_exit_time_idx ON gate_pass(actual_exit_time);

CREATE INDEX IF NOT EXISTS gate_pass_history_created_at_idx ON gate_pass_history(created_at DESC);
CREATE INDEX IF NOT EXISTS gate_pass_history_performed_by_created_at_idx ON gate_pass_history(performed_by_id, created_at DESC);

CREATE INDEX IF NOT EXISTS hostel_booking_created_at_idx ON hostel_booking(created_at DESC);
CREATE INDEX IF NOT EXISTS hostel_booking_booking_status_created_at_idx ON hostel_booking(booking_status, created_at DESC);
CREATE INDEX IF NOT EXISTS hostel_booking_hostel_name_idx ON hostel_booking(hostel_name);
CREATE INDEX IF NOT EXISTS hostel_booking_payment_status_idx ON hostel_booking(payment_status);

CREATE INDEX IF NOT EXISTS refund_transactions_processed_at_idx ON refund_transactions(processed_at DESC);
