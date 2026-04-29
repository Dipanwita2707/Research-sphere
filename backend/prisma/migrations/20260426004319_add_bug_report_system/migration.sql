-- CreateEnum: ResolutionStatus
CREATE TYPE "ResolutionStatus" AS ENUM ('resolved', 'unresolved');

-- CreateTable: bug_reports
CREATE TABLE "bug_reports" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "user_role" VARCHAR(32) NOT NULL,
    "user_identifier" VARCHAR(64) NOT NULL,
    "user_email" VARCHAR(255),
    "description" TEXT NOT NULL,
    "page_url" VARCHAR(2048) NOT NULL,
    "route_path" VARCHAR(512) NOT NULL,
    "resolution_status" "ResolutionStatus" NOT NULL DEFAULT 'unresolved',
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bug_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable: bug_report_screenshots
CREATE TABLE "bug_report_screenshots" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "bug_report_id" UUID NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "stored_filename" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(64) NOT NULL,
    "storage_path" VARCHAR(512) NOT NULL,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bug_report_screenshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bug_reports_user_id_idx" ON "bug_reports"("user_id");

-- CreateIndex
CREATE INDEX "bug_reports_created_at_idx" ON "bug_reports"("created_at");

-- CreateIndex
CREATE INDEX "bug_reports_resolution_status_idx" ON "bug_reports"("resolution_status");

-- CreateIndex
CREATE INDEX "bug_reports_resolved_by_idx" ON "bug_reports"("resolved_by");

-- CreateIndex
CREATE INDEX "bug_report_screenshots_bug_report_id_idx" ON "bug_report_screenshots"("bug_report_id");

-- AddForeignKey
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_report_screenshots" ADD CONSTRAINT "bug_report_screenshots_bug_report_id_fkey" FOREIGN KEY ("bug_report_id") REFERENCES "bug_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
