/**
 * Baseline pending Prisma migrations as applied.
 * Use only when the live DB schema already matches schema.prisma
 * (verified via `prisma db push` "already in sync").
 */
require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations');
const dirs = fs
  .readdirSync(migrationsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

console.log(`Found ${dirs.length} migrations`);

for (const name of dirs) {
  try {
    execSync(`npx prisma migrate resolve --applied "${name}"`, {
      stdio: 'pipe',
      cwd: path.join(__dirname, '..'),
    });
    console.log('applied-mark:', name);
  } catch (e) {
    const msg = (e.stderr || e.stdout || e.message || '').toString();
    if (/already recorded as applied/i.test(msg) || /P3008/i.test(msg)) {
      console.log('already:', name);
    } else {
      console.log('skip/err:', name, msg.slice(0, 180).replace(/\s+/g, ' '));
    }
  }
}

console.log('Done baselining.');
