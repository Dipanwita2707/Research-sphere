const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('📦 Reading SQL migration file...');
    const sqlPath = path.join(__dirname, 'add_new_chat_permissions.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    
    // Remove comments and split by semicolons
    const cleanedSql = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');
    
    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    console.log(`📋 Found ${statements.length} SQL statements to execute\n`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;
      
      console.log(`⚙️  Executing statement ${i + 1}/${statements.length}...`);
      await prisma.$executeRawUnsafe(statement);
      console.log(`   ✅ Success\n`);
    }
    
    console.log('🎉 Migration completed successfully!');
    console.log('You can now restart your backend server.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
