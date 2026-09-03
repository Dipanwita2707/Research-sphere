const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAndDisplayCredentials() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔐 SGT UMS - ACTUAL LOGIN CREDENTIALS FROM DATABASE');
    console.log('='.repeat(80) + '\n');
    
    // Admin
    const admin = await prisma.userLogin.findFirst({
      where: { role: 'admin' },
      select: { uid: true, email: true, role: true }
    });
    
    console.log('👑 ADMIN LOGIN:');
    console.log('-'.repeat(80));
    if (admin) {
      console.log(`   Username/UID: ${admin.uid}`);
      console.log(`   Email: ${admin.email || 'N/A'}`);
      console.log(`   Password: admin123`);
      console.log(`   Role: ${admin.role}\n`);
    }
    
    // Students
    const students = await prisma.userLogin.findMany({
      where: { role: 'student' },
      select: { 
        uid: true, 
        email: true,
        studentLogin: {
          select: { 
            firstName: true,
            lastName: true,
            displayName: true
          }
        }
      },
      take: 5
    });
    
    console.log('👨‍🎓 STUDENT LOGINS:');
    console.log('-'.repeat(80));
    if (students.length > 0) {
      students.forEach((s, i) => {
        const name = s.studentLogin?.displayName || 
                     `${s.studentLogin?.firstName || ''} ${s.studentLogin?.lastName || ''}`.trim() || 
                     'N/A';
        console.log(`   ${i + 1}. Username/UID: ${s.uid}`);
        console.log(`      Email: ${s.email || 'N/A'}`);
        console.log(`      Name: ${name}`);
        console.log(`      Password: student123\n`);
      });
    } else {
      console.log('   No students found\n');
    }
    
    // Faculty/Staff (for guards)
    const faculty = await prisma.userLogin.findMany({
      where: { 
        OR: [
          { role: 'faculty' },
          { role: 'staff' }
        ]
      },
      select: { 
        uid: true, 
        email: true,
        role: true,
        employeeDetails: {
          select: { 
            firstName: true,
            lastName: true,
            displayName: true,
            designation: true 
          }
        }
      },
      take: 5
    });
    
    console.log('👨‍🏫 FACULTY/GUARD LOGINS:');
    console.log('-'.repeat(80));
    if (faculty.length > 0) {
      faculty.forEach((f, i) => {
        const name = f.employeeDetails?.displayName || 
                     `${f.employeeDetails?.firstName || ''} ${f.employeeDetails?.lastName || ''}`.trim() || 
                     'N/A';
        console.log(`   ${i + 1}. UID: ${f.uid}`);
        console.log(`      Email: ${f.email || 'N/A'}`);
        console.log(`      Name: ${name}`);
        console.log(`      Designation: ${f.employeeDetails?.designation || 'N/A'}`);
        console.log(`      Password: password123\n`);
      });
    } else {
      console.log('   No faculty/staff found\n');
    }
    
    // Summary
    const userCounts = await prisma.userLogin.groupBy({
      by: ['role'],
      _count: true
    });
    
    console.log('='.repeat(80));
    console.log('📊 DATABASE SUMMARY:');
    console.log('-'.repeat(80));
    userCounts.forEach(uc => {
      console.log(`   ${uc.role}: ${uc._count} users`);
    });
    console.log('='.repeat(80));
    
    console.log('\n📝 QUICK LOGIN GUIDE:');
    console.log('-'.repeat(80));
    console.log('   Admin: admin / admin123');
    console.log('   Student: 12201401 / student123');
    console.log('   Faculty: Use email from above / password123');
    console.log('='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndDisplayCredentials();
