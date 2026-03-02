/**
 * Run: node prisma/manual-migrations/run-stall-feedback-migration.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SQL = [
  // No FK constraints — event.id is TEXT (not UUID), stall.stall_id is VARCHAR(16)
  // Cascade deletes are handled at application level
  `CREATE TABLE IF NOT EXISTS stall_feedback (
    id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id          TEXT        NOT NULL,
    stall_id          VARCHAR(16) NOT NULL,
    points            JSONB       NOT NULL,
    short_description TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS stall_feedback_event_id_idx   ON stall_feedback(event_id)`,
  `CREATE INDEX IF NOT EXISTS stall_feedback_stall_id_idx   ON stall_feedback(stall_id)`,
  `CREATE INDEX IF NOT EXISTS stall_feedback_created_at_idx ON stall_feedback(created_at)`,
];

async function run() {
  // ── 1. Drop & recreate table (handles leftover partial table) ──────────────
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS stall_feedback CASCADE`);
  console.log('Dropped stall_feedback (if existed)');

  for (const sql of SQL) {
    await prisma.$executeRawUnsafe(sql);
    console.log('OK:', sql.trim().substring(0, 80));
  }
  console.log('\nstall_feedback table + indexes ready ✓');

  // ── 2. Fix old stallQrCode URLs (stall table) ─────────────────────────────
  // Old format: /feedback/stall/{stallId}
  // New format: /events/{eventId}/stalls/{stallId}/feedback
  const updatedStalls = await prisma.$executeRawUnsafe(`
    UPDATE stall
    SET    stall_qr_code = CONCAT('/events/', event_id, '/stalls/', stall_id, '/feedback')
    WHERE  stall_qr_code LIKE '/feedback/stall/%'
  `);
  console.log(`Updated ${updatedStalls} stall QR code(s) to new URL format ✓`);

  // ── 3. Fix old stallQrCode URLs (stall_application table, if any) ─────────
  const updatedApps = await prisma.$executeRawUnsafe(`
    UPDATE stall_application
    SET    stall_qr_code = CONCAT('/events/', event_id, '/stalls/', stall_id, '/feedback')
    WHERE  stall_qr_code LIKE '/feedback/stall/%'
       AND stall_id IS NOT NULL
  `);
  console.log(`Updated ${updatedApps} stall_application QR code(s) to new URL format ✓`);
}

run()
  .catch((e) => { console.error('Migration failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
