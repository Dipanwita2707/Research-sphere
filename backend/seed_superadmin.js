const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function seed() {
  const hashed = await bcrypt.hash('Test@123', 10);
  await prisma.userLogin.upsert({
    where: { uid: 'SUPER001' },
    update: { passwordHash: hashed, role: 'superadmin', status: 'active' },
    create: { uid: 'SUPER001', passwordHash: hashed, email: 'superadmin@sgt.edu', role: 'superadmin', status: 'active' }
  });
  console.log('Superadmin seeded');
}

seed().catch(console.error).finally(()=>prisma.$disconnect());
