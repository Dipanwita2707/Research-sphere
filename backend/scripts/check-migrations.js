require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const rows = await p.$queryRawUnsafe(`
    SELECT migration_name, finished_at, rolled_back_at, started_at, logs
    FROM "_prisma_migrations"
    ORDER BY started_at ASC
  `);
  console.log('migration_count', rows.length);
  const failed = rows.filter((r) => !r.finished_at || r.rolled_back_at);
  console.log('failed_or_incomplete', failed.map((r) => ({
    name: r.migration_name,
    finished_at: r.finished_at,
    rolled_back_at: r.rolled_back_at,
    started_at: r.started_at,
    logs: (r.logs || '').slice(0, 200),
  })));
  console.log('applied', rows.filter((r) => r.finished_at && !r.rolled_back_at).map((r) => r.migration_name));

  // quick schema presence checks for late migrations
  const checks = await p.$queryRawUnsafe(`
    SELECT
      to_regclass('public."University"') IS NOT NULL AS university,
      to_regclass('public.employee_details') IS NOT NULL AS employee_details,
      to_regclass('public.research_contributions') IS NOT NULL OR to_regclass('public."ResearchContribution"') IS NOT NULL AS research,
      to_regclass('public."Note"') IS NOT NULL OR to_regclass('public.notes') IS NOT NULL AS notes
  `);
  console.log('tables', checks);

  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
