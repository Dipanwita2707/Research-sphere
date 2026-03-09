const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updatePassStatusEnum() {
  console.log('\n🔧 Updating pass_status_enum in database...\n');

  try {
    // Add missing enum values to pass_status_enum
    const alterEnumSQL = `
      DO $$
      BEGIN
        -- Add checked_in if not exists
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'checked_in' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pass_status_enum')
        ) THEN
          ALTER TYPE pass_status_enum ADD VALUE 'checked_in';
          RAISE NOTICE 'Added checked_in to pass_status_enum';
        ELSE
          RAISE NOTICE 'checked_in already exists in pass_status_enum';
        END IF;

        -- Add checked_out if not exists
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'checked_out' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pass_status_enum')
        ) THEN
          ALTER TYPE pass_status_enum ADD VALUE 'checked_out';
          RAISE NOTICE 'Added checked_out to pass_status_enum';
        ELSE
          RAISE NOTICE 'checked_out already exists in pass_status_enum';
        END IF;

        -- Add expired if not exists
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'expired' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pass_status_enum')
        ) THEN
          ALTER TYPE pass_status_enum ADD VALUE 'expired';
          RAISE NOTICE 'Added expired to pass_status_enum';
        ELSE
          RAISE NOTICE 'expired already exists in pass_status_enum';
        END IF;
      END$$;
    `;

    await prisma.$executeRawUnsafe(alterEnumSQL);

    console.log('✅ Successfully updated pass_status_enum\n');

    // Verify the enum values
    const enumValues = await prisma.$queryRaw`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'pass_status_enum')
      ORDER BY enumsortorder;
    `;

    console.log('📋 Current pass_status_enum values:');
    console.log('='.repeat(50));
    enumValues.forEach((row, index) => {
      console.log(`${index + 1}. ${row.enumlabel}`);
    });
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.error('❌ Error updating enum:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updatePassStatusEnum();
