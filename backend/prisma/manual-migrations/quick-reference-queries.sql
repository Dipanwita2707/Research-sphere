-- =====================================================
-- EVENT MANAGEMENT MODULE - QUICK REFERENCE QUERIES
-- =====================================================
-- Common SQL queries for Event Management module
-- Use these for testing, debugging, and data exploration
-- =====================================================

-- =====================================================
-- 1. VERIFICATION & STATUS QUERIES
-- =====================================================

-- Check all Event Management tables exist
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
    AND table_name IN ('Event', 'EventRegistration', 'EventVolunteer', 'EventEntry')
ORDER BY table_name;

-- Check all enums exist
SELECT 
    typname as enum_name,
    array_agg(enumlabel ORDER BY enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname IN ('EventType', 'EventPaymentType', 'EventStatus', 'RegistrationStatus', 'PaymentStatus', 'EntryType')
GROUP BY typname
ORDER BY typname;

-- Check foreign key relationships
SELECT
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('Event', 'EventRegistration', 'EventVolunteer', 'EventEntry')
ORDER BY tc.table_name, kcu.column_name;


-- =====================================================
-- 2. EVENT QUERIES
-- =====================================================

-- List all events with basic info
SELECT 
    e."eventId",
    e."name",
    e."eventType",
    e."status",
    e."paymentType",
    e."startDate",
    e."endDate",
    e."venue",
    u."name" as creator_name,
    e."createdAt"
FROM "Event" e
LEFT JOIN "UserLogin" u ON e."createdById" = u."id"
ORDER BY e."startDate" DESC;

-- Get event details with statistics
SELECT 
    e."eventId",
    e."name",
    e."status",
    e."eventType",
    COUNT(DISTINCT er."id") as total_registrations,
    COUNT(DISTINCT CASE WHEN er."status" = 'confirmed' THEN er."id" END) as confirmed_count,
    COUNT(DISTINCT CASE WHEN er."hasEntered" = true THEN er."id" END) as attended_count,
    COUNT(DISTINCT ev."id") as volunteer_count,
    SUM(er."amountPaid") as total_revenue
FROM "Event" e
LEFT JOIN "EventRegistration" er ON e."id" = er."eventId"
LEFT JOIN "EventVolunteer" ev ON e."id" = ev."eventId"
GROUP BY e."id", e."eventId", e."name", e."status", e."eventType";

-- Get events by status
SELECT 
    "eventId",
    "name",
    "eventType",
    "startDate",
    "endDate",
    "status"
FROM "Event"
WHERE "status" = 'published'  -- Change to: draft, published, ongoing, completed, cancelled
ORDER BY "startDate" ASC;

-- Get upcoming events
SELECT 
    "eventId",
    "name",
    "eventType",
    "startDate",
    "venue",
    "paymentType"
FROM "Event"
WHERE "status" = 'published'
    AND "startDate" > NOW()
ORDER BY "startDate" ASC
LIMIT 10;

-- Get events created by specific user
SELECT 
    e."eventId",
    e."name",
    e."status",
    e."startDate",
    COUNT(er."id") as registration_count
FROM "Event" e
LEFT JOIN "EventRegistration" er ON e."id" = er."eventId"
WHERE e."createdById" = 'USER_ID_HERE'
GROUP BY e."id"
ORDER BY e."createdAt" DESC;


-- =====================================================
-- 3. REGISTRATION QUERIES
-- =====================================================

-- Get all registrations for an event
SELECT 
    er."registrationId",
    er."status",
    er."hasEntered",
    er."enteredAt",
    u."name" as user_name,
    u."email",
    er."registeredAt"
FROM "EventRegistration" er
JOIN "UserLogin" u ON er."userId" = u."id"
WHERE er."eventId" = (SELECT "id" FROM "Event" WHERE "eventId" = 'EVT-2026-001')
ORDER BY er."registeredAt" DESC;

-- Get user's registrations
SELECT 
    e."eventId",
    e."name",
    e."startDate",
    e."venue",
    er."status",
    er."qrCode",
    er."hasEntered",
    er."registeredAt"
FROM "EventRegistration" er
JOIN "Event" e ON er."eventId" = e."id"
WHERE er."userId" = 'USER_ID_HERE'
ORDER BY e."startDate" DESC;

-- Get confirmed registrations for an event
SELECT 
    COUNT(*) as confirmed_count,
    e."maxCapacity",
    CASE 
        WHEN e."maxCapacity" IS NULL THEN 'Unlimited'
        ELSE CONCAT(ROUND((COUNT(*)::decimal / e."maxCapacity") * 100, 1), '%')
    END as capacity_percentage
FROM "EventRegistration" er
JOIN "Event" e ON er."eventId" = e."id"
WHERE e."eventId" = 'EVT-2026-001'
    AND er."status" = 'confirmed'
GROUP BY e."maxCapacity";

-- Get registrations needing confirmation
SELECT 
    er."registrationId",
    u."name",
    u."email",
    e."name" as event_name,
    er."registeredAt"
FROM "EventRegistration" er
JOIN "UserLogin" u ON er."userId" = u."id"
JOIN "Event" e ON er."eventId" = e."id"
WHERE er."status" = 'pending'
ORDER BY er."registeredAt" ASC;


-- =====================================================
-- 4. VOLUNTEER QUERIES
-- =====================================================

-- Get all volunteers for an event
SELECT 
    u."name",
    u."email",
    ev."role",
    ev."assignedGate",
    ev."canScanQr",
    ev."assignedAt",
    COUNT(ee."id") as scans_performed
FROM "EventVolunteer" ev
JOIN "UserLogin" u ON ev."userId" = u."id"
LEFT JOIN "EventEntry" ee ON ev."id" = ee."volunteerId"
WHERE ev."eventId" = (SELECT "id" FROM "Event" WHERE "eventId" = 'EVT-2026-001')
GROUP BY ev."id", u."name", u."email", ev."role", ev."assignedGate", ev."canScanQr", ev."assignedAt"
ORDER BY ev."assignedAt" DESC;

-- Get volunteers with QR scanning permission
SELECT 
    e."eventId",
    e."name" as event_name,
    u."name" as volunteer_name,
    ev."role",
    ev."assignedGate"
FROM "EventVolunteer" ev
JOIN "Event" e ON ev."eventId" = e."id"
JOIN "UserLogin" u ON ev."userId" = u."id"
WHERE ev."canScanQr" = true
ORDER BY e."startDate", u."name";

-- Get events where user is a volunteer
SELECT 
    e."eventId",
    e."name",
    e."startDate",
    ev."role",
    ev."canScanQr"
FROM "EventVolunteer" ev
JOIN "Event" e ON ev."eventId" = e."id"
WHERE ev."userId" = 'USER_ID_HERE'
ORDER BY e."startDate" DESC;


-- =====================================================
-- 5. ENTRY/EXIT QUERIES
-- =====================================================

-- Get all entries for an event
SELECT 
    ee."entryType",
    ee."scannedAt",
    ee."gateLocation",
    u."name" as attendee_name,
    er."registrationId",
    vol."name" as scanned_by,
    ee."remarks"
FROM "EventEntry" ee
JOIN "EventRegistration" er ON ee."registrationId" = er."id"
JOIN "UserLogin" u ON er."userId" = u."id"
JOIN "EventVolunteer" ev ON ee."volunteerId" = ev."id"
JOIN "UserLogin" vol ON ev."userId" = vol."id"
WHERE ee."eventId" = (SELECT "id" FROM "Event" WHERE "eventId" = 'EVT-2026-001')
ORDER BY ee."scannedAt" DESC;

-- Get current attendees inside event (entered but not exited)
SELECT 
    u."name",
    er."registrationId",
    MAX(CASE WHEN ee."entryType" = 'entry' THEN ee."scannedAt" END) as last_entry,
    MAX(CASE WHEN ee."entryType" = 'exit' THEN ee."scannedAt" END) as last_exit
FROM "EventRegistration" er
JOIN "UserLogin" u ON er."userId" = u."id"
JOIN "EventEntry" ee ON er."id" = ee."registrationId"
WHERE er."eventId" = (SELECT "id" FROM "Event" WHERE "eventId" = 'EVT-2026-001')
GROUP BY er."id", u."name", er."registrationId"
HAVING MAX(CASE WHEN ee."entryType" = 'entry' THEN ee."scannedAt" END) > 
       COALESCE(MAX(CASE WHEN ee."entryType" = 'exit' THEN ee."scannedAt" END), '1970-01-01');

-- Get entry/exit statistics
SELECT 
    e."eventId",
    e."name",
    COUNT(DISTINCT CASE WHEN ee."entryType" = 'entry' THEN ee."registrationId" END) as total_entries,
    COUNT(DISTINCT CASE WHEN ee."entryType" = 'exit' THEN ee."registrationId" END) as total_exits,
    COUNT(DISTINCT ee."registrationId") as unique_attendees
FROM "Event" e
LEFT JOIN "EventEntry" ee ON e."id" = ee."eventId"
GROUP BY e."id"
ORDER BY e."startDate" DESC;

-- Get scan activity by volunteer
SELECT 
    u."name" as volunteer_name,
    ev."role",
    COUNT(*) as total_scans,
    COUNT(CASE WHEN ee."entryType" = 'entry' THEN 1 END) as entries_scanned,
    COUNT(CASE WHEN ee."entryType" = 'exit' THEN 1 END) as exits_scanned,
    MIN(ee."scannedAt") as first_scan,
    MAX(ee."scannedAt") as last_scan
FROM "EventVolunteer" ev
JOIN "UserLogin" u ON ev."userId" = u."id"
LEFT JOIN "EventEntry" ee ON ev."id" = ee."volunteerId"
WHERE ev."eventId" = (SELECT "id" FROM "Event" WHERE "eventId" = 'EVT-2026-001')
GROUP BY ev."id", u."name", ev."role"
ORDER BY total_scans DESC;


-- =====================================================
-- 6. ANALYTICS QUERIES
-- =====================================================

-- Event revenue summary (for paid events)
SELECT 
    e."eventId",
    e."name",
    e."registrationFee",
    COUNT(er."id") as total_registrations,
    COUNT(CASE WHEN er."paymentStatus" = 'completed' THEN 1 END) as paid_count,
    SUM(er."amountPaid") as total_revenue,
    SUM(CASE WHEN er."paymentStatus" = 'completed' THEN er."amountPaid" ELSE 0 END) as confirmed_revenue
FROM "Event" e
LEFT JOIN "EventRegistration" er ON e."id" = er."eventId"
WHERE e."paymentType" = 'paid'
GROUP BY e."id"
ORDER BY total_revenue DESC;

-- Registration trends by date
SELECT 
    DATE(er."registeredAt") as registration_date,
    COUNT(*) as registrations_count
FROM "EventRegistration" er
WHERE er."eventId" = (SELECT "id" FROM "Event" WHERE "eventId" = 'EVT-2026-001')
GROUP BY DATE(er."registeredAt")
ORDER BY registration_date ASC;

-- Event attendance rate
SELECT 
    e."eventId",
    e."name",
    COUNT(DISTINCT er."id") as total_registered,
    COUNT(DISTINCT CASE WHEN er."hasEntered" THEN er."id" END) as attended,
    ROUND((COUNT(DISTINCT CASE WHEN er."hasEntered" THEN er."id" END)::decimal / 
           NULLIF(COUNT(DISTINCT er."id"), 0)) * 100, 2) as attendance_percentage
FROM "Event" e
LEFT JOIN "EventRegistration" er ON e."id" = er."eventId"
WHERE e."status" IN ('completed', 'ongoing')
GROUP BY e."id"
ORDER BY e."startDate" DESC;

-- Popular event types
SELECT 
    "eventType",
    COUNT(*) as event_count,
    SUM((SELECT COUNT(*) FROM "EventRegistration" WHERE "eventId" = e."id")) as total_registrations,
    ROUND(AVG((SELECT COUNT(*) FROM "EventRegistration" WHERE "eventId" = e."id")), 2) as avg_registrations_per_event
FROM "Event" e
GROUP BY "eventType"
ORDER BY event_count DESC;


-- =====================================================
-- 7. DATA CLEANUP QUERIES (Use with caution!)
-- =====================================================

-- Delete cancelled registrations older than 30 days
-- DELETE FROM "EventRegistration"
-- WHERE "status" = 'cancelled'
--     AND "updatedAt" < NOW() - INTERVAL '30 days';

-- Cancel event and all registrations
-- UPDATE "Event" SET "status" = 'cancelled', "updatedAt" = NOW()
-- WHERE "eventId" = 'EVT-2026-001';
-- 
-- UPDATE "EventRegistration" 
-- SET "status" = 'cancelled', "updatedAt" = NOW()
-- WHERE "eventId" = (SELECT "id" FROM "Event" WHERE "eventId" = 'EVT-2026-001');

-- Remove all event data for a specific event (CASCADE will handle related records)
-- DELETE FROM "Event" WHERE "eventId" = 'EVT-2026-001';


-- =====================================================
-- 8. USEFUL HELPER QUERIES
-- =====================================================

-- Find events with capacity issues (over capacity)
SELECT 
    e."eventId",
    e."name",
    e."maxCapacity",
    COUNT(er."id") as current_registrations,
    COUNT(er."id") - e."maxCapacity" as over_capacity_by
FROM "Event" e
LEFT JOIN "EventRegistration" er ON e."id" = er."eventId" AND er."status" = 'confirmed'
WHERE e."maxCapacity" IS NOT NULL
GROUP BY e."id"
HAVING COUNT(er."id") > e."maxCapacity";

-- Find duplicate QR codes (should never happen!)
SELECT 
    "qrCode",
    COUNT(*) as duplicate_count
FROM "EventRegistration"
GROUP BY "qrCode"
HAVING COUNT(*) > 1;

-- Find users registered for multiple events on same date
SELECT 
    u."name",
    u."email",
    DATE(e."startDate") as event_date,
    array_agg(e."name") as events
FROM "EventRegistration" er
JOIN "Event" e ON er."eventId" = e."id"
JOIN "UserLogin" u ON er."userId" = u."id"
WHERE er."status" = 'confirmed'
GROUP BY u."id", u."name", u."email", DATE(e."startDate")
HAVING COUNT(DISTINCT e."id") > 1;

-- Get events needing volunteers
SELECT 
    e."eventId",
    e."name",
    e."startDate",
    COUNT(DISTINCT ev."id") as volunteer_count,
    CASE 
        WHEN COUNT(DISTINCT ev."id") = 0 THEN 'URGENT: No volunteers'
        WHEN COUNT(DISTINCT ev."id") < 3 THEN 'WARNING: Few volunteers'
        ELSE 'OK'
    END as volunteer_status
FROM "Event" e
LEFT JOIN "EventVolunteer" ev ON e."id" = ev."eventId"
WHERE e."status" IN ('published', 'ongoing')
    AND e."startDate" > NOW()
GROUP BY e."id"
ORDER BY e."startDate" ASC;


-- =====================================================
-- END OF QUICK REFERENCE QUERIES
-- =====================================================
