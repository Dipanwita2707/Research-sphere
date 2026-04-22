-- Create table for versioned post-event reports
CREATE TABLE "event_post_report" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "eventId" TEXT NOT NULL,
    "uploadedById" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "previousReportId" UUID,
    "originalFileName" VARCHAR(512) NOT NULL,
    "storedFileName" VARCHAR(512) NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" VARCHAR(128) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageProvider" VARCHAR(32) NOT NULL DEFAULT 's3',
    "sha256Hash" VARCHAR(128),
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "uploadedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_post_report_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_post_report_eventId_version_key" ON "event_post_report"("eventId", "version");
CREATE INDEX "event_post_report_eventId_isLatest_idx" ON "event_post_report"("eventId", "isLatest");
CREATE INDEX "event_post_report_eventId_uploadedAt_idx" ON "event_post_report"("eventId", "uploadedAt");
CREATE INDEX "event_post_report_uploadedById_idx" ON "event_post_report"("uploadedById");

ALTER TABLE "event_post_report"
    ADD CONSTRAINT "event_post_report_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_post_report"
    ADD CONSTRAINT "event_post_report_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "user_login"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_post_report"
    ADD CONSTRAINT "event_post_report_previousReportId_fkey"
    FOREIGN KEY ("previousReportId") REFERENCES "event_post_report"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
