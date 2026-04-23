const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$executeRaw`ALTER TABLE loan_letter_template ADD COLUMN IF NOT EXISTS template_body TEXT`
  .then(() => { console.log('Migration applied: template_body column added'); })
  .catch(e => { console.error('Error:', e.message); })
  .finally(() => p.$disconnect());
