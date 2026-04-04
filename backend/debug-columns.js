const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.$queryRawUnsafe(
  "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'central_department_permission' AND column_name LIKE '%analytics%'"
).then(r => {
  console.log('Analytics columns in DB:', JSON.stringify(r, null, 2));
  return p.$disconnect();
}).catch(console.error);
