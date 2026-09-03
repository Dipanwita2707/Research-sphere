/**
 * Register specific students to event EVT-2026-0002 with confirmed status.
 * Looks up each student by enrollment number (uid) first, then by email.
 *
 * Run from backend dir:  node register-students-evt-0002.js
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

const TARGET_EVENT_ID = 'EVT-2026-0002';

const STUDENTS = [
  { enrollment: '12201501', name: 'Aarav Sharma',  email: 'aarav.sharma@sgt.edu'  },
  { enrollment: '12201502', name: 'Ananya Patel',  email: 'ananya.patel@sgt.edu'  },
  { enrollment: '12201503', name: 'Vivaan Kumar',  email: 'vivaan.kumar@sgt.edu'  },
  { enrollment: '12201504', name: 'Aisha Singh',   email: 'aisha.singh@sgt.edu'   },
  { enrollment: '12201505', name: 'Arjun Verma',   email: 'arjun.verma@sgt.edu'   },
];

// ── helpers ────────────────────────────────────────────────────────────────────

async function nextRegistrationId(eventId) {
  const prefix = `REG-${eventId}-`;
  const count = await prisma.eventRegistration.count({ where: { eventId } });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

function makeQrCode(eventId, userId) {
  return `QR-${eventId}-${userId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

async function findStudent({ enrollment, email, name }) {
  // 1. Try by enrollment number (uid)
  let user = await prisma.userLogin.findFirst({ where: { uid: enrollment } });
  if (user) {
    console.log(`  🔍 Found by enrollment ${enrollment}  (id: ${user.id})`);
    return user;
  }

  // 2. Try by email
  user = await prisma.userLogin.findFirst({ where: { email } });
  if (user) {
    console.log(`  🔍 Found by email ${email}  (id: ${user.id})`);
    return user;
  }

  console.log(`  ❌ Student not found in database — enrollment: ${enrollment}, email: ${email}`);
  console.log(`     Make sure the account exists first before registering.`);
  return null;
}

// ── main ───────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Locate the event
  const event = await prisma.event.findUnique({ where: { eventId: TARGET_EVENT_ID } });
  if (!event) {
    console.error(`❌ Event "${TARGET_EVENT_ID}" not found in the database.`);
    process.exit(1);
  }
  console.log(`✅ Found event: "${event.name}"  (db id: ${event.id})\n`);

  const results = [];

  for (const student of STUDENTS) {
    console.log(`\nProcessing ${student.name} (${student.enrollment}) …`);

    // 2. Find the student's user account
    const user = await findStudent(student);
    if (!user) {
      results.push({ ...student, status: 'not_found', registrationId: '-' });
      continue;
    }

    // 3. Skip if already registered
    const already = await prisma.eventRegistration.findFirst({
      where: { eventId: event.id, userId: user.id },
    });
    if (already) {
      console.log(`  ⚠️  Already registered  status: ${already.status}  id: ${already.registrationId}`);
      results.push({ ...student, status: 'skipped', registrationId: already.registrationId });
      continue;
    }

    // 4. Generate IDs
    const registrationId = await nextRegistrationId(event.id);
    const qrCode = makeQrCode(event.id, user.id);

    // 5. Create the registration
    const reg = await prisma.eventRegistration.create({
      data: {
        id: registrationId,
        registrationId,
        eventId: event.id,
        userId: user.id,
        status: 'confirmed',
        paymentStatus: event.paymentType === 'free' ? null : 'completed',
        amountPaid: event.paymentType === 'free' ? null : (event.registrationFee ?? 0),
        qrCode,
        registeredAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(`  ✅ Registered  registrationId: ${reg.registrationId}  status: ${reg.status}`);
    results.push({ ...student, status: 'created', registrationId: reg.registrationId });
  }

  // ── summary ────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(`  Summary for event: ${TARGET_EVENT_ID}  —  "${event.name}"`);
  console.log('══════════════════════════════════════════════════════════════════');
  for (const r of results) {
    const icon = r.status === 'created' ? '✅' : r.status === 'skipped' ? '⚠️ ' : '❌';
    console.log(
      `  ${icon}  [${r.status.toUpperCase().padEnd(9)}]  ${r.enrollment}  ${r.name.padEnd(16)}  ${r.registrationId}`
    );
  }
  console.log('══════════════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
