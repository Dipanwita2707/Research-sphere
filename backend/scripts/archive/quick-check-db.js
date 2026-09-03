const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDB() {
  const perms = await prisma.centralDepartmentPermission.findMany({
    where: {
      user: {
        uid: { in: ['GUARD001', 'FAC001'] }
      }
    },
    include: {
      user: { select: { uid: true, email: true } },
      centralDept: { select: { departmentName: true, departmentType: true } }
    }
  });

  console.log('\n✅ Permissions Found in Database:\n');
  if (perms.length === 0) {
    console.log('❌ No permissions found!');
  } else {
    perms.forEach(p => {
      console.log(`User: ${p.user.uid} (${p.user.email})`);
      console.log(`Department: ${p.centralDept.departmentName}`);
      console.log(`Permissions:`, p.permissions);
      console.log('');
    });
  }

  await prisma.$disconnect();
}

checkDB().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
