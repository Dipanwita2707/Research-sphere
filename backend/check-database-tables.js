const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTables() {
  try {
    console.log('🔍 Checking database tables...\n');
    
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    console.log(`📊 Total tables found: ${tables.length}\n`);
    
    if (tables.length === 0) {
      console.log('⚠️  NO TABLES FOUND IN DATABASE!\n');
    } else {
      console.log('Tables:');
      tables.forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.table_name}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTables();
