/**
 * Create the platform superadmin (no university; manages tenants, tiers, licences).
 *
 *   npm run seed:superadmin
 *   npm run seed:superadmin -- --uid SUPER001 --email ops@example.com
 *   npm run seed:superadmin -- --force        # required when NODE_ENV=production
 *
 * - Creates the account only if the uid does not exist yet; an existing account is
 *   never modified (its password is never reset).
 * - Password: SUPERADMIN_PASSWORD if set, otherwise a strong random password that is
 *   printed once. Change it after first login.
 * - uid / email default to SUPERADMIN_UID / SUPERADMIN_EMAIL, then SUPER001 / none.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const bcrypt = require('bcryptjs');
const {
  getArg, assertNotProduction, resolvePassword, printCredentials,
} = require('../../../src/shared/database/seedUtils');

const SCRIPT = 'seed:superadmin';
const PASSWORD_ENV = 'SUPERADMIN_PASSWORD';

async function seedSuperadmin(prisma) {
  const uid = String(getArg('uid', process.env.SUPERADMIN_UID || 'SUPER001')).trim();
  const emailArg = getArg('email', process.env.SUPERADMIN_EMAIL || '');
  const email = emailArg ? String(emailArg).trim().toLowerCase() : null;
  if (!uid || uid.length > 32) throw new Error('uid must be 1-32 characters');

  const existing = await prisma.userLogin.findUnique({
    where: { uid },
    select: { id: true, role: true, universityId: true },
  });
  if (existing) {
    if (existing.role !== 'superadmin' || existing.universityId) {
      throw new Error(`uid "${uid}" already exists as a ${existing.role} account; choose another --uid`);
    }
    console.log(`Superadmin "${uid}" already exists; nothing changed (password untouched).`);
    return;
  }

  if (email) {
    const owner = await prisma.userLogin.findUnique({ where: { email }, select: { uid: true } });
    if (owner) throw new Error(`email "${email}" is already used by uid "${owner.uid}"`);
  }

  const others = await prisma.userLogin.count({ where: { role: 'superadmin' } });
  if (others > 0) console.log(`Note: ${others} other superadmin account(s) already exist.`);

  const { password, generated } = resolvePassword(PASSWORD_ENV);
  await prisma.userLogin.create({
    data: {
      uid,
      email,
      role: 'superadmin',
      status: 'active',
      universityId: null, // platform scope: not bound to a tenant
      passwordHash: await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS, 10) || 10),
    },
  });
  console.log(`Superadmin "${uid}" created.`);
  printCredentials([{ role: 'superadmin', uid, password, generated }], PASSWORD_ENV);
}

if (require.main === module) {
  assertNotProduction(SCRIPT);
  const prisma = require('../../../src/shared/config/database');
  seedSuperadmin(prisma)
    .catch((error) => {
      console.error(`[${SCRIPT}] failed:`, error.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { seedSuperadmin };
