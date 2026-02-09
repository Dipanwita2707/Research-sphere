-- =====================================================
-- EVENT MANAGEMENT MODULE - MANUAL SQL MIGRATION
-- =====================================================
-- This file contains all SQL queries to set up the Event Management module
-- Execute these queries in your PostgreSQL database manually
-- 
-- Created: 2026-02-07
-- Module: Event Management
-- Dependencies: UserLogin table must exist
-- =====================================================

-- Step 1: Create ENUM types for Event Management
-- =====================================================

-- Event Type Enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventType') THEN
        CREATE TYPE "EventType" AS ENUM (
            'workshop',
            'seminar',
            'conference',
            'competition',
            'cultural',
            'sports',
            'tech_fest',
            'hackathon',
            'webinar',
            'other'
        );
    END IF;
END $$;

-- Event Payment Type Enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventPaymentType') THEN
        CREATE TYPE "EventPaymentType" AS ENUM ('free', 'paid');
    END IF;
END $$;

-- Event Status Enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventStatus') THEN
        CREATE TYPE "EventStatus" AS ENUM (
            'draft',
            'published',
            'ongoing',
            'completed',
            'cancelled'
        );
    END IF;
END $$;

-- Registration Status Enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RegistrationStatus') THEN
        CREATE TYPE "RegistrationStatus" AS ENUM (
            'pending',
            'confirmed',
            'cancelled',
            'waitlisted'
        );
    END IF;
END $$;

-- Payment Status Enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentStatus') THEN
        CREATE TYPE "PaymentStatus" AS ENUM (
            'pending',
            'completed',
            'failed',
            'refunded'
        );
    END IF;
END $$;

-- Entry Type Enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EntryType') THEN
        CREATE TYPE "EntryType" AS ENUM ('entry', 'exit');
    END IF;
END $$;


-- Step 2: Add Event-related fields to Note table
-- =====================================================

-- Add event fields to note table if they don't exist
DO $$ 
BEGIN
    -- Event Name
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'note' AND column_name = 'eventName'
    ) THEN
        ALTER TABLE "note" ADD COLUMN "eventName" TEXT;
    END IF;

    -- Event Type
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'note' AND column_name = 'eventType'
    ) THEN
        ALTER TABLE "note" ADD COLUMN "eventType" "EventType";
    END IF;

    -- Event Start Date
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'note' AND column_name = 'eventStartDate'
    ) THEN
        ALTER TABLE "note" ADD COLUMN "eventStartDate" TIMESTAMP(3);
    END IF;

    -- Event End Date
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'note' AND column_name = 'eventEndDate'
    ) THEN
        ALTER TABLE "note" ADD COLUMN "eventEndDate" TIMESTAMP(3);
    END IF;

    -- Event Payment Type
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'note' AND column_name = 'eventPaymentType'
    ) THEN
        ALTER TABLE "note" ADD COLUMN "eventPaymentType" "EventPaymentType";
    END IF;
END $$;

-- Add index on eventName for faster searches (drop if exists first)
DROP INDEX IF EXISTS "note_eventName_idx";
CREATE INDEX "note_eventName_idx" ON "note"("eventName");


-- Step 3: Create Event table
-- =====================================================

-- Drop existing Event table if structure needs to change
DROP TABLE IF EXISTS "EventEntry" CASCADE;
DROP TABLE IF EXISTS "EventVolunteer" CASCADE;
DROP TABLE IF EXISTS "EventRegistration" CASCADE;
DROP TABLE IF EXISTS "Event" CASCADE;

CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "notingId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "paymentType" "EventPaymentType" NOT NULL,
    "venue" TEXT,
    "maxCapacity" INTEGER,
    "registrationFee" DOUBLE PRECISION,
    "registrationStartDate" TIMESTAMP(3),
    "registrationEndDate" TIMESTAMP(3),
    "status" "EventStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on eventId
ALTER TABLE "Event" ADD CONSTRAINT "Event_eventId_key" UNIQUE ("eventId");

-- Create unique constraint on notingId (one event per noting)
ALTER TABLE "Event" ADD CONSTRAINT "Event_notingId_key" UNIQUE ("notingId");

-- Create indexes for Event table
CREATE INDEX "Event_eventId_idx" ON "Event"("eventId");
CREATE INDEX "Event_notingId_idx" ON "Event"("notingId");
CREATE INDEX "Event_status_idx" ON "Event"("status");
CREATE INDEX "Event_eventType_idx" ON "Event"("eventType");
CREATE INDEX "Event_createdById_idx" ON "Event"("createdById");
CREATE INDEX "Event_startDate_idx" ON "Event"("startDate");

-- Add foreign key constraints for Event
ALTER TABLE "Event" ADD CONSTRAINT "Event_notingId_fkey" 
    FOREIGN KEY ("notingId") REFERENCES "note"("id") 
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" 
    FOREIGN KEY ("createdById") REFERENCES "user_login"("id") 
    ON DELETE RESTRICT ON UPDATE CASCADE;


-- Step 4: Create EventRegistration table
-- =====================================================

