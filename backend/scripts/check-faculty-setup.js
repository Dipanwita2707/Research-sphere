/**
 * Simple check - Get faculty who created club noting
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkFacultySetup() {
  try {
    // Get the club noting
    const noting = await prisma.note.findFirst({
      where: {
        subcategory: 'dsw_club_creation',
      },
      select: {
        notingId: true,
        clubName: true,
        createdById: true,
        currentHolderId: true,
      },
    });

    if (!noting) {
      console.log('No club noting found');
      return;
    }

    console.log('📋 Noting:', noting.notingId, '-', noting.clubName);
    console.log('Creator ID:', noting.createdById);

    // Get creator details
    const creator = await prisma.userLogin.findUnique({
      where: { id: noting.createdById },
      select: {
        email: true,
        role: true,
        employeeDetails: {
          select: {
            displayName: true,
            primaryDepartmentId: true,
            primarySchoolId: true,
          },
        },
      },
    });

    console.log('\n👤 Creator:', creator.email, '-', creator.role);
    console.log('Display Name:', creator.employeeDetails?.displayName);
    console.log('Primary Department ID:', creator.employeeDetails?.primaryDepartmentId || 'NOT SET ❌');
    console.log('Primary School ID:', creator.employeeDetails?.primarySchoolId || 'NOT SET ❌');

    // Check department if set
    if (creator.employeeDetails?.primaryDepartmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: creator.employeeDetails.primaryDepartmentId },
        select: {
          departmentName: true,
          headOfDepartmentId: true,
          faculty: {
            select: {
              name: true,
              deanId: true,
            },
          },
        },
      });

      console.log('\n🏢 Department:', dept.departmentName);
      console.log('HOD ID:', dept.headOfDepartmentId || 'NOT ASSIGNED ❌');
      console.log('School:', dept.faculty.name);
      console.log('Dean ID:', dept.faculty.deanId || 'NOT ASSIGNED ❌');

      // Get HOD details if assigned
      if (dept.headOfDepartmentId) {
        const hod = await prisma.userLogin.findUnique({
          where: { id: dept.headOfDepartmentId },
          include: { employeeDetails: true },
        });
        console.log('HOD:', hod?.employeeDetails?.displayName || hod?.email);
      }

      // Get Dean details if assigned
      if (dept.faculty.deanId) {
        const dean = await prisma.userLogin.findUnique({
          where: { id: dept.faculty.deanId },
          include: { employeeDetails: true },
        });
        console.log('Dean:', dean?.employeeDetails?.displayName || dean?.email);
      }
    }

    // Check current holder
    if (noting.currentHolderId) {
      const holder = await prisma.userLogin.findUnique({
        where: { id: noting.currentHolderId },
        include: { employeeDetails: true },
      });
      console.log('\n🎯 Current Holder:', holder?.employeeDetails?.displayName || holder?.email);
    }

    // Get all faculty users for reference
    console.log('\n\n📊 All Faculty users:');
    const allFaculty = await prisma.userLogin.findMany({
      where: { role: 'faculty' },
      select: {
        email: true,
        employeeDetails: {
          select: {
            displayName: true,
            primaryDepartmentId: true,
          },
        },
      },
    });

    allFaculty.forEach(f => {
      console.log(`  - ${f.email} (${f.employeeDetails?.displayName}) - Dept: ${f.employeeDetails?.primaryDepartmentId ? '✅' : '❌'}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkFacultySetup();
