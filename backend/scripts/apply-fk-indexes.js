/**
 * Apply indexes for all 58 unindexed foreign keys directly via Prisma $executeRawUnsafe.
 * This bypasses the migration system to avoid issues with failed/pending migrations.
 * Each CREATE INDEX uses IF NOT EXISTS so it is idempotent and safe to re-run.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const INDEX_STATEMENTS = [
  // admission_faculty_staff
  `CREATE INDEX IF NOT EXISTS "idx_admission_faculty_staff_employee_id" ON "admission_faculty_staff" ("employee_id")`,
  // admission_staff_details
  `CREATE INDEX IF NOT EXISTS "idx_admission_staff_details_employee_id" ON "admission_staff_details" ("employee_id")`,
  // admission_staff_roles
  `CREATE INDEX IF NOT EXISTS "idx_admission_staff_roles_employee_id" ON "admission_staff_roles" ("employee_id")`,
  // book_chapter_incentive_policy
  `CREATE INDEX IF NOT EXISTS "idx_book_chapter_incentive_policy_created_by_id" ON "book_chapter_incentive_policy" ("created_by_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_book_chapter_incentive_policy_updated_by_id" ON "book_chapter_incentive_policy" ("updated_by_id")`,
  // book_incentive_policy
  `CREATE INDEX IF NOT EXISTS "idx_book_incentive_policy_created_by_id" ON "book_incentive_policy" ("created_by_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_book_incentive_policy_updated_by_id" ON "book_incentive_policy" ("updated_by_id")`,
  // card
  `CREATE INDEX IF NOT EXISTS "idx_card_employee_id" ON "card" ("employee_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_card_issued_by" ON "card" ("issued_by")`,
  `CREATE INDEX IF NOT EXISTS "idx_card_parent_id" ON "card" ("parent_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_card_student_id" ON "card" ("student_id")`,
  // central_department
  `CREATE INDEX IF NOT EXISTS "idx_central_department_head_of_department" ON "central_department" ("head_of_department")`,
  // central_department_permission
  `CREATE INDEX IF NOT EXISTS "idx_central_department_permission_assigned_by" ON "central_department_permission" ("assigned_by")`,
  // changes_history
  `CREATE INDEX IF NOT EXISTS "idx_changes_history_changed_by_id" ON "changes_history" ("changed_by_id")`,
  // conference_incentive_policy
  `CREATE INDEX IF NOT EXISTS "idx_conference_incentive_policy_created_by_id" ON "conference_incentive_policy" ("created_by_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_conference_incentive_policy_updated_by_id" ON "conference_incentive_policy" ("updated_by_id")`,
  // department
  `CREATE INDEX IF NOT EXISTS "idx_department_faculty_id" ON "department" ("faculty_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_department_head_of_department" ON "department" ("head_of_department")`,
  // department_permission
  `CREATE INDEX IF NOT EXISTS "idx_department_permission_assigned_by" ON "department_permission" ("assigned_by")`,
  // employee_details
  `CREATE INDEX IF NOT EXISTS "idx_employee_details_primary_central_dept_id" ON "employee_details" ("primary_central_dept_id")`,
  // faculty_school_list
  `CREATE INDEX IF NOT EXISTS "idx_faculty_school_list_head_of_faculty" ON "faculty_school_list" ("head_of_faculty")`,
  // grant_application_status_history
  `CREATE INDEX IF NOT EXISTS "idx_grant_application_status_history_changed_by_id" ON "grant_application_status_history" ("changed_by_id")`,
  // grant_incentive_policy
  `CREATE INDEX IF NOT EXISTS "idx_grant_incentive_policy_created_by_id" ON "grant_incentive_policy" ("created_by_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_grant_incentive_policy_updated_by_id" ON "grant_incentive_policy" ("updated_by_id")`,
  // hr_non_teaching_staff_details
  `CREATE INDEX IF NOT EXISTS "idx_hr_non_teaching_staff_details_employee_id" ON "hr_non_teaching_staff_details" ("employee_id")`,
  // hr_non_teaching_staff_roles
  `CREATE INDEX IF NOT EXISTS "idx_hr_non_teaching_staff_roles_employee_id" ON "hr_non_teaching_staff_roles" ("employee_id")`,
  // hr_teaching_staff_details
  `CREATE INDEX IF NOT EXISTS "idx_hr_teaching_staff_details_employee_id" ON "hr_teaching_staff_details" ("employee_id")`,
  // hr_teaching_staff_roles
  `CREATE INDEX IF NOT EXISTS "idx_hr_teaching_staff_roles_employee_id" ON "hr_teaching_staff_roles" ("employee_id")`,
  // incentive_policy
  `CREATE INDEX IF NOT EXISTS "idx_incentive_policy_created_by_id" ON "incentive_policy" ("created_by_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_incentive_policy_updated_by_id" ON "incentive_policy" ("updated_by_id")`,
  // ipr
  `CREATE INDEX IF NOT EXISTS "idx_ipr_approved_by_id" ON "ipr" ("approved_by_id")`,
  // ipr_document
  `CREATE INDEX IF NOT EXISTS "idx_ipr_document_uploaded_by_id" ON "ipr_document" ("uploaded_by_id")`,
  // ipr_finance
  `CREATE INDEX IF NOT EXISTS "idx_ipr_finance_finance_reviewer_id" ON "ipr_finance" ("finance_reviewer_id")`,
  // ipr_status_history
  `CREATE INDEX IF NOT EXISTS "idx_ipr_status_history_changed_by_id" ON "ipr_status_history" ("changed_by_id")`,
  // parent_details
  `CREATE INDEX IF NOT EXISTS "idx_parent_details_student_id" ON "parent_details" ("student_id")`,
  // program
  `CREATE INDEX IF NOT EXISTS "idx_program_department_id" ON "program" ("department_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_program_program_coordinator" ON "program" ("program_coordinator")`,
  // program_specialization
  `CREATE INDEX IF NOT EXISTS "idx_program_specialization_program_id" ON "program_specialization" ("program_id")`,
  // publication_import
  `CREATE INDEX IF NOT EXISTS "idx_publication_import_research_contribution_id" ON "publication_import" ("research_contribution_id")`,
  // publication_import_run
  `CREATE INDEX IF NOT EXISTS "idx_publication_import_run_triggered_by_id" ON "publication_import_run" ("triggered_by_id")`,
  // registrar_faculty_staff
  `CREATE INDEX IF NOT EXISTS "idx_registrar_faculty_staff_employee_id" ON "registrar_faculty_staff" ("employee_id")`,
  // registrar_staff_details
  `CREATE INDEX IF NOT EXISTS "idx_registrar_staff_details_employee_id" ON "registrar_staff_details" ("employee_id")`,
  // registrar_staff_roles
  `CREATE INDEX IF NOT EXISTS "idx_registrar_staff_roles_employee_id" ON "registrar_staff_roles" ("employee_id")`,
  // reissue_request
  `CREATE INDEX IF NOT EXISTS "idx_reissue_request_approved_by" ON "reissue_request" ("approved_by")`,
  `CREATE INDEX IF NOT EXISTS "idx_reissue_request_employee_id" ON "reissue_request" ("employee_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_reissue_request_old_card_id" ON "reissue_request" ("old_card_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_reissue_request_parent_id" ON "reissue_request" ("parent_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_reissue_request_requested_by" ON "reissue_request" ("requested_by")`,
  `CREATE INDEX IF NOT EXISTS "idx_reissue_request_student_id" ON "reissue_request" ("student_id")`,
  // research_contribution_status_history
  `CREATE INDEX IF NOT EXISTS "idx_research_contribution_status_history_changed_by_id" ON "research_contribution_status_history" ("changed_by_id")`,
  // research_incentive_policy
  `CREATE INDEX IF NOT EXISTS "idx_research_incentive_policy_created_by_id" ON "research_incentive_policy" ("created_by_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_research_incentive_policy_updated_by_id" ON "research_incentive_policy" ("updated_by_id")`,
  // research_paper_status_history
  `CREATE INDEX IF NOT EXISTS "idx_research_paper_status_history_changed_by_id" ON "research_paper_status_history" ("changed_by_id")`,
  // section
  `CREATE INDEX IF NOT EXISTS "idx_section_class_teacher" ON "section" ("class_teacher")`,
  // student_details
  `CREATE INDEX IF NOT EXISTS "idx_student_details_data_approved_by" ON "student_details" ("data_approved_by")`,
  `CREATE INDEX IF NOT EXISTS "idx_student_details_mentor_id" ON "student_details" ("mentor_id")`,
  // university_subscriptions
  `CREATE INDEX IF NOT EXISTS "idx_university_subscriptions_tier_id" ON "university_subscriptions" ("tier_id")`,
  // user_department_permission
  `CREATE INDEX IF NOT EXISTS "idx_user_department_permission_assigned_by" ON "user_department_permission" ("assigned_by")`,
];

async function main() {
  console.log(`=== Adding indexes for ${INDEX_STATEMENTS.length} unindexed foreign keys ===\n`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const sql of INDEX_STATEMENTS) {
    // Extract a readable name from the SQL
    const match = sql.match(/"(idx_[^"]+)"/);
    const name = match ? match[1] : sql.slice(0, 60);
    try {
      await prisma.$executeRawUnsafe(sql);
      success++;
      console.log(`  ✅ ${name}`);
    } catch (err) {
      if (err.message.includes('already exists')) {
        skipped++;
        console.log(`  ⏭️  ${name} (already exists)`);
      } else {
        failed++;
        console.error(`  ❌ ${name}: ${err.message}`);
      }
    }
  }

  console.log(`\n=== Done: ${success} created, ${skipped} already existed, ${failed} failed ===`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
