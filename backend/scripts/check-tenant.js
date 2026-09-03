require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const unis = await p.university.findMany({
    select: { id: true, name: true, code: true, isActive: true },
  });
  console.log('UNIVERSITIES', JSON.stringify(unis, null, 2));

  const orphaned = await p.userLogin.findMany({
    where: { universityId: null, role: { not: 'superadmin' } },
    select: { id: true, email: true, role: true, uid: true, status: true },
  });
  console.log('ORPHANED USERS', JSON.stringify(orphaned, null, 2));

  const admins = await p.userLogin.findMany({
    where: { role: { in: ['admin', 'superadmin'] } },
    select: { id: true, email: true, role: true, universityId: true, status: true },
  });
  console.log('ADMINS', JSON.stringify(admins, null, 2));

  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
