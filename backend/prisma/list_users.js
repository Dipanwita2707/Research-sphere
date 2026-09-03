const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.userLogin.findMany({
    select: {
      id: true,
      uid: true,
      email: true,
      role: true,
      status: true,
      universityId: true
    }
  });
  console.log('👤 All users in database:');
  console.table(users);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
