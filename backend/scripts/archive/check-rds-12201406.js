const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const dbUrl = process.env.DATABASE_URL || '';
  let safeDb = 'unknown';

  try {
    const parsed = new URL(dbUrl);
    safeDb = `${parsed.hostname}/${parsed.pathname.replace(/^\//, '')}`;
  } catch {
    safeDb = 'invalid-url';
  }

  const student = await prisma.studentDetails.findUnique({
    where: { studentId: '12201406' },
    select: {
      id: true,
      studentId: true,
      firstName: true,
      lastName: true,
      email: true,
      userLoginId: true,
      parents: {
        where: { isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          relationship: true,
          isPrimaryContact: true,
          isActive: true
        },
        orderBy: { firstName: 'asc' }
      }
    }
  });

  const parentCount = await prisma.parentDetails.count();

  console.log(JSON.stringify({
    db: safeDb,
    totalParents: parentCount,
    student
  }, null, 2));
}

main()
  .catch((err) => {
    console.error('CHECK_FAILED', err.stack || err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
