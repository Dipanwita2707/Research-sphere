/**
 * list-licenses.js — License Status Dashboard CLI
 * ─────────────────────────────────────────────────────────────────────────────
 * Prints all licenses with their current status.
 *
 * Usage:
 *   node scripts/license/list-licenses.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../backend/.env') });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const licenses = await prisma.license.findMany({
    orderBy: { createdAt: 'desc' },
  });

  if (licenses.length === 0) {
    console.log('\n📋 No licenses found. Issue one with: node scripts/license/issue-license.js\n');
    return;
  }

  console.log('\n📋 ══════════════════════════════════════════════════════════════');
  console.log(`   ACTIVE LICENSES (${licenses.length} total)`);
  console.log('══════════════════════════════════════════════════════════════\n');

  for (const l of licenses) {
    const status = !l.isActive ? '🔴 REVOKED' : l.hardwareId ? '🟢 ACTIVE' : '🟡 PENDING';
    console.log(`  ${status}  ${l.assignedTo}`);
    console.log(`   ID:         ${l.id}`);
    console.log(`   Key:        ${l.licenseKey}`);
    console.log(`   Activated:  ${l.activatedAt ? l.activatedAt.toLocaleString('en-IN') : 'Not yet activated'}`);
    console.log(`   HW bound:   ${l.hardwareId ? `${l.hardwareId.substring(0, 16)}...` : 'No'}`);
    if (l.notes) console.log(`   Notes:      ${l.notes}`);
    if (l.revokedAt) console.log(`   Revoked:    ${l.revokedAt.toLocaleString('en-IN')}`);
    console.log();
  }

  console.log('  Commands:');
  console.log('  Issue:  node scripts/license/issue-license.js --name "Name"');
  console.log('  Revoke: node scripts/license/revoke-license.js --id <id>');
  console.log('══════════════════════════════════════════════════════════════\n');
}

main()
  .catch((err) => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
