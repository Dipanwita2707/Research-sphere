/**
 * Quick script to assign Gate Entry permission to student
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function assignPermission() {
  try {
    // Get student
    const student = await prisma.userLogin.findFirst({
      where: { uid: 'STU001' }
    });
    
    if (!student) {
      console.log('❌ Student STU001 not found');
      await prisma.$disconnect();
      return;
    }
    
    console.log(`✅ Found student: ${student.uid}`);
    
    // Get Gate Entry department
    const dept = await prisma.centralDepartment.findFirst({
      where: { 
        OR: [
          { departmentName: { contains: 'Gate', mode: 'insensitive' } },
          { departmentCode: 'GATE-ENTRY' }
        ]
      }
    });
    
    if (!dept) {
      console.log('❌ Gate Entry department not found');
      console.log('Creating Gate Entry department...');
      
      const newDept = await prisma.centralDepartment.create({
        data: {
          departmentCode: 'GATE-ENTRY',
          departmentName: 'Gate Entry',
          description: 'Gate Entry Pass Management'
        }
      });
      
      console.log(`✅ Created department: ${newDept.departmentName}`);
      
      // Assign permission
      await prisma.centralDepartmentPermission.create({
        data: {
          userId: student.id,
          centralDeptId: newDept.id,
          permissions: ['CREATE_PASS']
        }
      });
      
      console.log('✅ Permission assigned to student');
    } else {
      console.log(`✅ Found department: ${dept.departmentName}`);
      
      // Check if permission already exists
      const existing = await prisma.centralDepartmentPermission.findFirst({
        where: {
          userId: student.id,
          centralDeptId: dept.id
        }
      });
      
      if (existing) {
        console.log('✅ Permission already exists');
      } else {
        await prisma.centralDepartmentPermission.create({
          data: {
            userId: student.id,
            centralDeptId: dept.id,
            permissions: ['CREATE_PASS']
          }
        });
        console.log('✅ Permission assigned to student');
      }
    }
    
    console.log('\n═══════════════════════════════════════════');
    console.log('✅ STUDENT READY FOR TESTING!');
    console.log('═══════════════════════════════════════════');
    console.log('Login: STU001 / Test@123');
    console.log('═══════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

assignPermission();
