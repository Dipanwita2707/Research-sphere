const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

/**
 * Seed 40 Students for Testing
 * Password for all: Student@123
 */
async function seed40Students() {
  const students = [
    // CSE Students - Semester 1
    { studentId: '12201501', registrationNo: 'REG2024101', firstName: 'Aarav', lastName: 'Sharma', email: 'aarav.sharma@sgt.edu', phone: '9876543301', gender: 'Male', currentSemester: 1 },
    { studentId: '12201502', registrationNo: 'REG2024102', firstName: 'Ananya', lastName: 'Patel', email: 'ananya.patel@sgt.edu', phone: '9876543302', gender: 'Female', currentSemester: 1 },
    { studentId: '12201503', registrationNo: 'REG2024103', firstName: 'Vivaan', lastName: 'Kumar', email: 'vivaan.kumar@sgt.edu', phone: '9876543303', gender: 'Male', currentSemester: 1 },
    { studentId: '12201504', registrationNo: 'REG2024104', firstName: 'Aisha', lastName: 'Singh', email: 'aisha.singh@sgt.edu', phone: '9876543304', gender: 'Female', currentSemester: 1 },
    { studentId: '12201505', registrationNo: 'REG2024105', firstName: 'Arjun', lastName: 'Verma', email: 'arjun.verma@sgt.edu', phone: '9876543305', gender: 'Male', currentSemester: 1 },
    
    // CSE Students - Semester 3
    { studentId: '12201506', registrationNo: 'REG2024106', firstName: 'Diya', lastName: 'Gupta', email: 'diya.gupta@sgt.edu', phone: '9876543306', gender: 'Female', currentSemester: 3 },
    { studentId: '12201507', registrationNo: 'REG2024107', firstName: 'Reyansh', lastName: 'Mehta', email: 'reyansh.mehta@sgt.edu', phone: '9876543307', gender: 'Male', currentSemester: 3 },
    { studentId: '12201508', registrationNo: 'REG2024108', firstName: 'Saanvi', lastName: 'Reddy', email: 'saanvi.reddy@sgt.edu', phone: '9876543308', gender: 'Female', currentSemester: 3 },
    { studentId: '12201509', registrationNo: 'REG2024109', firstName: 'Advait', lastName: 'Joshi', email: 'advait.joshi@sgt.edu', phone: '9876543309', gender: 'Male', currentSemester: 3 },
    { studentId: '12201510', registrationNo: 'REG2024110', firstName: 'Aadhya', lastName: 'Nair', email: 'aadhya.nair@sgt.edu', phone: '9876543310', gender: 'Female', currentSemester: 3 },
    
    // CSE Students - Semester 5
    { studentId: '12201511', registrationNo: 'REG2024111', firstName: 'Vihaan', lastName: 'Desai', email: 'vihaan.desai@sgt.edu', phone: '9876543311', gender: 'Male', currentSemester: 5 },
    { studentId: '12201512', registrationNo: 'REG2024112', firstName: 'Kiara', lastName: 'Iyer', email: 'kiara.iyer@sgt.edu', phone: '9876543312', gender: 'Female', currentSemester: 5 },
    { studentId: '12201513', registrationNo: 'REG2024113', firstName: 'Aditya', lastName: 'Bose', email: 'aditya.bose@sgt.edu', phone: '9876543313', gender: 'Male', currentSemester: 5 },
    { studentId: '12201514', registrationNo: 'REG2024114', firstName: 'Myra', lastName: 'Kapoor', email: 'myra.kapoor@sgt.edu', phone: '9876543314', gender: 'Female', currentSemester: 5 },
    { studentId: '12201515', registrationNo: 'REG2024115', firstName: 'Shaurya', lastName: 'Agarwal', email: 'shaurya.agarwal@sgt.edu', phone: '9876543315', gender: 'Male', currentSemester: 5 },
    
    // CSE Students - Semester 7
    { studentId: '12201516', registrationNo: 'REG2024116', firstName: 'Navya', lastName: 'Bansal', email: 'navya.bansal@sgt.edu', phone: '9876543316', gender: 'Female', currentSemester: 7 },
    { studentId: '12201517', registrationNo: 'REG2024117', firstName: 'Ayaan', lastName: 'Malhotra', email: 'ayaan.malhotra@sgt.edu', phone: '9876543317', gender: 'Male', currentSemester: 7 },
    { studentId: '12201518', registrationNo: 'REG2024118', firstName: 'Pari', lastName: 'Sinha', email: 'pari.sinha@sgt.edu', phone: '9876543318', gender: 'Female', currentSemester: 7 },
    { studentId: '12201519', registrationNo: 'REG2024119', firstName: 'Kabir', lastName: 'Chopra', email: 'kabir.chopra@sgt.edu', phone: '9876543319', gender: 'Male', currentSemester: 7 },
    { studentId: '12201520', registrationNo: 'REG2024120', firstName: 'Anvi', lastName: 'Tiwari', email: 'anvi.tiwari@sgt.edu', phone: '9876543320', gender: 'Female', currentSemester: 7 },
    
    // ECE Students - Semester 1
    { studentId: '12202501', registrationNo: 'REG2024201', firstName: 'Dhruv', lastName: 'Saxena', email: 'dhruv.saxena@sgt.edu', phone: '9876543321', gender: 'Male', currentSemester: 1 },
    { studentId: '12202502', registrationNo: 'REG2024202', firstName: 'Ira', lastName: 'Pandey', email: 'ira.pandey@sgt.edu', phone: '9876543322', gender: 'Female', currentSemester: 1 },
    { studentId: '12202503', registrationNo: 'REG2024203', firstName: 'Rudra', lastName: 'Bhatt', email: 'rudra.bhatt@sgt.edu', phone: '9876543323', gender: 'Male', currentSemester: 1 },
    { studentId: '12202504', registrationNo: 'REG2024204', firstName: 'Sara', lastName: 'Mishra', email: 'sara.mishra@sgt.edu', phone: '9876543324', gender: 'Female', currentSemester: 1 },
    { studentId: '12202505', registrationNo: 'REG2024205', firstName: 'Atharv', lastName: 'Rao', email: 'atharv.rao@sgt.edu', phone: '9876543325', gender: 'Male', currentSemester: 1 },
    
    // ECE Students - Semester 3
    { studentId: '12202506', registrationNo: 'REG2024206', firstName: 'Zara', lastName: 'Ghosh', email: 'zara.ghosh@sgt.edu', phone: '9876543326', gender: 'Female', currentSemester: 3 },
    { studentId: '12202507', registrationNo: 'REG2024207', firstName: 'Ishaan', lastName: 'Dubey', email: 'ishaan.dubey@sgt.edu', phone: '9876543327', gender: 'Male', currentSemester: 3 },
    { studentId: '12202508', registrationNo: 'REG2024208', firstName: 'Riya', lastName: 'Kulkarni', email: 'riya.kulkarni@sgt.edu', phone: '9876543328', gender: 'Female', currentSemester: 3 },
    { studentId: '12202509', registrationNo: 'REG2024209', firstName: 'Yash', lastName: 'Pillai', email: 'yash.pillai@sgt.edu', phone: '9876543329', gender: 'Male', currentSemester: 3 },
    { studentId: '12202510', registrationNo: 'REG2024210', firstName: 'Anaya', lastName: 'Menon', email: 'anaya.menon@sgt.edu', phone: '9876543330', gender: 'Female', currentSemester: 3 },
    
    // ECE Students - Semester 5
    { studentId: '12202511', registrationNo: 'REG2024211', firstName: 'Sai', lastName: 'Krishnan', email: 'sai.krishnan@sgt.edu', phone: '9876543331', gender: 'Male', currentSemester: 5 },
    { studentId: '12202512', registrationNo: 'REG2024212', firstName: 'Mishka', lastName: 'Chatterjee', email: 'mishka.chatterjee@sgt.edu', phone: '9876543332', gender: 'Female', currentSemester: 5 },
    { studentId: '12202513', registrationNo: 'REG2024213', firstName: 'Kian', lastName: 'Sen', email: 'kian.sen@sgt.edu', phone: '9876543333', gender: 'Male', currentSemester: 5 },
    { studentId: '12202514', registrationNo: 'REG2024214', firstName: 'Avni', lastName: 'Dutta', email: 'avni.dutta@sgt.edu', phone: '9876543334', gender: 'Female', currentSemester: 5 },
    { studentId: '12202515', registrationNo: 'REG2024215', firstName: 'Arnav', lastName: 'Roy', email: 'arnav.roy@sgt.edu', phone: '9876543335', gender: 'Male', currentSemester: 5 },
    
    // ECE Students - Semester 7
    { studentId: '12202516', registrationNo: 'REG2024216', firstName: 'Myra', lastName: 'Bhardwaj', email: 'myra.bhardwaj@sgt.edu', phone: '9876543336', gender: 'Female', currentSemester: 7 },
    { studentId: '12202517', registrationNo: 'REG2024217', firstName: 'Shivansh', lastName: 'Thakur', email: 'shivansh.thakur@sgt.edu', phone: '9876543337', gender: 'Male', currentSemester: 7 },
    { studentId: '12202518', registrationNo: 'REG2024218', firstName: 'Aarohi', lastName: 'Das', email: 'aarohi.das@sgt.edu', phone: '9876543338', gender: 'Female', currentSemester: 7 },
    { studentId: '12202519', registrationNo: 'REG2024219', firstName: 'Ved', lastName: 'Jain', email: 'ved.jain@sgt.edu', phone: '9876543339', gender: 'Male', currentSemester: 7 },
    { studentId: '12202520', registrationNo: 'REG2024220', firstName: 'Tara', lastName: 'Mukherjee', email: 'tara.mukherjee@sgt.edu', phone: '9876543340', gender: 'Female', currentSemester: 7 },
  ];

  const passwordHash = await bcrypt.hash('Student@123', 10);
  const createdStudents = [];

  console.log('\n🎓 Seeding 40 Students...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📌 Common Password: Student@123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

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
      console.log(`✅ Created: ${student.firstName} ${student.lastName} (${student.studentId}) - Sem ${student.currentSemester}`);
    } catch (error) {
      console.error(`❌ Error creating ${student.studentId}:`, error.message);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🎉 Seeding complete! ${createdStudents.length}/40 students created.`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('\n📋 STUDENT CREDENTIALS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔑 Password for ALL students: Student@123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('╔════════════╦════════════════════════╦═══════════════════════════════╦═════╗');
  console.log('║ Student ID ║ Name                   ║ Email                         ║ Sem ║');
  console.log('╠════════════╬════════════════════════╬═══════════════════════════════╬═════╣');
  
  for (const s of students) {
    const name = `${s.firstName} ${s.lastName}`.padEnd(22);
    const email = s.email.padEnd(29);
    console.log(`║ ${s.studentId}   ║ ${name} ║ ${email} ║  ${s.currentSemester}  ║`);
  }
  
  console.log('╚════════════╩════════════════════════╩═══════════════════════════════╩═════╝\n');

  // Summary by semester
  const semesterCounts = {};
  students.forEach(s => {
    semesterCounts[s.currentSemester] = (semesterCounts[s.currentSemester] || 0) + 1;
  });

  console.log('📊 Distribution by Semester:');
  Object.entries(semesterCounts).sort().forEach(([sem, count]) => {
    console.log(`   Semester ${sem}: ${count} students`);
  });

  console.log('\n💡 Login Instructions:');
  console.log('   1. Navigate to the login page');
  console.log('   2. Enter Student ID (e.g., 12201501)');
  console.log('   3. Enter Password: Student@123');
  console.log('   4. Click Login\n');

  return createdStudents;
}

// Run the seeding
seed40Students()
  .then(() => {
    console.log('✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
