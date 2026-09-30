-- =====================================================
-- EVENT MANAGEMENT MODULE - ROLLBACK SCRIPT
-- =====================================================
-- This file contains SQL queries to UNDO the Event Management module
-- Use with caution - this will delete ALL event-related data
-- 
-- Created: 2026-02-07
-- Module: Event Management Rollback
-- =====================================================

-- ⚠️ WARNING: This script will permanently delete:
-- - All events
-- - All registrations
-- - All volunteers
-- - All entry/exit records
-- - Event fields from noting table
-- - All event-related enums

-- Uncomment the line below to proceed with rollback
-- SET client_min_messages TO WARNING;

BEGIN;

-- Step 1: Drop all foreign key constraints first
-- =====================================================

DO $$ 
BEGIN
    -- EventEntry foreign keys
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventEntry_eventId_fkey') THEN
        ALTER TABLE "EventEntry" DROP CONSTRAINT "EventEntry_eventId_fkey";
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventEntry_registrationId_fkey') THEN
        ALTER TABLE "EventEntry" DROP CONSTRAINT "EventEntry_registrationId_fkey";
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventEntry_volunteerId_fkey') THEN
        ALTER TABLE "EventEntry" DROP CONSTRAINT "EventEntry_volunteerId_fkey";
    END IF;

    -- EventVolunteer foreign keys
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventVolunteer_eventId_fkey') THEN
        ALTER TABLE "EventVolunteer" DROP CONSTRAINT "EventVolunteer_eventId_fkey";
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventVolunteer_userId_fkey') THEN
        ALTER TABLE "EventVolunteer" DROP CONSTRAINT "EventVolunteer_userId_fkey";
    END IF;

    -- EventRegistration foreign keys
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventRegistration_eventId_fkey') THEN
        ALTER TABLE "EventRegistration" DROP CONSTRAINT "EventRegistration_eventId_fkey";
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EventRegistration_userId_fkey') THEN
        ALTER TABLE "EventRegistration" DROP CONSTRAINT "EventRegistration_userId_fkey";
    END IF;

    -- Event foreign keys
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Event_notingId_fkey') THEN
        ALTER TABLE "Event" DROP CONSTRAINT "Event_notingId_fkey";
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Event_createdById_fkey') THEN
        ALTER TABLE "Event" DROP CONSTRAINT "Event_createdById_fkey";
    END IF;

    RAISE NOTICE '✓ Foreign key constraints dropped';
END $$;


-- Step 2: Drop all indexes
-- =====================================================

-- EventEntry indexes
DROP INDEX IF EXISTS "EventEntry_eventId_idx";
DROP INDEX IF EXISTS "EventEntry_registrationId_idx";
DROP INDEX IF EXISTS "EventEntry_volunteerId_idx";
DROP INDEX IF EXISTS "EventEntry_entryType_idx";
DROP INDEX IF EXISTS "EventEntry_scannedAt_idx";

-- EventVolunteer indexes
DROP INDEX IF EXISTS "EventVolunteer_eventId_idx";
DROP INDEX IF EXISTS "EventVolunteer_userId_idx";
DROP INDEX IF EXISTS "EventVolunteer_canScanQr_idx";

-- EventRegistration indexes
DROP INDEX IF EXISTS "EventRegistration_registrationId_idx";
DROP INDEX IF EXISTS "EventRegistration_eventId_idx";
DROP INDEX IF EXISTS "EventRegistration_userId_idx";
DROP INDEX IF EXISTS "EventRegistration_qrCode_idx";
DROP INDEX IF EXISTS "EventRegistration_status_idx";

-- Event indexes
DROP INDEX IF EXISTS "Event_eventId_idx";
DROP INDEX IF EXISTS "Event_notingId_idx";
DROP INDEX IF EXISTS "Event_status_idx";
DROP INDEX IF EXISTS "Event_eventType_idx";
DROP INDEX IF EXISTS "Event_createdById_idx";
DROP INDEX IF EXISTS "Event_startDate_idx";

-- Note event field index
DROP INDEX IF EXISTS "Note_eventName_idx";

DO $$ BEGIN RAISE NOTICE '✓ Indexes dropped'; END $$;


-- Step 3: Drop all tables
-- =====================================================

DROP TABLE IF EXISTS "EventEntry" CASCADE;
DROP TABLE IF EXISTS "EventVolunteer" CASCADE;
DROP TABLE IF EXISTS "EventRegistration" CASCADE;
DROP TABLE IF EXISTS "Event" CASCADE;

