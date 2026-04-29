const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const migrationPaths = [
  '../../prisma/migrations/20260421113000_optimize_finance_indexes/migration.sql',
  '../../prisma/migrations/20260421133000_harden_finance_concurrency/migration.sql',
].map((migrationPath) => path.resolve(__dirname, migrationPath));

const duplicateChecks = [
  {
    label: 'transport/hostel fee structures',
    sql: `
      SELECT "type", "batch_year", COUNT(*)::int AS count
      FROM "fee_structure"
      WHERE "type" IN ('TRANSPORT', 'HOSTEL')
        AND "program_id" IS NULL
        AND "specialization_id" IS NULL
      GROUP BY "type", "batch_year"
      HAVING COUNT(*) > 1
    `,
  },
  {
    label: 'academic base fee structures',
    sql: `
      SELECT "program_id", "batch_year", COUNT(*)::int AS count
      FROM "fee_structure"
      WHERE "type" = 'ACADEMIC'
        AND "program_id" IS NOT NULL
        AND "specialization_id" IS NULL
      GROUP BY "program_id", "batch_year"
      HAVING COUNT(*) > 1
    `,
  },
  {
    label: 'academic specialization fee structures',
    sql: `
      SELECT "program_id", "specialization_id", "batch_year", COUNT(*)::int AS count
      FROM "fee_structure"
      WHERE "type" = 'ACADEMIC'
        AND "program_id" IS NOT NULL
        AND "specialization_id" IS NOT NULL
      GROUP BY "program_id", "specialization_id", "batch_year"
      HAVING COUNT(*) > 1
    `,
  },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing');
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    for (const check of duplicateChecks) {
      const result = await client.query(check.sql);
      if (result.rows.length > 0) {
        console.error(`Duplicate ${check.label} found. Resolve these rows before applying unique indexes:`);
        console.error(JSON.stringify(result.rows, null, 2));
        process.exitCode = 1;
        return;
      }
    }

    for (const migrationPath of migrationPaths) {
      const migrationSql = fs.readFileSync(migrationPath, 'utf8');
      await client.query(migrationSql);
    }

    const verification = await client.query(`
      SELECT 'loan_letter_counter_table' AS name
      WHERE to_regclass('public.loan_letter_counter') IS NOT NULL
      UNION ALL
      SELECT indexname AS name
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'fee_structure_transport_hostel_unique_idx',
          'fee_structure_academic_base_unique_idx',
          'fee_structure_academic_specialization_unique_idx',
          'fee_structure_type_batch_year_idx',
          'fee_structure_lookup_idx',
          'fee_head_fee_structure_id_idx',
          'loan_letter_application_number_unique_ci',
          'loan_letter_issued_at_idx',
          'loan_letter_program_id_issued_at_idx',
          'loan_letter_printed_by_id_issued_at_idx',
          'audit_log_actor_target_action_idx',
          'audit_log_target_action_created_at_idx'
        )
      ORDER BY name
    `);

    console.log('Finance hardening migration applied.');
    console.log(verification.rows.map((row) => row.name).join('\n'));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
