/**
 * revoke-license.js — Kill Switch CLI
 * ─────────────────────────────────────────────────────────────────────────────
 * Revokes a license immediately. The app will refuse to start on next restart.
 *
 * Usage:
 *   node scripts/license/revoke-license.js --id <license-id>
 *   node scripts/license/revoke-license.js --key <license-key>
 *
 * Examples:
 *   node scripts/license/revoke-license.js --id "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 *   node scripts/license/revoke-license.js --key "550e8400-e29b-41d4-a716-446655440000"
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../backend/.env') });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const idIndex = args.indexOf('--id');
  const keyIndex = args.indexOf('--key');

  if (idIndex === -1 && keyIndex === -1) {
    console.error('\n❌ Usage:');
    console.error('   node revoke-license.js --id <license-id>');
    console.error('   node revoke-license.js --key <license-key>\n');
    process.exit(1);
  }

  let license;
  try {
    if (idIndex !== -1) {
      license = await prisma.license.findUnique({ where: { id: args[idIndex + 1] } });
    } else {
      license = await prisma.license.findUnique({ where: { licenseKey: args[keyIndex + 1] } });
    }
  } catch (err) {
    console.error('\n❌ DB error:', err.message);
    process.exit(1);
  }

  if (!license) {
    console.error('\n❌ License not found. Check the ID or key and try again.\n');
    process.exit(1);
  }

  if (!license.isActive) {
    console.warn(`\n⚠️  License for "${license.assignedTo}" is already revoked.\n`);
    process.exit(0);
  }

  await prisma.license.update({
    where: { id: license.id },
    data: { isActive: false, revokedAt: new Date() },
  });

  console.log('\n🔴 ══════════════════════════════════════════════════════════════');
  console.log(`   LICENSE REVOKED for: "${license.assignedTo}"`);
  console.log(`   License ID: ${license.id}`);
  console.log('   Their application will REFUSE TO START on next restart.');
  console.log('══════════════════════════════════════════════════════════════\n');
}

main()
  .catch((err) => {
    console.error('\n❌ Unexpected error:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
