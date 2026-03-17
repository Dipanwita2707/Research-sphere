const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../src/shared/config/database');
const config = require('../src/shared/config/app.config');

const TARGET_EVENT_ID = process.argv[2];
const USER_COUNT = Number(process.argv[3] || 150);
const PASSWORD = 'Load@1234';
const UID_PREFIX = 'K6EVT';

if (!TARGET_EVENT_ID) {
  console.error('Usage: node seed-event-load-users.js <eventId> [count]');
  process.exit(1);
}

function buildUid(index) {
  return `${UID_PREFIX}${String(index).padStart(4, '0')}`;
}

function buildEmail(index) {
  return `k6evt${String(index).padStart(4, '0')}@load.test`;
}

async function main() {
  const event = await prisma.event.findUnique({
    where: { eventId: TARGET_EVENT_ID },
    select: { id: true, eventId: true, name: true },
  });

  if (!event) {
    throw new Error(`Event ${TARGET_EVENT_ID} not found`);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, config.bcrypt.rounds);
  const users = [];

  for (let index = 1; index <= USER_COUNT; index += 1) {
    const uid = buildUid(index);
    const email = buildEmail(index);

    const user = await prisma.userLogin.upsert({
      where: { uid },
      update: {
        email,
        passwordHash,
        role: 'student',
        status: 'active',
      },
      create: {
        uid,
        email,
        passwordHash,
        role: 'student',
        status: 'active',
      },
      select: { id: true, uid: true, email: true },
    });

    users.push(user);
  }

  await prisma.eventRegistration.deleteMany({
    where: {
      eventId: event.id,
      userId: { in: users.map((user) => user.id) },
    },
  });

  const tokens = users.map((user) => ({
    uid: user.uid,
    userId: user.id,
    token: jwt.sign({ id: user.id }, config.jwt.secret, { expiresIn: config.jwt.expire }),
  }));

  const outputDir = path.join(__dirname, '..', '..', 'scripts', 'k6', 'generated');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'event-load-users.json');
  fs.writeFileSync(outputPath, JSON.stringify(tokens, null, 2));

  console.log(JSON.stringify({
    eventId: event.eventId,
    eventName: event.name,
    userCount: users.length,
    password: PASSWORD,
    tokenFile: outputPath,
    sampleUsers: users.slice(0, 5),
  }, null, 2));

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});