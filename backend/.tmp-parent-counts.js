require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const parentDetailsCount = await prisma.parentDetails.count();
    const studentCount = await prisma.studentDetails.count();
    const parentRoleUsers = await prisma.userLogin.count({ where: { role: 'parent' } });

    const parentsPerStudent = await prisma.parentDetails.groupBy({
      by: ['studentId'],
      _count: { studentId: true }
    });

    const moreThanTwo = parentsPerStudent.filter((x) => x._count.studentId > 2).length;

    console.log(JSON.stringify({
      parentDetailsCount,
      studentCount,
      expectedIf2PerStudent: studentCount * 2,
      parentRoleUsers,
      studentsWithMoreThan2Parents: moreThanTwo
    }, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
