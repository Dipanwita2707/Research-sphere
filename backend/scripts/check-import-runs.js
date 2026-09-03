require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const userId = '8fa6bb69-6cd9-48da-84a7-c3061e4dafbb';
  const identity = await p.researchProfileIdentity.findUnique({
    where: { userId },
    include: {
      importRuns: { orderBy: { startedAt: 'desc' }, take: 5 },
    },
  });
  console.log('identity', JSON.stringify(identity, null, 2));
  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
