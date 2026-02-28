-- Add duty leave role type to Note and Event
-- Policy: Only students (UG, PG, PhD) eligible. Faculty/Staff NOT eligible.
-- Role type: participants (students participating) | organizers (students organizing) | both

ALTER TABLE "note" ADD COLUMN "event_duty_leave_role_type" VARCHAR(32);
ALTER TABLE "Event" ADD COLUMN "duty_leave_role_type" VARCHAR(32);
