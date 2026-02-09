/**
 * Seed a single admin user.
 * Run from backend: node scripts/database/seeds/seed-admin.js
 * Or: npm run seed:admin
 *
 * Credentials: admin / admin123
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ADMIN_UID = 'admin';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_EMAIL = 'admin@sgtuniversity.edu';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;

async function seedAdmin() {
  try {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);
    const admin = await prisma.userLogin.upsert({
      where: { uid: ADMIN_UID },
      update: {
        email: ADMIN_EMAIL,
        passwordHash,
        role: 'admin',
        status: 'active',
      },
      create: {
        uid: ADMIN_UID,
        email: ADMIN_EMAIL,
        passwordHash,
        role: 'admin',
        status: 'active',
      },
    });
    console.log('✅ Admin user seeded successfully.');
    console.log('   Username:', ADMIN_UID);
    console.log('   Password:', ADMIN_PASSWORD);
    console.log('   Email:', ADMIN_EMAIL);
    console.log('   ID:', admin.id);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedAdmin();
