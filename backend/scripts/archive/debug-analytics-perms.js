const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find the user "sourav test mukhopadhyay"
  const users = await prisma.userLogin.findMany({
    where: {
      OR: [
        { uid: { contains: 'sourav', mode: 'insensitive' } },
        { employeeDetails: { displayName: { contains: 'sourav', mode: 'insensitive' } } }
      ]
    },
    include: {
      employeeDetails: { select: { displayName: true } },
      centralDeptPermissions: { where: { isActive: true }, select: { permissions: true, assignedSchoolIds: true } },
    },
    take: 5
  });
  
  console.log('Found users:', users.length);
  users.forEach(u => {
    console.log('\nUser:', u.uid, '-', u.employeeDetails?.displayName);
    console.log('  role:', u.role);
    console.log('  assignedRoleIds:', u.assignedRoleIds);
    console.log('  centralDeptPermissions count:', u.centralDeptPermissions?.length);
    if (u.centralDeptPermissions?.length > 0) {
      u.centralDeptPermissions.forEach(p => {
        const analyticsPerms = Object.entries(p.permissions || {}).filter(([k,v]) => k.includes('analytics') && v);
        console.log('  Analytics permissions:', analyticsPerms.map(([k]) => k));
        console.log('  assignedSchoolIds:', p.assignedSchoolIds);
      });
    }
  });

  // Check if any user has applicant_analytics permission
  const analyticsPermsCount = await prisma.centralDepartmentPermission.count({
    where: { isActive: true, permissions: { path: ['applicant_analytics'], equals: true } }
  });
  console.log('\nUsers with applicant_analytics permission:', analyticsPermsCount);

  // Check research contributions and what school/dept they're associated with
  const contributions = await prisma.researchContribution.findMany({
    select: {
      id: true,
      schoolId: true,
      departmentId: true,
      applicantUserId: true,
      status: true,
      school: { select: { shortName: true, facultyName: true } },
      department: { select: { departmentName: true, shortName: true } }
    }
  });
  console.log('\nResearch contributions:');
  contributions.forEach(c => console.log(JSON.stringify({ id: c.id.slice(0,8), schoolId: c.schoolId?.slice(0,8), deptId: c.departmentId?.slice(0,8), school: c.school?.shortName || c.school?.facultyName, dept: c.department?.departmentName })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
