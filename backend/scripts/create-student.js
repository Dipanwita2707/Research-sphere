/**
 * Create a student in the database
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function createStudent() {
  try {
    console.log('🔧 Creating student...\n');

    const studentUid = '12213949';
    const password = 'Welcome@123';
    const studentId = '12213949'; // Using UID as student ID

    // Check if student already exists
    const existingLogin = await prisma.userLogin.findUnique({
      where: { uid: studentUid },
    });

    if (existingLogin) {
      console.log('❌ Student login already exists with UID:', studentUid);
      console.log('   Updating password...');
      
      // Just update the password
      const hashedPassword = await bcrypt.hash(password, 12);
      await prisma.userLogin.update({
        where: { uid: studentUid },
        data: { passwordHash: hashedPassword },
      });
      
      console.log('✅ Password updated successfully!\n');
      console.log('📋 Login Credentials:');
      console.log(`   UID: ${studentUid}`);
      console.log(`   Password: ${password}`);
      
      await prisma.$disconnect();
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create UserLogin
    const userLogin = await prisma.userLogin.create({
      data: {
        uid: studentUid,
        email: `${studentUid}@student.sgtuniversity.org`,
        passwordHash: hashedPassword,
        role: 'student',
        status: 'active',
      },
    });

    console.log('✅ User login created:', userLogin.uid);

    // Create StudentDetails
    const studentDetails = await prisma.studentDetails.create({
      data: {
        userLoginId: userLogin.id,
        studentId: studentId,
        firstName: 'Student',
        lastName: studentId,
        displayName: `Student ${studentId}`,
        registrationNo: studentId,
        email: `${studentUid}@student.sgtuniversity.org`,
        currentSemester: 1,
        dataEntryStatus: 'approved',
        isActive: true,
      },
    });

    console.log('✅ Student details created:', studentDetails.studentId);

    console.log('\n🎉 Student created successfully!\n');
    console.log('📋 Login Credentials:');
    console.log(`   UID: ${studentUid}`);
    console.log(`   Password: ${password}`);
    console.log(`   Email: ${userLogin.email}`);
    console.log(`   Student ID: ${studentDetails.studentId}`);

  } catch (error) {
    console.error('❌ Error creating student:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createStudent()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
