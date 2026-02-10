const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateStudents() {
  const updates = [
    { studentId: '12201401', registrationNo: 'REG2024001' },
    { studentId: '12201402', registrationNo: 'REG2024002' },
    { studentId: '12201403', registrationNo: 'REG2024003' },
    { studentId: '12201404', registrationNo: 'REG2024004' },
    { studentId: '12201405', registrationNo: 'REG2024005' },
    { studentId: '12201406', registrationNo: 'REG2024006' },
    { studentId: '12201407', registrationNo: 'REG2024007' },
    { studentId: '12201408', registrationNo: 'REG2024008' },
    { studentId: '12201409', registrationNo: 'REG2024009' },
    { studentId: '12201410', registrationNo: 'REG2024010' },
  ];

  console.log('Updating students with registration numbers...');

  for (const u of updates) {
    try {
      await prisma.studentDetails.update({
        where: { studentId: u.studentId },
        data: { registrationNo: u.registrationNo },
      });
      console.log(`✅ Updated ${u.studentId} -> ${u.registrationNo}`);
    } catch (e) {
      console.log(`⏩ Skipped ${u.studentId}: ${e.message}`);
    }
  }

  await prisma.$disconnect();
  console.log('Done!');
}

updateStudents();
