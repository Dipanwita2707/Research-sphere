-- CreateTable
CREATE TABLE "ipr" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
    "application_number" VARCHAR(100),
    "submission_date" TIMESTAMPTZ(6),
    "applicant" VARCHAR(255) NOT NULL,
    "co_applicants" JSONB,
    "department" VARCHAR(100) NOT NULL,
    "research_area" VARCHAR(255),
    "keywords" JSONB,
    "technical_specifications" TEXT,
    "estimated_value" DECIMAL(15,2),
    "market_potential" TEXT,
    "competitive_advantage" TEXT,
    "priority" VARCHAR(20) NOT NULL DEFAULT 'medium',
    "review_comments" TEXT,
    "reviewer_notes" TEXT,
    "review_date" TIMESTAMPTZ(6),
    "created_by_id" UUID NOT NULL,
    "approved_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipr_document" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "ipr_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "file_path" VARCHAR(500) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipr_document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ipr_application_number_key" ON "ipr"("application_number");

-- CreateIndex
CREATE INDEX "ipr_type_idx" ON "ipr"("type");

-- CreateIndex
CREATE INDEX "ipr_status_idx" ON "ipr"("status");

-- CreateIndex
CREATE INDEX "ipr_department_idx" ON "ipr"("department");

-- CreateIndex
CREATE INDEX "ipr_created_by_id_idx" ON "ipr"("created_by_id");

-- CreateIndex
CREATE INDEX "ipr_submission_date_idx" ON "ipr"("submission_date");

-- CreateIndex
CREATE INDEX "ipr_document_ipr_id_idx" ON "ipr_document"("ipr_id");

-- AddForeignKey
ALTER TABLE "ipr" ADD CONSTRAINT "ipr_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr" ADD CONSTRAINT "ipr_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "user_login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_document" ADD CONSTRAINT "ipr_document_ipr_id_fkey" FOREIGN KEY ("ipr_id") REFERENCES "ipr"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ipr_document" ADD CONSTRAINT "ipr_document_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "user_login"("id") ON DELETE CASCADE ON UPDATE CASCADE;