CREATE TABLE "EventRegistration" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'pending',
    "qrCode" TEXT NOT NULL,
    "paymentStatus" "PaymentStatus",
    "paymentId" TEXT,
    "amountPaid" DOUBLE PRECISION,
    "hasEntered" BOOLEAN NOT NULL DEFAULT false,
    "enteredAt" TIMESTAMP(3),
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventRegistration_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on registrationId
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_registrationId_key" 
    UNIQUE ("registrationId");

-- Create unique constraint on qrCode
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_qrCode_key" 
    UNIQUE ("qrCode");

-- Create composite unique constraint (one registration per user per event)
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_eventId_userId_key" 
    UNIQUE ("eventId", "userId");

-- Create indexes for EventRegistration table
CREATE INDEX "EventRegistration_registrationId_idx" ON "EventRegistration"("registrationId");
CREATE INDEX "EventRegistration_eventId_idx" ON "EventRegistration"("eventId");
CREATE INDEX "EventRegistration_userId_idx" ON "EventRegistration"("userId");
CREATE INDEX "EventRegistration_qrCode_idx" ON "EventRegistration"("qrCode");
CREATE INDEX "EventRegistration_status_idx" ON "EventRegistration"("status");

-- Add foreign key constraints for EventRegistration
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_eventId_fkey" 
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "user_login"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;


-- Step 5: Create EventVolunteer table
-- =====================================================

CREATE TABLE "EventVolunteer" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "role" TEXT,
    "canScanQr" BOOLEAN NOT NULL DEFAULT false,
    "assignedGate" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventVolunteer_pkey" PRIMARY KEY ("id")
);

-- Create composite unique constraint (one volunteer assignment per user per event)
ALTER TABLE "EventVolunteer" ADD CONSTRAINT "EventVolunteer_eventId_userId_key" 
    UNIQUE ("eventId", "userId");

-- Create indexes for EventVolunteer table
CREATE INDEX "EventVolunteer_eventId_idx" ON "EventVolunteer"("eventId");
CREATE INDEX "EventVolunteer_userId_idx" ON "EventVolunteer"("userId");
CREATE INDEX "EventVolunteer_canScanQr_idx" ON "EventVolunteer"("canScanQr");

-- Add foreign key constraints for EventVolunteer
ALTER TABLE "EventVolunteer" ADD CONSTRAINT "EventVolunteer_eventId_fkey" 
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventVolunteer" ADD CONSTRAINT "EventVolunteer_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "user_login"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;


-- Step 6: Create EventEntry table
-- =====================================================

CREATE TABLE "EventEntry" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "entryType" "EntryType" NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gateLocation" TEXT,
    "remarks" TEXT,

    CONSTRAINT "EventEntry_pkey" PRIMARY KEY ("id")
);

-- Create indexes for EventEntry table
CREATE INDEX "EventEntry_eventId_idx" ON "EventEntry"("eventId");
CREATE INDEX "EventEntry_registrationId_idx" ON "EventEntry"("registrationId");
CREATE INDEX "EventEntry_volunteerId_idx" ON "EventEntry"("volunteerId");
CREATE INDEX "EventEntry_entryType_idx" ON "EventEntry"("entryType");
CREATE INDEX "EventEntry_scannedAt_idx" ON "EventEntry"("scannedAt");

-- Add foreign key constraints for EventEntry
ALTER TABLE "EventEntry" ADD CONSTRAINT "EventEntry_eventId_fkey" 
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventEntry" ADD CONSTRAINT "EventEntry_registrationId_fkey" 
    FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventEntry" ADD CONSTRAINT "EventEntry_volunteerId_fkey" 
    FOREIGN KEY ("volunteerId") REFERENCES "EventVolunteer"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;


-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these queries to verify the tables were created successfully

-- Check all Event Management tables exist
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
    AND table_name IN ('Event', 'EventRegistration', 'EventVolunteer', 'EventEntry')
ORDER BY table_name;

-- Check all Event Management enums exist
SELECT 
    typname as enum_name,
    array_agg(enumlabel ORDER BY enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname IN ('EventType', 'EventPaymentType', 'EventStatus', 'RegistrationStatus', 'PaymentStatus', 'EntryType')
GROUP BY typname
ORDER BY typname;

-- Check event fields added to Note table
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'note' 
    AND column_name IN ('eventName', 'eventType', 'eventStartDate', 'eventEndDate', 'eventPaymentType')
ORDER BY column_name;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$ 
BEGIN
    RAISE NOTICE '✓ Event Management Module tables created successfully!';
    RAISE NOTICE '✓ Tables: Event, EventRegistration, EventVolunteer, EventEntry';
    RAISE NOTICE '✓ Enums: EventType, EventPaymentType, EventStatus, RegistrationStatus, PaymentStatus, EntryType';
    RAISE NOTICE '✓ Note table updated with event fields';
    RAISE NOTICE '✓ All indexes and foreign keys configured';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Verify tables using the verification queries above';
    RAISE NOTICE '2. Update Prisma client: npx prisma generate';
    RAISE NOTICE '3. Test the Event Management endpoints';
END $$;
