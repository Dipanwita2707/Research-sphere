/**
 * Seed Noting Authority mappings for single-user roles in the approval flow.
 * Run: node scripts/database/seeds/seed-noting-authorities.js (from backend dir)
 *
 * DSW and CENTRAL_TEAM are not seeded here — they use existing Central Departments
 * (see /admin/central-departments). Assign members via Central Department permissions.
 *
 * Other role keys (one user per role):
 * - COE, DAA, ACCOUNTS_HEAD, PURCHASE_HEAD, HR_HEAD, CONSTRUCTION_TEAM_HEAD, HIGHER_AUTHORITY
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ROLE_KEYS = [
  'COE',
  'DAA',
  'ACCOUNTS_HEAD',
  'PURCHASE_HEAD',
  'HR_HEAD',
  'CONSTRUCTION_TEAM_HEAD',
  'HIGHER_AUTHORITY',
];

async function seedNotingAuthorities() {
  try {
    const admin = await prisma.userLogin.findFirst({
      where: { role: 'admin' },
      select: { id: true },
    });
    if (!admin) {
      console.error('No admin user found. Create an admin first.');
      process.exit(1);
    }
    const defaultUserId = admin.id;
    console.log('Using default userId for unmapped roles:', defaultUserId);
    console.log('DSW and CENTRAL_TEAM use Central Departments — manage at /admin/central-departments');

    for (const roleKey of ROLE_KEYS) {
      const existing = await prisma.notingAuthority.findFirst({
        where: { roleKey },
      });
      if (existing) {
        console.log('  ', roleKey, '-> already mapped to user', existing.userId);
      } else {
        await prisma.notingAuthority.create({
          data: { roleKey, userId: defaultUserId },
        });
        console.log('  ', roleKey, '-> created with default admin user');
      }
    }
    console.log('Noting authorities seed done.');
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedNotingAuthorities();
