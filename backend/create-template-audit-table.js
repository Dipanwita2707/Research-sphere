/**
 * Migration: create loan_letter_template_audit table
 * Run once: node create-template-audit-table.js
 */
const prisma = require('./src/shared/config/database');

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS loan_letter_template_audit (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      version         SERIAL,
      changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      changed_by_id   UUID REFERENCES user_login(id) ON DELETE SET NULL,
      changed_by_name VARCHAR(256),
      changed_by_uid  VARCHAR(64),
      changes         JSONB NOT NULL DEFAULT '{}'
    )
  `);
  console.log('✅  loan_letter_template_audit table ready');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
