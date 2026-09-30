/**
 * @module seedUtils
 * @description Shared helpers for the seed scripts (seed.js, seed-superadmin.js,
 * scripts/database/seeds/*). Nothing here writes to the database on require.
 *
 * Rules every seed follows:
 *   - refuses to run with NODE_ENV=production unless `--force` is passed
 *   - never hardcodes passwords: uses an env var or generates a strong random one
 *   - never resets the password of an account that already exists
 */
const crypto = require('crypto');

const hasFlag = (name) => process.argv.includes(`--${name}`);

/** Value of `--name value` or `--name=value`, else fallback. */
const getArg = (name, fallback = undefined) => {
  const argv = process.argv;
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const idx = argv.indexOf(`--${name}`);
  if (idx !== -1 && argv[idx + 1] && !argv[idx + 1].startsWith('--')) return argv[idx + 1];
  return fallback;
};

/** Abort when pointed at production unless the operator explicitly passed --force. */
const assertNotProduction = (scriptName) => {
  if (process.env.NODE_ENV === 'production' && !hasFlag('force')) {
    console.error(`[${scriptName}] Refusing to run with NODE_ENV=production. Re-run with --force if you really mean it.`);
    process.exit(1);
  }
};

/**
 * Strong random password: 20 chars from an unambiguous alphabet, guaranteed to
 * contain a lower-case letter, an upper-case letter, a digit and a symbol.
 */
const generatePassword = (length = 20) => {
  const sets = ['abcdefghijkmnopqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!@#$%^&*-_+='];
  const all = sets.join('');
  const chars = sets.map((s) => s[crypto.randomInt(s.length)]);
  while (chars.length < length) chars.push(all[crypto.randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

/**
 * Password for a new account: the env var if set (not echoed back), otherwise a
 * freshly generated one that the caller must print once.
 * @returns {{ password: string, generated: boolean }}
 */
const resolvePassword = (envVar) => {
  const fromEnv = process.env[envVar];
  if (fromEnv) {
    if (fromEnv.length < 12) {
      throw new Error(`${envVar} must be at least 12 characters long.`);
    }
    return { password: fromEnv, generated: false };
  }
  return { password: generatePassword(), generated: true };
};

/** Print newly created credentials exactly once, at the end of a run. */
const printCredentials = (rows, envVar) => {
  if (!rows.length) {
    console.log('\nNo new accounts were created; existing passwords were left untouched.');
    return;
  }
  console.log('\nNew accounts (shown once, store them in a password manager):');
  for (const r of rows) {
    const pwd = r.generated ? r.password : `<value of ${envVar}>`;
    console.log(`  ${String(r.role).padEnd(11)} uid=${String(r.uid).padEnd(16)} password=${pwd}`);
  }
};

/**
 * Resolve the tenant named by the required `--university <CODE>` argument.
 * Run before opening a tenant context (University lookups by code are global).
 */
const requireUniversity = async (prisma) => {
  const code = getArg('university');
  if (!code) throw new Error('--university <CODE> is required (e.g. --university SGT)');
  const university = await prisma.university.findUnique({
    where: { code: String(code).trim().toUpperCase() },
    select: { id: true, code: true, name: true },
  });
  if (!university) throw new Error(`University with code "${code}" not found`);
  return university;
};

/** Oldest active admin of a university, used as createdBy for seeded config rows. */
const findTenantAdmin = async (prisma, universityId) => {
  const admin = await prisma.userLogin.findFirst({
    where: { universityId, role: 'admin', status: 'active' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, uid: true },
  });
  if (!admin) throw new Error('No active admin user in this university; run `npm run seed` or create one first');
  return admin;
};

module.exports = {
  requireUniversity,
  findTenantAdmin,
  hasFlag,
  getArg,
  assertNotProduction,
  generatePassword,
  resolvePassword,
  printCredentials,
};
