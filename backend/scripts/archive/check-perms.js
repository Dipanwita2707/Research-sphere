const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Simulate what getMyNotingPermissions does for Aisha Singh
  const userId = '7a160bae-2466-4131-bdd5-22dba14d5438';
  
  const user = await p.userLogin.findUnique({
    where: { id: userId },
    select: {
      id: true,
      uid: true,
      email: true,
      role: true,
      centralDeptPermissions: true,
      schoolDeptPermissions: true,
      assignedRoleIds: true,
    }
  });
  
  console.log('User role:', user.role);
  console.log('centralDeptPermissions:', JSON.stringify(user.centralDeptPermissions));
  console.log('schoolDeptPermissions:', JSON.stringify(user.schoolDeptPermissions));
  console.log('assignedRoleIds:', user.assignedRoleIds);

  // Check club query
  const club = await p.club.findFirst({
    where: {
      chairpersonId: userId,
      status: { in: ['approved', 'active'] },
    },
    select: { id: true, clubId: true, name: true, status: true },
  });
  
  console.log('\nChairperson club found:', JSON.stringify(club, null, 2));
  console.log('\nConclusion: noting_create should be', club ? 'TRUE' : 'FALSE');

  await p.$disconnect();
}

main().catch(e => { console.error(e); p.$disconnect(); });
