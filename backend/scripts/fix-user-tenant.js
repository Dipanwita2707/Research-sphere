require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const cache = require('../src/shared/config/redis');
const p = new PrismaClient();

(async () => {
  const uniId = 'eaba23dd-a26a-4420-acb2-52f48cbc7392';
  const userId = '8fa6bb69-6cd9-48da-84a7-c3061e4dafbb';

  const u = await p.userLogin.update({
    where: { id: userId },
    data: { universityId: uniId },
    select: { id: true, email: true, role: true, universityId: true },
  });
  console.log('UPDATED', u);

  await cache.invalidateUser(userId);
  console.log('Auth cache invalidated');

  await p.$disconnect();
  process.exit(0);
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
