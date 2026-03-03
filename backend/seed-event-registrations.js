/**
 * Seed script: register specific emails to event EVT-2026-0004 with pending status
 * Run from backend dir:  node seed-event-registrations.js
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const TARGET_EVENT_ID = 'EVT-2026-0004';

const EMAILS = [
  'adityarajsingham@gmail.com',
  'sourav092002@gmail.com',
  'dipanwitakundu2707@gmail.com',
  'cryptoa878@gmail.com',
  'tiwarisatywam4685@gmail.com',
];

// ── helpers ────────────────────────────────────────────────────────────────────

/** REG-EVT-2026-0004-XXXX  (same value used as both id and registrationId) */
async function nextRegistrationId(eventId) {
  const prefix = `REG-${eventId}-`;
  const count = await prisma.eventRegistration.count({ where: { eventId } });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

/** Deterministic but unique enough QR token */
function makeQrCode(eventId, userId) {
  return `QR-${eventId}-${userId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

async function findOrCreateUser(email) {
  const existing = await prisma.userLogin.findFirst({ where: { email } });
  if (existing) return existing;

  // derive a short uid from the email local part
  const localPart = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 20);
  // make sure uid is unique
  const baseUid = localPart;
  let uid = baseUid;
  let suffix = 1;
  while (await prisma.userLogin.findFirst({ where: { uid } })) {
    uid = `${baseUid}${suffix++}`;
  }

  const passwordHash = await bcrypt.hash('Temp@1234', 10);

  const newUser = await prisma.userLogin.create({
    data: {
      uid,
      email,
      passwordHash,
      role: 'student',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log(`  👤 Created new user  uid=${uid}  email=${email}`);
  return newUser;
}

// ── main ───────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Locate the event by its human-readable eventId
  const event = await prisma.event.findUnique({ where: { eventId: TARGET_EVENT_ID } });
  if (!event) {
    console.error(`❌ Event "${TARGET_EVENT_ID}" not found in the database.`);
    process.exit(1);
  }
  console.log(`✅ Found event: "${event.name}"  (db id: ${event.id})\n`);

  const results = [];

  for (const email of EMAILS) {
    console.log(`Processing ${email} …`);

    // 2. Find or create the user
    const user = await findOrCreateUser(email);

    // 3. Skip if already registered
    const already = await prisma.eventRegistration.findFirst({
      where: { eventId: event.id, userId: user.id },
    });
    if (already) {
      console.log(`  ⚠️  Already registered (status: ${already.status})  registrationId: ${already.registrationId}\n`);
      results.push({ email, status: 'skipped', registrationId: already.registrationId });
      continue;
    }

    // 4. Generate IDs
    const registrationId = await nextRegistrationId(event.id);
    const qrCode = makeQrCode(event.id, user.id);

    // 5. Insert registration
    const reg = await prisma.eventRegistration.create({
      data: {
        id: registrationId,
        registrationId,
        eventId: event.id,
        userId: user.id,
        status: 'pending',
        qrCode,
        registeredAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(`  ✅ Registered  registrationId: ${reg.registrationId}  status: ${reg.status}\n`);
    results.push({ email, status: 'created', registrationId: reg.registrationId });
  }

  // ── summary ───────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════');
  console.log(`  Summary for event: ${TARGET_EVENT_ID}`);
  console.log('══════════════════════════════════════════════════');
  for (const r of results) {
    const icon = r.status === 'created' ? '✅' : '⚠️ ';
    console.log(`  ${icon}  [${r.status.toUpperCase().padEnd(7)}]  ${r.email.padEnd(38)}  ${r.registrationId}`);
  }
  console.log('══════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Fatal error:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
