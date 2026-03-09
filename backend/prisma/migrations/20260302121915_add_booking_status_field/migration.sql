-- CreateEnum
CREATE TYPE "booking_status_enum" AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');

-- AlterTable
ALTER TABLE "hostel_booking" ADD COLUMN IF NOT EXISTS "booking_status" "booking_status_enum" NOT NULL DEFAULT 'pending';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "hostel_booking_booking_status_idx" ON "hostel_booking"("booking_status");
