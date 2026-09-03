const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('🔒 Seeding superadmin user...');
  const passwordHash = await bcrypt.hash('Test@123', 10);

  const superadmin = await prisma.userLogin.upsert({
    where: { uid: 'SUPER001' },
    update: {
      email: 'superadmin@sgt.edu',
      passwordHash: passwordHash,
      role: 'superadmin',
      status: 'active',
      universityId: null // Global scope
    },
    create: {
      uid: 'SUPER001',
      email: 'superadmin@sgt.edu',
      passwordHash: passwordHash,
      role: 'superadmin',
      status: 'active',
      universityId: null // Global scope
    }
  });

  console.log('✅ Superadmin created successfully in database:');
  console.log(JSON.stringify(superadmin, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
