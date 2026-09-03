require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runExplain(label, sql, params) {
  console.log(`\n==================================================`);
  console.log(`EXPLAIN ANALYZE for: ${label}`);
  console.log(`==================================================`);
  try {
    // Replace postgres placeholders $1, $2 with inline values for explain,
    // or pass params if supported by raw query. Prisma supports raw queries with params, but EXPLAIN might require literal or standard parameter execution.
    // Let's format the query manually by replacing placeholders with actual string/number literals so EXPLAIN works perfectly.
    let formattedSql = sql;
    for (let i = params.length; i >= 1; i--) {
      const val = params[i - 1];
      let replacement = '';
      if (val === null) {
        replacement = 'NULL';
      } else if (typeof val === 'string') {
        replacement = `'${val.replace(/'/g, "''")}'`;
      } else if (typeof val === 'boolean') {
        replacement = val ? 'true' : 'false';
      } else {
        replacement = val.toString();
      }
      formattedSql = formattedSql.split(`$${i}`).join(replacement);
    }

    const explainResult = await prisma.$queryRawUnsafe(`EXPLAIN (ANALYZE, BUFFERS) ${formattedSql}`);
    for (const row of explainResult) {
      console.log(row['QUERY PLAN']);
    }
  } catch (e) {
    console.error(`Error explaining: ${e.message}`);
  }
}

async function main() {
  const userId = 'a267bdb9-a7e8-4355-95ea-3bcf0b198ea3';
  const profileId = '050924dc-8c0a-4570-b4e3-591e5b5a9bbe';

  // 1. UserLogin by ID with employee/student details (1000ms)
  await runExplain(
    '1. UserLogin with Employee/Student Details',
    `SELECT "t1"."id", "t1"."uid", "t1"."email", "t1"."phone", "t1"."profile_image_file_path" AS "profileImageFilePath", "t1"."profile_image" AS "profileImage", "t1"."password_hash" AS "passwordHash", "t1"."role"::text, "t1"."assigned_role_ids" AS "assignedRoleIds", "t1"."status", "t1"."university_id" AS "universityId", "t1"."last_login_at" AS "lastLoginAt", "t1"."created_at" AS "createdAt", "t1"."updated_at" AS "updatedAt", "UserLogin_employeeDetails"."__prisma_data__" AS "employeeDetails", "UserLogin_studentLogin"."__prisma_data__" AS "studentLogin" FROM "public"."user_login" AS "t1" LEFT JOIN LATERAL (SELECT JSONB_BUILD_OBJECT('displayName', "t2"."display_name") AS "__prisma_data__" FROM "public"."employee_details" AS "t2" WHERE "t1"."id" = "t2"."user_login_id" LIMIT $1) AS "UserLogin_employeeDetails" ON true LEFT JOIN LATERAL (SELECT JSONB_BUILD_OBJECT('displayName', "t3"."display_name") AS "__prisma_data__" FROM "public"."student_details" AS "t3" WHERE "t1"."id" = "t3"."user_login_id" LIMIT $2) AS "UserLogin_studentLogin" ON true WHERE ("t1"."id" = $3 AND 1=1) LIMIT $4`,
    [1, 1, userId, 1]
  );

  // 2. Research Profile Identity query (520ms)
  await runExplain(
    '2. ResearchProfileIdentity by userId',
    `SELECT "public"."research_profile_identity"."id" FROM "public"."research_profile_identity" WHERE ("public"."research_profile_identity"."user_id" = $1 AND 1=1) OFFSET $2`,
    [userId, 0]
  );

  // 3. ResearchContribution list query (501ms)
  await runExplain(
    '3. ResearchContribution with LEFT JOIN LATERAL and OR check',
    `SELECT "t1"."id", "t1"."application_number" AS "applicationNumber", "t1"."applicant_user_id" AS "applicantUserId", "t1"."publication_type"::text AS "publicationType", "t1"."title", "t1"."journal_name" AS "journalName", "t1"."conference_name" AS "conferenceName", "t1"."status"::text, "t1"."submitted_at" AS "submittedAt", "t1"."completed_at" AS "completedAt", "t1"."created_at" AS "createdAt", "t1"."updated_at" AS "updatedAt" FROM "public"."research_contribution" AS "t1" WHERE ("t1"."applicant_user_id" = $1 OR ("t1"."id") IN (SELECT "t2"."research_contribution_id" FROM "public"."research_contribution_author" AS "t2" WHERE ("t2"."user_id" = $2 AND "t2"."research_contribution_id" IS NOT NULL))) ORDER BY "t1"."created_at" DESC LIMIT $3 OFFSET $4`,
    [userId, userId, 100, 0]
  );

  // 4. GrantApplication list query (531ms)
  await runExplain(
    '4. GrantApplication filtered by applicant_user_id and submitted_at range',
    `SELECT "t1"."id", "t1"."applicant_user_id" AS "applicantUserId", "t1"."status"::text FROM "public"."grant_application" AS "t1" WHERE ("t1"."applicant_user_id" = $1 AND "t1"."submitted_at" >= $2 AND "t1"."submitted_at" <= $3)`,
    [userId, '2025-08-10 09:59:32.711 UTC', '2026-08-10 23:59:59.999 UTC']
  );

  // 5. ResearchContribution filtered by type, submitted_at, and status NOT IN (514ms)
  await runExplain(
    '5. ResearchContribution filtered by type, submitted_at, and status',
    `SELECT "t1"."id" FROM "public"."research_contribution" AS "t1" WHERE ("t1"."applicant_user_id" = $1 AND "t1"."publication_type" IN ('research_paper','book','book_chapter','conference_paper') AND "t1"."submitted_at" >= $2 AND "t1"."submitted_at" <= $3 AND "t1"."status" != 'draft'::"public"."research_contribution_status_enum") ORDER BY "t1"."submitted_at" DESC`,
    [userId, '2025-08-10 09:59:32.714 UTC', '2026-08-10 23:59:59.999 UTC']
  );

  // 6. PublicationImportRun list by research_profile_id (524ms)
  await runExplain(
    '6. PublicationImportRun lateral query by researchProfileId',
    `SELECT "t2"."id" FROM "public"."publication_import_run" AS "t2" WHERE "t2"."research_profile_id" = $1 ORDER BY "t2"."started_at" DESC LIMIT $2`,
    [profileId, 10]
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
