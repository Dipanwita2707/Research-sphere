/**
 * Check all club notings
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllNotings() {
  try {
    const notings = await prisma.note.findMany({
      where: {
        OR: [
          { subcategory: 'dsw_club_creation' },
          { subcategory: 'DSW' },
        ],
      },
      include: {
        createdBy: {
          select: {
            email: true,
            role: true,
            employeeDetails: {
              select: {
                displayName: true,
                primaryDepartmentId: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`📋 Found ${notings.length} club noting(s):\n`);

    notings.forEach((n, idx) => {
      console.log(`${idx + 1}. ${n.notingId} - ${n.clubName || 'No name'}`);
      console.log(`   Creator: ${n.createdBy.email} (${n.createdBy.role})`);
      console.log(`   Display Name: ${n.createdBy.employeeDetails?.displayName || 'Not set'}`);
      console.log(`   Has Department: ${n.createdBy.employeeDetails?.primaryDepartmentId ? '✅' : '❌'}`);
      console.log(`   Subcategory: ${n.subcategory}`);
      console.log(`   Status: ${n.status}`);
      console.log(`   Current Holder: ${n.currentHolderId || 'None'}`);
      console.log('');
    });

    // Check mentor specifically
    const mentor = await prisma.userLogin.findUnique({
      where: { email: 'mentor@gmail.com' },
      include: {
        employeeDetails: {
          include: {
            primaryDepartment: {
              select: {
                id: true,
                departmentName: true,
                headOfDepartmentId: true,
                facultyId: true,
              },
            },
          },
        },
      },
    });

    if (mentor) {
      console.log('\n👤 Mentor Details:');
      console.log('   Email:', mentor.email);
      console.log('   Role:', mentor.role);
      console.log('   Display Name:', mentor.employeeDetails?.displayName);
      console.log('   Primary Department:', mentor.employeeDetails?.primaryDepartment?.departmentName || 'NOT SET ❌');
      
      if (mentor.employeeDetails?.primaryDepartment) {
        const dept = mentor.employeeDetails.primaryDepartment;
        console.log('   Department ID:', dept.id);
        console.log('   HOD assigned:', dept.headOfDepartmentId ? '✅' : '❌');
        
        if (dept.headOfDepartmentId) {
          const hod = await prisma.userLogin.findUnique({
            where: { id: dept.headOfDepartmentId },
            include: { employeeDetails: true },
          });
          console.log('   HOD:', hod?.employeeDetails?.displayName || hod?.email);
        }

        // Check school/dean
        const school = await prisma.facultySchoolList.findUnique({
          where: { id: dept.facultyId },
          select: {
            name: true,
            deanId: true,
          },
        });
        
        if (school) {
          console.log('   School:', school.name);
          console.log('   Dean assigned:', school.deanId ? '✅' : '❌');
          
          if (school.deanId) {
            const dean = await prisma.userLogin.findUnique({
              where: { id: school.deanId },
              include: { employeeDetails: true },
            });
            console.log('   Dean:', dean?.employeeDetails?.displayName || dean?.email);
          }
        }
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllNotings();
