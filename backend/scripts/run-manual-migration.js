const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runManualMigration() {
  try {
    console.log('🔧 Running manual migration to add checkout_verification_code...\n');
    
    console.log('📝 Executing SQL migration...');
    
    // Check if column already exists
    const existingColumns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'gate_pass' 
      AND column_name = 'checkout_verification_code';
    `;
    
    if (existingColumns.length > 0) {
      console.log('ℹ️  Column checkout_verification_code already exists');
    } else {
      // Add the column
      await prisma.$executeRaw`
        ALTER TABLE gate_pass 
        ADD COLUMN checkout_verification_code TEXT;
      `;
      console.log('✅ Column checkout_verification_code added successfully!');
    }
    
    // Verify columns exist
    console.log('\n🔍 Verifying columns...');
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'gate_pass'
      AND column_name IN ('checkout_unique_id', 'checkout_verification_code')
      ORDER BY column_name;
    `;
    
    console.log('\n✅ Columns in gate_pass table:');
    console.table(result);
    
    if (result.length === 2) {
      console.log('\n✅ SUCCESS! Both checkout fields are now in the database:');
      console.log('   • checkout_unique_id - Stores unique checkout ID (CHECKOUT-YYYYMMDD-XXX)');
      console.log('   • checkout_verification_code - Stores NEW 6-digit code for checkout');
      console.log('\n🎉 Implementation complete! The system now uses separate credentials for check-in and checkout.');
    } else {
      console.log('\n⚠️  Warning: Expected 2 columns, found', result.length);
    }
    
  } catch (error) {
    console.error('\n❌ Error running migration:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runManualMigration();
