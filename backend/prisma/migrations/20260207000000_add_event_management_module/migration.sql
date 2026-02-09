-- CreateEnum: Event Type
CREATE TYPE "EventType" AS ENUM ('workshop', 'seminar', 'conference', 'competition', 'cultural', 'sports', 'tech_fest', 'hackathon', 'webinar', 'other');

-- CreateEnum: Event Payment Type
CREATE TYPE "EventPaymentType" AS ENUM ('free', 'paid');

-- CreateEnum: Event Status
CREATE TYPE "EventStatus" AS ENUM ('draft', 'published', 'ongoing', 'completed', 'cancelled');

-- CreateEnum: Registration Status
CREATE TYPE "RegistrationStatus" AS ENUM ('pending', 'confirmed', 'cancelled', 'waitlisted');

-- CreateEnum: Payment Status
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- CreateEnum: Entry Type
CREATE TYPE "EntryType" AS ENUM ('entry', 'exit');

-- AlterTable: Add event fields to note table
ALTER TABLE "note" ADD COLUMN "eventName" TEXT;
ALTER TABLE "note" ADD COLUMN "eventType" "EventType";
ALTER TABLE "note" ADD COLUMN "eventStartDate" TIMESTAMP(3);
ALTER TABLE "note" ADD COLUMN "eventEndDate" TIMESTAMP(3);
ALTER TABLE "note" ADD COLUMN "eventPaymentType" "EventPaymentType";

-- CreateTable: Event
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "notingId" TEXT NOT NULL,
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
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable: EventRegistration
CREATE TABLE "EventRegistration" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
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

-- CreateTable: EventVolunteer
CREATE TABLE "EventVolunteer" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,
    "canScanQr" BOOLEAN NOT NULL DEFAULT false,
    "assignedGate" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventVolunteer_pkey" PRIMARY KEY ("id")
);

-- CreateTable: EventEntry
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

-- CreateIndex: Note event fields
CREATE INDEX "Note_eventName_idx" ON "Note"("eventName");

-- CreateIndex: Event
CREATE UNIQUE INDEX "Event_eventId_key" ON "Event"("eventId");
CREATE UNIQUE INDEX "Event_notingId_key" ON "Event"("notingId");
CREATE INDEX "Event_eventId_idx" ON "Event"("eventId");
CREATE INDEX "Event_notingId_idx" ON "Event"("notingId");
CREATE INDEX "Event_status_idx" ON "Event"("status");
CREATE INDEX "Event_eventType_idx" ON "Event"("eventType");
CREATE INDEX "Event_createdById_idx" ON "Event"("createdById");
CREATE INDEX "Event_startDate_idx" ON "Event"("startDate");

-- CreateIndex: EventRegistration
CREATE UNIQUE INDEX "EventRegistration_registrationId_key" ON "EventRegistration"("registrationId");
CREATE UNIQUE INDEX "EventRegistration_qrCode_key" ON "EventRegistration"("qrCode");
CREATE UNIQUE INDEX "EventRegistration_eventId_userId_key" ON "EventRegistration"("eventId", "userId");
CREATE INDEX "EventRegistration_registrationId_idx" ON "EventRegistration"("registrationId");
CREATE INDEX "EventRegistration_eventId_idx" ON "EventRegistration"("eventId");
CREATE INDEX "EventRegistration_userId_idx" ON "EventRegistration"("userId");
CREATE INDEX "EventRegistration_qrCode_idx" ON "EventRegistration"("qrCode");
CREATE INDEX "EventRegistration_status_idx" ON "EventRegistration"("status");

-- CreateIndex: EventVolunteer
CREATE UNIQUE INDEX "EventVolunteer_eventId_userId_key" ON "EventVolunteer"("eventId", "userId");
CREATE INDEX "EventVolunteer_eventId_idx" ON "EventVolunteer"("eventId");
CREATE INDEX "EventVolunteer_userId_idx" ON "EventVolunteer"("userId");
CREATE INDEX "EventVolunteer_canScanQr_idx" ON "EventVolunteer"("canScanQr");

-- CreateIndex: EventEntry
CREATE INDEX "EventEntry_eventId_idx" ON "EventEntry"("eventId");
CREATE INDEX "EventEntry_registrationId_idx" ON "EventEntry"("registrationId");
CREATE INDEX "EventEntry_volunteerId_idx" ON "EventEntry"("volunteerId");
CREATE INDEX "EventEntry_entryType_idx" ON "EventEntry"("entryType");
CREATE INDEX "EventEntry_scannedAt_idx" ON "EventEntry"("scannedAt");

-- AddForeignKey: Event
ALTER TABLE "Event" ADD CONSTRAINT "Event_notingId_fkey" FOREIGN KEY ("notingId") REFERENCES "note"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: EventRegistration
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: EventVolunteer
ALTER TABLE "EventVolunteer" ADD CONSTRAINT "EventVolunteer_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventVolunteer" ADD CONSTRAINT "EventVolunteer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: EventEntry
ALTER TABLE "EventEntry" ADD CONSTRAINT "EventEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventEntry" ADD CONSTRAINT "EventEntry_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventEntry" ADD CONSTRAINT "EventEntry_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "EventVolunteer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
