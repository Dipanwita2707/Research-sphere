/**
 * Check vice chairperson data in noting
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkViceChairperson() {
  try {
    const noting = await prisma.note.findFirst({
      where: { notingId: 'DSW-CLB-2026-00001' },
    });

    console.log('📋 Noting Vice Chairperson Data:');
    console.log('   clubViceChairpersonId:', noting.clubViceChairpersonId || 'NULL');

    if (noting.clubViceChairpersonId) {
      // Check if it's a StudentDetails UUID
      const student = await prisma.studentDetails.findUnique({
        where: { id: noting.clubViceChairpersonId },
        select: {
          id: true,
          studentId: true,
          firstName: true,
          lastName: true,
          registrationNo: true,
          userLogin: {
            select: {
              email: true,
              role: true,
            },
          },
        },
      });

      if (student) {
        console.log('\n👤 Vice Chairperson (Student):');
        console.log('   UUID:', student.id);
        console.log('   Student ID:', student.studentId);
        console.log('   Reg No:', student.registrationNo);
        console.log('   Name:', `${student.firstName} ${student.lastName}`);
        console.log('   Email:', student.userLogin?.email || 'Not linked');
        console.log('   Role:', student.userLogin?.role || 'No user login');
      } else {
        console.log('\n❌ No student found with this UUID');
        console.log('   Trying as UserLogin...');
        
        // Check if it's a UserLogin UUID
        const user = await prisma.userLogin.findUnique({
          where: { id: noting.clubViceChairpersonId },
          select: {
            id: true,
            email: true,
            role: true,
          },
        });
        
        if (user) {
          console.log('   Found UserLogin:');
          console.log('   Email:', user.email);
          console.log('   Role:', user.role);
          console.log('   ⚠️ This is a UserLogin UUID, not StudentDetails UUID!');
        }
      }
    }

    // Check all students
    console.log('\n📊 Available students:');
    const students = await prisma.studentDetails.findMany({
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        registrationNo: true,
        userLogin: {
          select: {
            email: true,
            role: true,
          },
        },
      },
      take: 10,
    });

    students.forEach(s => {
      console.log(`   - ${s.studentId} (${s.registrationNo}): ${s.firstName} ${s.lastName}`);
      console.log(`     User ID (UUID): ${s.id}`);
      console.log(`     Email: ${s.userLogin?.email || 'Not linked'}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkViceChairperson();
