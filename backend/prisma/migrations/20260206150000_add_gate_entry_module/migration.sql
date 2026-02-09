-- CreateEnum
CREATE TYPE "id_proof_type_enum" AS ENUM ('aadhaar', 'pan', 'driving_license', 'voter_id', 'passport');

-- CreateEnum
CREATE TYPE "gender_enum" AS ENUM ('male', 'female', 'other');

-- CreateEnum
CREATE TYPE "visit_purpose_enum" AS ENUM ('meeting', 'delivery', 'maintenance', 'event', 'interview', 'other');

-- CreateEnum
CREATE TYPE "vehicle_type_enum" AS ENUM ('two_wheeler', 'four_wheeler', 'other');

-- CreateEnum
CREATE TYPE "gate_pass_status_enum" AS ENUM ('pending', 'active', 'checked_in', 'completed', 'denied', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "gate_pass_action_enum" AS ENUM ('created', 'updated', 'checked_in', 'checked_out', 'denied', 'cancelled', 'notification_sent');

-- CreateEnum
CREATE TYPE "notification_recipient_enum" AS ENUM ('visitor', 'host', 'security');

-- CreateEnum
CREATE TYPE "notification_type_enum" AS ENUM ('email', 'sms', 'whatsapp');

-- CreateEnum
CREATE TYPE "notification_status_enum" AS ENUM ('pending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "gate_pass" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "pass_id" VARCHAR(64) NOT NULL,
    "visitor_name" VARCHAR(255) NOT NULL,
    "mobile_number" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255),
    "id_proof_type" "id_proof_type_enum" NOT NULL,
    "id_proof_number" VARCHAR(100) NOT NULL,
    "photo_file_path" TEXT,
    "photo" VARCHAR(64),
    "gender" "gender_enum",
    "age" INTEGER,
    "purpose_of_visit" "visit_purpose_enum" NOT NULL,
    "purpose_other" VARCHAR(255),
    "department_to_visit" VARCHAR(255) NOT NULL,
    "person_to_meet_id" UUID,
    "person_to_meet_name" VARCHAR(255) NOT NULL,
    "visit_date" DATE NOT NULL,
    "expected_entry_time" VARCHAR(10) NOT NULL,
    "expected_exit_time" VARCHAR(10) NOT NULL,
    "has_vehicle" BOOLEAN NOT NULL DEFAULT false,
    "vehicle_type" "vehicle_type_enum",
    "vehicle_number" VARCHAR(50),
    "vehicle_model" VARCHAR(100),
    "number_of_persons" INTEGER NOT NULL DEFAULT 1,
    "items_carrying" TEXT,
    "special_instructions" TEXT,
    "status" "gate_pass_status_enum" NOT NULL DEFAULT 'active',
    "qr_code" TEXT,
    "actual_entry_time" TIMESTAMPTZ(6),
    "actual_exit_time" TIMESTAMPTZ(6),
    "entry_gate" VARCHAR(100),
    "exit_gate" VARCHAR(100),
    "entry_guard_id" UUID,
    "exit_guard_id" UUID,
    "entry_remarks" TEXT,
    "exit_remarks" TEXT,
    "denial_reason" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gate_pass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gate_pass_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "gate_pass_id" UUID NOT NULL,
    "action" "gate_pass_action_enum" NOT NULL,
    "performed_by_id" UUID NOT NULL,
    "remarks" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gate_pass_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gate_pass_notification" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "gate_pass_id" UUID NOT NULL,
    "recipient_type" "notification_recipient_enum" NOT NULL,
    "recipient_id" UUID,
    "recipient_email" VARCHAR(255),
    "recipient_phone" VARCHAR(20),
    "notification_type" "notification_type_enum" NOT NULL,
    "status" "notification_status_enum" NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gate_pass_notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gate_pass_pass_id_key" ON "gate_pass"("pass_id");

-- CreateIndex
CREATE INDEX "gate_pass_pass_id_idx" ON "gate_pass"("pass_id");

-- CreateIndex
CREATE INDEX "gate_pass_mobile_number_idx" ON "gate_pass"("mobile_number");

-- CreateIndex
CREATE INDEX "gate_pass_visit_date_idx" ON "gate_pass"("visit_date");

-- CreateIndex
CREATE INDEX "gate_pass_status_idx" ON "gate_pass"("status");

-- CreateIndex
CREATE INDEX "gate_pass_created_by_id_idx" ON "gate_pass"("created_by_id");

-- CreateIndex
CREATE INDEX "gate_pass_history_gate_pass_id_idx" ON "gate_pass_history"("gate_pass_id");

-- CreateIndex
CREATE INDEX "gate_pass_notification_gate_pass_id_idx" ON "gate_pass_notification"("gate_pass_id");

-- AddForeignKey
ALTER TABLE "gate_pass" ADD CONSTRAINT "gate_pass_person_to_meet_id_fkey" FOREIGN KEY ("person_to_meet_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_pass" ADD CONSTRAINT "gate_pass_entry_guard_id_fkey" FOREIGN KEY ("entry_guard_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_pass" ADD CONSTRAINT "gate_pass_exit_guard_id_fkey" FOREIGN KEY ("exit_guard_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_pass" ADD CONSTRAINT "gate_pass_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_pass_history" ADD CONSTRAINT "gate_pass_history_gate_pass_id_fkey" FOREIGN KEY ("gate_pass_id") REFERENCES "gate_pass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_pass_history" ADD CONSTRAINT "gate_pass_history_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "user_login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_pass_notification" ADD CONSTRAINT "gate_pass_notification_gate_pass_id_fkey" FOREIGN KEY ("gate_pass_id") REFERENCES "gate_pass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
