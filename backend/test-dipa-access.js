const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testResearchAccess() {
  const user = await prisma.userLogin.findFirst({
    where: { uid: '12346' },
    select: { id: true }
  });
  
  if (!user) {
    console.log('User not found');
    return;
  }
  
  // Get DRD department
  const drdDept = await prisma.centralDepartment.findFirst({
    where: { departmentCode: 'DRD' }
  });
  
  // Get user's DRD permission
  const drdPerm = await prisma.centralDepartmentPermission.findFirst({
    where: {
      userId: user.id,
      centralDeptId: drdDept.id,
      isActive: true
    },
    select: {
      permissions: true,
      assignedResearchSchoolIds: true
    }
  });
  
  console.log('\n=== Dipa\'s Research Access ===');
  console.log('Permissions:', drdPerm?.permissions);
  console.log('Assigned Research Schools:', drdPerm?.assignedResearchSchoolIds);
  
  // Get research contributions from assigned school
  const contributions = await prisma.researchContribution.findMany({
    where: {
      schoolId: { in: drdPerm?.assignedResearchSchoolIds || [] },
      status: { in: ['submitted', 'under_review', 'resubmitted'] }
    },
    select: {
      id: true,
      title: true,
      publicationType: true,
      status: true,
      schoolId: true,
      school: {
        select: { facultyName: true }
      },
      applicantUser: {
        select: {
          employeeDetails: {
            select: { displayName: true }
          }
        }
      }
    },
    take: 10
  });
  
  console.log('\n=== Research Contributions Dipa Should See ===');
  console.log('Found', contributions.length, 'contributions');
  contributions.forEach(c => {
    console.log('- ', c.title?.substring(0, 60) || 'No title', '(', c.status, ') -', c.school?.facultyName);
  });
  
  await prisma.$disconnect();
}

testResearchAccess().catch(console.error);
