require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const id = '8fa6bb69-6cd9-48da-84a7-c3061e4dafbb';
  const u = await p.userLogin.findUnique({
    where: { id },
    include: { employeeDetails: true, studentLogin: true },
  });
  console.log('USER', JSON.stringify(u, null, 2));

  const admins = await p.userLogin.findMany({
    where: { role: { in: ['admin', 'superadmin'] } },
    select: { id: true, email: true, username: true, role: true, isActive: true },
  });
  console.log('ADMINS', JSON.stringify(admins, null, 2));

  const all = await p.userLogin.findMany({
    select: { id: true, email: true, username: true, role: true, isActive: true },
  });
  console.log('ALL LOGINS', JSON.stringify(all, null, 2));

  console.log('counts', {
    emp: await p.employeeDetails.count(),
    stu: await p.studentDetails.count(),
    logins: await p.userLogin.count(),
  });

  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
