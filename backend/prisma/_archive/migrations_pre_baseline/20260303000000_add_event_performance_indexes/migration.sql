-- Performance indexes for event management module
-- Composite indexes for frequently queried patterns

-- EventEntry: statistics queries filter by (eventId, entryType)
CREATE INDEX IF NOT EXISTS "event_entry_eventId_entryType_idx" ON "EventEntry"("eventId", "entryType");

-- EventRegistration: payment status filtering per event
CREATE INDEX IF NOT EXISTS "event_registration_eventId_paymentStatus_idx" ON "EventRegistration"("eventId", "paymentStatus");

-- EventRegistration: dashboard queries filter by (userId, status)
CREATE INDEX IF NOT EXISTS "event_registration_userId_status_idx" ON "EventRegistration"("userId", "status");

-- StallFeedback: aggregation queries filter by (stallId, eventId)
CREATE INDEX IF NOT EXISTS "stall_feedback_stallId_eventId_idx" ON "stall_feedback"("stall_id", "event_id");

-- Payment: composite indexes for payment lookups
CREATE INDEX IF NOT EXISTS "payment_eventId_status_idx" ON "payment"("eventId", "status");
CREATE INDEX IF NOT EXISTS "payment_registrationId_status_idx" ON "payment"("registrationId", "status");
CREATE INDEX IF NOT EXISTS "payment_teamId_eventId_idx" ON "payment"("teamId", "eventId");

-- StallApplication: filter by event + status
CREATE INDEX IF NOT EXISTS "stall_application_eventId_status_idx" ON "stall_application"("event_id", "application_status");

-- EventTeamMember: team member queries by team + status
CREATE INDEX IF NOT EXISTS "event_team_member_teamId_status_idx" ON "event_team_member"("teamId", "status");

-- GIN indexes for EventVisibility JSON array fields (enables fast @> containment queries)
CREATE INDEX IF NOT EXISTS "event_visibility_visibleToRoles_gin" ON "event_visibility" USING GIN ("visibleToRoles");
CREATE INDEX IF NOT EXISTS "event_visibility_allowedSchoolIds_gin" ON "event_visibility" USING GIN ("allowed_school_ids");
CREATE INDEX IF NOT EXISTS "event_visibility_allowedDepartmentIds_gin" ON "event_visibility" USING GIN ("allowed_department_ids");
CREATE INDEX IF NOT EXISTS "event_visibility_allowedProgramIds_gin" ON "event_visibility" USING GIN ("allowed_program_ids");
CREATE INDEX IF NOT EXISTS "event_visibility_allowedBatchYears_gin" ON "event_visibility" USING GIN ("allowed_batch_years");
CREATE INDEX IF NOT EXISTS "event_visibility_allowedSectionIds_gin" ON "event_visibility" USING GIN ("allowed_section_ids");
