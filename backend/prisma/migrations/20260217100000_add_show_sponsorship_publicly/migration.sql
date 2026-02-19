-- AlterTable
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "show_sponsorship_publicly" BOOLEAN DEFAULT false;
