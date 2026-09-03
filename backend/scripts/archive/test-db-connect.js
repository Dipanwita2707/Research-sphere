const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$connect()
  .then(() => { console.log('DB Connected OK'); return p.$disconnect(); })
  .catch((e) => { console.error('DB Failed:', e.message); process.exit(1); });
