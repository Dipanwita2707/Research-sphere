require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tables = [
    'user_login',
    'employee_details',
    'student_details',
    'research_profile_identity'
  ];

  console.log('--- Database Index Inspection (Part 2) ---');

  for (const table of tables) {
    console.log(`\nTable: ${table}`);
    const indexes = await prisma.$queryRawUnsafe(`
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM
        pg_indexes
      WHERE
        tablename = $1 AND schemaname = 'public'
    `, table);

    if (indexes.length === 0) {
      console.log('  No indexes found.');
    } else {
      for (const idx of indexes) {
        console.log(`  - Index: ${idx.indexname}`);
        console.log(`    Definition: ${idx.indexdef}`);
      }
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