DO $$ BEGIN RAISE NOTICE '✓ Tables dropped'; END $$;


-- Step 4: Remove event fields from Note table
-- =====================================================

DO $$ 
BEGIN
    -- Drop columns if they exist
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Note' AND column_name = 'eventName'
    ) THEN
        ALTER TABLE "Note" DROP COLUMN "eventName";
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Note' AND column_name = 'eventType'
    ) THEN
        ALTER TABLE "Note" DROP COLUMN "eventType";
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Note' AND column_name = 'eventStartDate'
    ) THEN
        ALTER TABLE "Note" DROP COLUMN "eventStartDate";
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Note' AND column_name = 'eventEndDate'
    ) THEN
        ALTER TABLE "Note" DROP COLUMN "eventEndDate";
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Note' AND column_name = 'eventPaymentType'
    ) THEN
        ALTER TABLE "Note" DROP COLUMN "eventPaymentType";
    END IF;

    RAISE NOTICE '✓ Event fields removed from Note table';
END $$;


-- Step 5: Drop all enums
-- =====================================================

DROP TYPE IF EXISTS "EntryType" CASCADE;
DROP TYPE IF EXISTS "PaymentStatus" CASCADE;
DROP TYPE IF EXISTS "RegistrationStatus" CASCADE;
DROP TYPE IF EXISTS "EventStatus" CASCADE;
DROP TYPE IF EXISTS "EventPaymentType" CASCADE;
DROP TYPE IF EXISTS "EventType" CASCADE;

DO $$ BEGIN RAISE NOTICE '✓ Enums dropped'; END $$;


-- Step 6: Verify cleanup
-- =====================================================

DO $$ 
DECLARE
    remaining_tables INTEGER;
    remaining_enums INTEGER;
    remaining_columns INTEGER;
BEGIN
    -- Check for remaining event tables
    SELECT COUNT(*) INTO remaining_tables
    FROM information_schema.tables
    WHERE table_schema = 'public' 
        AND table_name IN ('Event', 'EventRegistration', 'EventVolunteer', 'EventEntry');

    -- Check for remaining enums
    SELECT COUNT(*) INTO remaining_enums
    FROM pg_type
    WHERE typname IN ('EventType', 'EventPaymentType', 'EventStatus', 'RegistrationStatus', 'PaymentStatus', 'EntryType');

    -- Check for remaining event columns in Note
    SELECT COUNT(*) INTO remaining_columns
    FROM information_schema.columns
    WHERE table_name = 'Note' 
        AND column_name IN ('eventName', 'eventType', 'eventStartDate', 'eventEndDate', 'eventPaymentType');

    IF remaining_tables = 0 AND remaining_enums = 0 AND remaining_columns = 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE '========================================';
        RAISE NOTICE '✓ ROLLBACK COMPLETED SUCCESSFULLY';
        RAISE NOTICE '========================================';
        RAISE NOTICE '✓ All Event Management tables removed';
        RAISE NOTICE '✓ All Event Management enums removed';
        RAISE NOTICE '✓ All event fields removed from Note table';
        RAISE NOTICE '';
        RAISE NOTICE 'Next steps:';
        RAISE NOTICE '1. Update Prisma schema (remove event models)';
        RAISE NOTICE '2. Regenerate Prisma client: npx prisma generate';
        RAISE NOTICE '3. Remove event backend modules';
        RAISE NOTICE '4. Remove event frontend components';
    ELSE
        RAISE WARNING 'Cleanup incomplete!';
        RAISE WARNING 'Remaining tables: %', remaining_tables;
        RAISE WARNING 'Remaining enums: %', remaining_enums;
        RAISE WARNING 'Remaining columns in Note: %', remaining_columns;
    END IF;
END $$;

COMMIT;

-- =====================================================
-- POST-ROLLBACK CLEANUP CHECKLIST
-- =====================================================

-- [] Remove event models from backend/prisma/schema.prisma
-- [] Run: npx prisma generate
-- [] Remove: backend/src/modules/event-management/
-- [] Remove: frontend/src/features/event-management/
-- [] Remove: frontend/src/app/events/
-- [] Remove event routes from backend/src/modules/core/routes/index.js
-- [] Update backend tests
-- [] Update frontend navigation

-- =====================================================
-- ROLLBACK SCRIPT END
-- =====================================================
