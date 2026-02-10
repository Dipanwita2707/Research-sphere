/**
 * Get HOD and Dean credentials
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getCredentials() {
  try {
    // Get HOD
    const hod = await prisma.userLogin.findUnique({
      where: { email: 'hod@gmail.com' },
      select: {
        email: true,
        uid: true,
        role: true,
        employeeDetails: {
          select: {
            displayName: true,
            empId: true,
            primaryDepartment: {
              select: {
                departmentName: true,
              },
            },
          },
        },
      },
    });

    // Get Dean
    const dean = await prisma.userLogin.findUnique({
      where: { email: 'dean@gmail.com' },
      select: {
        email: true,
        uid: true,
        role: true,
        employeeDetails: {
          select: {
            displayName: true,
            empId: true,
            primarySchool: {
              select: {
                facultyName: true,
              },
            },
          },
        },
      },
    });

    console.log('🔑 Login Credentials:\n');

    if (hod) {
      console.log('👤 HOD:');
      console.log('   UID (Login ID): ' + (hod.uid || 'Not set'));
      console.log('   Email: hod@gmail.com');
      console.log('   Password: hod123');
      console.log('   Role:', hod.role);
      console.log('   Display Name:', hod.employeeDetails?.displayName || 'Not set');
      console.log('   Employee ID:', hod.employeeDetails?.empId || 'Not set');
      console.log('   Department:', hod.employeeDetails?.primaryDepartment?.departmentName || 'Not set');
      console.log('');
    } else {
      console.log('❌ HOD user not found');
    }

    if (dean) {
      console.log('👤 DEAN:');
      console.log('   UID (Login ID): ' + (dean.uid || 'Not set'));
      console.log('   Email: dean@gmail.com');
      console.log('   Password: dean123');
      console.log('   Role:', dean.role);
      console.log('   Display Name:', dean.employeeDetails?.displayName || 'Not set');
      console.log('   Employee ID:', dean.employeeDetails?.empId || 'Not set');
      console.log('   School:', dean.employeeDetails?.primarySchool?.facultyName || 'Not set');
      console.log('');
    } else {
      console.log('❌ Dean user not found');
    }

    // Get mentor too
    const mentor = await prisma.userLogin.findUnique({
      where: { email: 'mentor@gmail.com' },
      select: {
        email: true,
        uid: true,
        role: true,
        employeeDetails: {
          select: {
            displayName: true,
            primaryDepartment: {
              select: {
                departmentName: true,
              },
            },
          },
        },
      },
    });

    if (mentor) {
      console.log('👤 FACULTY (Mentor):');
      console.log('   UID (Login ID): ' + (mentor.uid || 'Not set'));
      console.log('   Email: mentor@gmail.com');
      console.log('   Password: mentor123');
      console.log('   Role:', mentor.role);
      console.log('   Display Name:', mentor.employeeDetails?.displayName || 'Not set');
      console.log('   Department:', mentor.employeeDetails?.primaryDepartment?.departmentName || 'Not set');
      console.log('');
    }

    console.log('\n📋 Summary:');
    console.log('   • Faculty creates club:');
    console.log('     Login: ' + (mentor?.uid || 'mentor@gmail.com') + ' / mentor123');
    console.log('   • HOD approves:');
    console.log('     Login: ' + (hod?.uid || 'hod@gmail.com') + ' / hod123');
    console.log('   • Dean approves:');
    console.log('     Login: ' + (dean?.uid || 'dean@gmail.com') + ' / dean123');
    console.log('   • Then DSW & Higher Authority');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

getCredentials();
