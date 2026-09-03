const prisma = require('./src/shared/config/database');
async function main() {
  const userId = '494a6ed6-149c-4aad-b9e6-ae0e3eaf5e0a';
  const perms = await prisma.centralDepartmentPermission.findMany({
    where: { userId },
    select: { permissions: true, assignedSchoolIds: true, assignedResearchSchoolIds: true, assignedBookSchoolIds: true, assignedConferenceSchoolIds: true, assignedGrantSchoolIds: true }
  });
  console.log('CentralDeptPerms:', JSON.stringify(perms, null, 2));
  
  const schools = await prisma.facultySchoolList.findMany({ select: { id: true, facultyCode: true, facultyName: true } });
  console.log('\nAll schools:', JSON.stringify(schools, null, 2));

  const user = await prisma.userLogin.findUnique({ where: { id: userId }, select: { uid: true, role: true, assignedRoleIds: true } });
  console.log('\nUser:', JSON.stringify(user));
}
main().catch(console.error).finally(() => prisma.$disconnect());
