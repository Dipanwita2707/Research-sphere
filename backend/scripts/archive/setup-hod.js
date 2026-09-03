/**
 * Setup HOD user properly
 * 1. Assign hod@gmail.com to a department
 * 2. Make them HOD of that department
 * 3. Make sure department has a dean
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setupHOD() {
  try {
    console.log('🔧 Setting up HOD user properly...\n');

    // Get hod user
    const hodUser = await prisma.userLogin.findUnique({
      where: { email: 'hod@gmail.com' },
      include: { employeeDetails: true },
    });

    if (!hodUser) {
      console.log('❌ hod@gmail.com user not found');
      return;
    }

    console.log('👤 HOD User:', hodUser.email, '-', hodUser.employeeDetails?.displayName);

    // Get or create a department
    let department = await prisma.department.findFirst({
      where: { departmentCode: 'CS' },
      include: { faculty: true },
    });

    if (!department) {
      console.log('❌ Computer Science department not found');
      // List available departments
      const depts = await prisma.department.findMany({
        select: { id: true, departmentName: true, departmentCode: true, facultyId: true },
        take: 5,
      });
      console.log('\n📋 Available departments:');
      depts.forEach(d => console.log(`  - ${d.departmentName} (${d.departmentCode})`));
      
      if (depts.length > 0) {
        department = await prisma.department.findUnique({
          where: { id: depts[0].id },
          include: { faculty: true },
        });
        console.log(`\n✅ Using: ${department.departmentName}`);
      } else {
        console.log('❌ No departments found. Please create one first.');
        return;
      }
    }

    console.log('\n🏢 Department:', department.departmentName);
    console.log('   School:', department.faculty.name);

    // Update HOD user's employee details to be in this department
    if (!hodUser.employeeDetails) {
      // Create employee details
      await prisma.employeeDetails.create({
        data: {
          userId: hodUser.id,
          firstName: 'Om',
          lastName: 'HOD',
          displayName: 'Om HOD',
          employeeId: 'HOD001',
          primaryDepartmentId: department.id,
          primarySchoolId: department.facultyId,
        },
      });
      console.log('✅ Created employee details for HOD');
    } else {
      // Update existing employee details
      await prisma.employeeDetails.update({
        where: { userId: hodUser.id },
        data: {
          primaryDepartmentId: department.id,
          primarySchoolId: department.facultyId,
        },
      });
      console.log('✅ Updated employee details for HOD');
    }

    // Make this user the HOD of the department
    await prisma.department.update({
      where: { id: department.id },
      data: {
        headOfDepartmentId: hodUser.id,
      },
    });
    console.log('✅ Set as HOD of', department.departmentName);

    // Check if school has dean
    if (!department.faculty.deanId) {
      // Find dean user
      const deanUser = await prisma.userLogin.findUnique({
        where: { email: 'dean@gmail.com' },
      });

      if (deanUser) {
        // Check/create employee details for dean
        let deanEmp = await prisma.employeeDetails.findUnique({
          where: { userId: deanUser.id },
        });

        if (!deanEmp) {
          deanEmp = await prisma.employeeDetails.create({
            data: {
              userId: deanUser.id,
              firstName: 'Om',
              lastName: 'Dean',
              displayName: 'Om Dean',
              employeeId: 'DEAN001',
              primarySchoolId: department.facultyId,
            },
          });
        } else if (!deanEmp.primarySchoolId) {
          deanEmp = await prisma.employeeDetails.update({
            where: { userId: deanUser.id },
            data: { primarySchoolId: department.facultyId },
          });
        }

        // Set as dean
        await prisma.facultySchoolList.update({
          where: { id: department.facultyId },
          data: { deanId: deanUser.id },
        });
        console.log('✅ Set dean@gmail.com as Dean of', department.faculty.name);
      }
    } else {
      console.log('✅ School already has Dean assigned');
    }

    console.log('\n🎉 HOD setup complete!');
    console.log('\n📋 Summary:');
    console.log(`  - HOD: ${hodUser.email} (${hodUser.employeeDetails?.displayName || 'Om HOD'})`);
    console.log(`  - Department: ${department.departmentName}`);
    console.log(`  - School: ${department.faculty.name}`);
    console.log('\n💡 Now hod@gmail.com can login and create clubs!');
    console.log('   The approval flow will be: HOD → Dean → DSW → Higher Authority');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

setupHOD();
