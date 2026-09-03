/**
 * sync-license-schema.js
 * Applies necessary columns to the licenses table in PostgreSQL if not already present.
 */
const prisma = require('../../src/shared/config/database');

async function syncLicenseSchema() {
  console.log('🔄 Checking and updating licenses table schema in PostgreSQL...');
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS licenses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        license_key VARCHAR(128) UNIQUE NOT NULL,
        assigned_to VARCHAR(256) NOT NULL,
        hardware_id VARCHAR(128),
        allowed_hardware_ids TEXT[] DEFAULT '{}',
        pending_hardware_id VARCHAR(128),
        requires_approval BOOLEAN DEFAULT true,
        is_active BOOLEAN DEFAULT true,
        notes TEXT,
        activated_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Add columns if table already existed without them
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licenses' AND column_name='allowed_hardware_ids') THEN
          ALTER TABLE licenses ADD COLUMN allowed_hardware_ids TEXT[] DEFAULT '{}';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licenses' AND column_name='pending_hardware_id') THEN
          ALTER TABLE licenses ADD COLUMN pending_hardware_id VARCHAR(128);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='licenses' AND column_name='requires_approval') THEN
          ALTER TABLE licenses ADD COLUMN requires_approval BOOLEAN DEFAULT true;
        END IF;
      END $$;
    `);

    console.log('✅ Licenses table schema is up to date.');
  } catch (err) {
    console.warn('Note: Direct DB migration check completed with message:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

syncLicenseSchema();
