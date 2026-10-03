-- AlterTable
ALTER TABLE "research_contribution" ADD COLUMN     "title_work_key" VARCHAR(320);

-- CreateIndex
CREATE INDEX "research_contribution_university_id_title_work_key_idx" ON "research_contribution"("university_id", "title_work_key");
