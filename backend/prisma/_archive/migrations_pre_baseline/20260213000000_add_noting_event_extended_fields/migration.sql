-- CreateEnum: Participation Type
CREATE TYPE "ParticipationType" AS ENUM ('individual', 'team');

-- AlterTable: Add extended event fields to Note
ALTER TABLE "note" ADD COLUMN "event_participation_type" "ParticipationType";
ALTER TABLE "note" ADD COLUMN "event_registration_fee_individual" DOUBLE PRECISION;
ALTER TABLE "note" ADD COLUMN "event_registration_fee_team" DOUBLE PRECISION;
ALTER TABLE "note" ADD COLUMN "event_approx_capacity" INTEGER;
ALTER TABLE "note" ADD COLUMN "event_duty_leave_available" BOOLEAN;
ALTER TABLE "note" ADD COLUMN "event_duty_leave_eligibility" JSONB;
ALTER TABLE "note" ADD COLUMN "event_has_sponsorship" BOOLEAN;
ALTER TABLE "note" ADD COLUMN "event_sponsors" JSONB;
ALTER TABLE "note" ADD COLUMN "event_has_resources" BOOLEAN;
ALTER TABLE "note" ADD COLUMN "event_resources" JSONB;

-- AlterTable: Add extended fields to Event
ALTER TABLE "Event" ADD COLUMN "approx_capacity" INTEGER;
ALTER TABLE "Event" ADD COLUMN "team_registration_fee" DOUBLE PRECISION;
ALTER TABLE "Event" ADD COLUMN "duty_leave_available" BOOLEAN;
ALTER TABLE "Event" ADD COLUMN "duty_leave_eligibility" JSONB;
ALTER TABLE "Event" ADD COLUMN "has_sponsorship" BOOLEAN;
ALTER TABLE "Event" ADD COLUMN "sponsors" JSONB;
ALTER TABLE "Event" ADD COLUMN "has_resources" BOOLEAN;
ALTER TABLE "Event" ADD COLUMN "resources" JSONB;
