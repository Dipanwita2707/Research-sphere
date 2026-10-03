-- DropIndex
DROP INDEX "employee_details_emp_id_key";

-- DropIndex
DROP INDEX "grant_application_application_number_key";

-- DropIndex
DROP INDEX "ipr_application_number_key";

-- DropIndex
DROP INDEX "ipr_application_application_number_key";

-- DropIndex
DROP INDEX "program_specialization_specialization_code_key";

-- DropIndex
DROP INDEX "publication_import_source_external_key";

-- DropIndex
DROP INDEX "research_contribution_application_number_key";

-- DropIndex
DROP INDEX "research_progress_tracker_tracking_number_key";

-- DropIndex
DROP INDEX "student_details_email_key";

-- DropIndex
DROP INDEX "student_details_registration_no_key";

-- DropIndex
DROP INDEX "student_details_student_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "employee_details_university_id_emp_id_key" ON "employee_details"("university_id", "emp_id");

-- CreateIndex
CREATE UNIQUE INDEX "grant_application_university_id_application_number_key" ON "grant_application"("university_id", "application_number");

-- CreateIndex
CREATE UNIQUE INDEX "ipr_university_id_application_number_key" ON "ipr"("university_id", "application_number");

-- CreateIndex
CREATE UNIQUE INDEX "ipr_application_university_id_application_number_key" ON "ipr_application"("university_id", "application_number");

-- CreateIndex
CREATE UNIQUE INDEX "program_specialization_university_id_specialization_code_key" ON "program_specialization"("university_id", "specialization_code");

-- CreateIndex
CREATE UNIQUE INDEX "publication_import_tenant_source_external_key" ON "publication_import"("university_id", "source_system", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "research_contribution_university_id_application_number_key" ON "research_contribution"("university_id", "application_number");

-- CreateIndex
CREATE UNIQUE INDEX "research_progress_tracker_university_id_tracking_number_key" ON "research_progress_tracker"("university_id", "tracking_number");

-- CreateIndex
CREATE UNIQUE INDEX "student_details_university_id_student_id_key" ON "student_details"("university_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_details_university_id_registration_no_key" ON "student_details"("university_id", "registration_no");

-- CreateIndex
CREATE UNIQUE INDEX "student_details_university_id_email_key" ON "student_details"("university_id", "email");
