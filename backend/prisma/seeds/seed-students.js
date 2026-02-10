const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

/**
 * Seed 10 Students for DSW Testing
 */
async function seedStudents() {
  const students = [
    {
      studentId: '12201401',
      registrationNo: 'REG2024001',
      firstName: 'Rahul',
      lastName: 'Sharma',
      email: 'rahul.sharma@sgt.edu',
      phone: '9876543210',
      gender: 'Male',
      currentSemester: 3,
    },
    {
      studentId: '12201402',
      registrationNo: 'REG2024002',
      firstName: 'Priya',
      lastName: 'Singh',
      email: 'priya.singh@sgt.edu',
      phone: '9876543211',
      gender: 'Female',
      currentSemester: 3,
    },
    {
      studentId: '12201403',
      registrationNo: 'REG2024003',
      firstName: 'Amit',
      lastName: 'Kumar',
      email: 'amit.kumar@sgt.edu',
      phone: '9876543212',
      gender: 'Male',
      currentSemester: 5,
    },
    {
      studentId: '12201404',
      registrationNo: 'REG2024004',
      firstName: 'Sneha',
      lastName: 'Patel',
      email: 'sneha.patel@sgt.edu',
      phone: '9876543213',
      gender: 'Female',
      currentSemester: 5,
    },
    {
      studentId: '12201405',
      registrationNo: 'REG2024005',
      firstName: 'Vikram',
      lastName: 'Verma',
      email: 'vikram.verma@sgt.edu',
      phone: '9876543214',
      gender: 'Male',
      currentSemester: 7,
    },
    {
      studentId: '12201406',
      registrationNo: 'REG2024006',
      firstName: 'Anjali',
      lastName: 'Gupta',
      email: 'anjali.gupta@sgt.edu',
      phone: '9876543215',
      gender: 'Female',
      currentSemester: 7,
    },
    {
      studentId: '12201407',
      registrationNo: 'REG2024007',
      firstName: 'Rohan',
      lastName: 'Mehta',
      email: 'rohan.mehta@sgt.edu',
      phone: '9876543216',
      gender: 'Male',
      currentSemester: 1,
    },
    {
      studentId: '12201408',
      registrationNo: 'REG2024008',
      firstName: 'Neha',
      lastName: 'Joshi',
      email: 'neha.joshi@sgt.edu',
      phone: '9876543217',
      gender: 'Female',
      currentSemester: 1,
    },
    {
      studentId: '12201409',
      registrationNo: 'REG2024009',
      firstName: 'Arjun',
      lastName: 'Reddy',
      email: 'arjun.reddy@sgt.edu',
      phone: '9876543218',
      gender: 'Male',
      currentSemester: 3,
    },
    {
      studentId: '12201410',
      registrationNo: 'REG2024010',
      firstName: 'Kavya',
      lastName: 'Nair',
      email: 'kavya.nair@sgt.edu',
      phone: '9876543219',
      gender: 'Female',
      currentSemester: 5,
    },
  ];

  const passwordHash = await bcrypt.hash('student123', 10);
  const createdStudents = [];

  console.log('\n🎓 Seeding 10 Students...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (const student of students) {
    try {
      // Check if student already exists
      const existing = await prisma.studentDetails.findUnique({
        where: { studentId: student.studentId },
      });

      if (existing) {
        console.log(`⏩ Student already exists: ${student.firstName} ${student.lastName} (${student.studentId})`);
        createdStudents.push(existing);
        continue;
      }

      // Create UserLogin first
      const userLogin = await prisma.userLogin.create({
        data: {
          uid: student.studentId,
          email: student.email,
          passwordHash: passwordHash,
          role: 'student',
          status: 'active',
        },
      });

      // Create StudentDetails
      const studentDetails = await prisma.studentDetails.create({
        data: {
          userLoginId: userLogin.id,
          studentId: student.studentId,
          registrationNo: student.registrationNo,
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email,
          phone: student.phone,
          gender: student.gender,
          currentSemester: student.currentSemester,
          displayName: `${student.firstName} ${student.lastName}`,
          dataEntryStatus: 'approved',
          isActive: true,
        },
      });

      createdStudents.push(studentDetails);
      console.log(`✅ Created: ${student.firstName} ${student.lastName} (${student.studentId})`);
    } catch (error) {
      console.error(`❌ Error creating ${student.studentId}:`, error.message);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🎉 Seeding complete! ${createdStudents.length} students ready.`);
  console.log('\n📋 Student Credentials (Password: student123)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('| Student ID | Name                | Email                    | Semester |');
  console.log('|------------|---------------------|--------------------------|----------|');
  
  for (const s of students) {
    const name = `${s.firstName} ${s.lastName}`.padEnd(19);
    const email = s.email.padEnd(24);
    console.log(`| ${s.studentId}   | ${name} | ${email} | ${s.currentSemester}        |`);
  }

  console.log('\n');

  return createdStudents;
}

seedStudents()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
