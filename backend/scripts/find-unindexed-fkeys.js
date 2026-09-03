require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Checking for Unindexed Foreign Keys ---');
  
  const query = `
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM
      information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE
      tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        JOIN pg_class c ON c.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = tc.table_name
          AND a.attname = kcu.column_name
          -- Ensure the column is the first column in the index or has a single-column index
          AND (i.indkey[0] = a.attnum)
      )
    ORDER BY
      tc.table_name,
      kcu.column_name;
  `;

  const unindexedFkeys = await prisma.$queryRawUnsafe(query);

  if (unindexedFkeys.length === 0) {
    console.log('All foreign keys are properly indexed!');
  } else {
    console.log(`Found ${unindexedFkeys.length} unindexed foreign keys:\n`);
    console.log(String('Table').padEnd(30) + ' | ' + String('Column').padEnd(30) + ' | ' + String('References Table'));
    console.log('-'.repeat(90));
    for (const fk of unindexedFkeys) {
      console.log(
        fk.table_name.padEnd(30) + ' | ' +
        fk.column_name.padEnd(30) + ' | ' +
        fk.foreign_table_name
      );
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
