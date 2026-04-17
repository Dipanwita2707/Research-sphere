const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const roleId = '6ca572b1-3f1e-4989-935f-ffce0d7cb555';
  const userId = (await prisma.userLogin.findFirst({ where: { uid: '1234567' }, select: { id: true } }))?.id;
  console.log('UserId:', userId);

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { name: true, permissions: true }
  });
  console.log('\nRole name:', role?.name);
  console.log('Role permissions.centralDeptPermissions:');
  const rolePerms = role?.permissions?.centralDeptPermissions || {};
  Object.entries(rolePerms).filter(([,v]) => v).forEach(([k]) => console.log('  ', k));
  console.log('Role analyticsScope:', JSON.stringify(role?.permissions?.analyticsScope, null, 2));

  // Check departmentPermissions  
  if (userId) {
    const deptPerms = await prisma.departmentPermission.findMany({
      where: { userId, isActive: true },
      select: { permissions: true, departmentId: true, department: { select: { departmentName: true } } }
    });
    console.log('\nDepartment permissions count:', deptPerms.length);
    deptPerms.forEach(p => {
      console.log('  Dept:', p.department?.departmentName, p.departmentId?.slice(0,8));
      const analyticsPerms = Object.entries(p.permissions || {}).filter(([k,v]) => k.includes('analytics') && v);
      console.log('  Analytics perms:', analyticsPerms.map(([k]) => k));
    });
  }

  // Show what the centralDeptPermission actually looks like
  const centralPerm = await prisma.centralDepartmentPermission.findFirst({
    where: { userId, isActive: true }
  });
  console.log('\nCentralDeptPermission fields:', Object.keys(centralPerm || {}));
  console.log('assignedSchoolIds:', centralPerm?.assignedSchoolIds);
  // Try to find analytics-specific school id fields
  const allFields = Object.entries(centralPerm || {}).filter(([k]) => k.includes('School') || k.includes('school'));
  allFields.forEach(([k, v]) => console.log(' ', k, '=', JSON.stringify(v)));
}

main().catch(console.error).finally(() => prisma.$disconnect());
