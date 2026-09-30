-- CreateEnum for edit suggestion status
CREATE TYPE "edit_suggestion_status_enum" AS ENUM ('pending', 'accepted', 'rejected', 'superseded');

-- Create table for detailed edit suggestions
CREATE TABLE "ipr_edit_suggestion" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ipr_application_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "field_name" VARCHAR(128) NOT NULL,
    "field_path" VARCHAR(256),
    "original_value" TEXT,
    "suggested_value" TEXT,
    "suggestion_note" TEXT,
    "status" "edit_suggestion_status_enum" NOT NULL DEFAULT 'pending',
    "applicant_response" TEXT,
    "reviewed_at" TIMESTAMPTZ(6),
    "responded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipr_edit_suggestion_pkey" PRIMARY KEY ("id")
);

-- Create table for collaborative editing sessions
CREATE TABLE "ipr_collaborative_session" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ipr_application_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "session_data" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipr_collaborative_session_pkey" PRIMARY KEY ("id")
);

-- Add indices
CREATE INDEX "ipr_edit_suggestion_ipr_application_id_idx" ON "ipr_edit_suggestion"("ipr_application_id");
CREATE INDEX "ipr_edit_suggestion_reviewer_id_idx" ON "ipr_edit_suggestion"("reviewer_id");
CREATE INDEX "ipr_edit_suggestion_status_idx" ON "ipr_edit_suggestion"("status");
CREATE INDEX "ipr_collaborative_session_ipr_application_id_idx" ON "ipr_collaborative_session"("ipr_application_id");
CREATE INDEX "ipr_collaborative_session_reviewer_id_idx" ON "ipr_collaborative_session"("reviewer_id");

-- Add foreign keys
ALTER TABLE "ipr_edit_suggestion" ADD CONSTRAINT "ipr_edit_suggestion_ipr_application_id_fkey" FOREIGN KEY ("ipr_application_id") REFERENCES "ipr_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ipr_edit_suggestion" ADD CONSTRAINT "ipr_edit_suggestion_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ipr_collaborative_session" ADD CONSTRAINT "ipr_collaborative_session_ipr_application_id_fkey" FOREIGN KEY ("ipr_application_id") REFERENCES "ipr_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ipr_collaborative_session" ADD CONSTRAINT "ipr_collaborative_session_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update the existing ipr_review table to include collaborative editing metadata
ALTER TABLE "ipr_review" ADD COLUMN IF NOT EXISTS "has_suggestions" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ipr_review" ADD COLUMN IF NOT EXISTS "suggestions_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ipr_review" ADD COLUMN IF NOT EXISTS "pending_suggestions_count" INTEGER NOT NULL DEFAULT 0;