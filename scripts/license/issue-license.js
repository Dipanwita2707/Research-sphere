/**
 * issue-license.js — License Key Issuance CLI
 * ─────────────────────────────────────────────────────────────────────────────
 * Run this script to generate a new hardware-bound license key for an authorized user.
 *
 * Usage (from project root):
 *   node scripts/license/issue-license.js --name "Senior John Doe" [--notes "optional notes"]
 *
 * What it does:
 *   1. Generates a UUID v4 as the license key
 *   2. Writes it to the licenses table in your Neon DB
 *   3. Prints the LICENSE_KEY value to add to the recipient's .env file
 *
 * The key is UNBOUND until the authorized user runs the app for the first time.
 * On first startup, the hardware ID is automatically recorded and locked.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../backend/.env') });

const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function main() {
  // ── Parse CLI args ─────────────────────────────────────────────────────────
  const args = process.argv.slice(2);
  const nameIndex = args.indexOf('--name');
  const notesIndex = args.indexOf('--notes');

  if (nameIndex === -1 || !args[nameIndex + 1]) {
    console.error('\n❌ Usage: node issue-license.js --name "Recipient Name" [--notes "optional notes"]');
    console.error('   Example: node issue-license.js --name "Senior Rajesh Sharma"\n');
    process.exit(1);
  }

  const assignedTo = args[nameIndex + 1];
  const notes = notesIndex !== -1 ? args[notesIndex + 1] : null;

  // ── Generate unique license key ────────────────────────────────────────────
  const licenseKey = uuidv4();

  // ── Persist to DB ──────────────────────────────────────────────────────────
  let license;
  try {
    license = await prisma.license.create({
      data: {
        licenseKey,
        assignedTo,
        notes: notes || `Issued on ${new Date().toLocaleDateString('en-IN')}`,
        isActive: true,
      },
    });
  } catch (err) {
    console.error('\n❌ Failed to create license in database:', err.message);
    console.error('   Make sure your backend/.env has the correct DATABASE_URL and the migration has been run.\n');
    process.exit(1);
  }

  // ── Print result ───────────────────────────────────────────────────────────
  console.log('\n✅ ══════════════════════════════════════════════════════════════');
  console.log(`   License issued for: "${license.assignedTo}"`);
  console.log(`   License ID:         ${license.id}`);
  console.log('══════════════════════════════════════════════════════════════\n');
  console.log('   Add these lines to the recipient\'s .env file:\n');
  console.log(`   LICENSE_KEY=${license.licenseKey}`);
  console.log(`   LICENSE_SERVER_URL=https://researchsphere.tech/api/v1/license/verify`);
  console.log('   # LICENSE_SALT is set by the developer — do NOT share this value\n');
  console.log('══════════════════════════════════════════════════════════════');
  console.log('   Status: PENDING (will bind to hardware on first startup)');
  console.log('   To revoke: node scripts/license/revoke-license.js --id', license.id);
  console.log('══════════════════════════════════════════════════════════════\n');
}

main()
  .catch((err) => {
    console.error('\n❌ Unexpected error:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
