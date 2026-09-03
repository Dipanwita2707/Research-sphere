const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getCredentials() {
  try {
    console.log('\n🔐 System Credentials:\n');
    console.log('=' .repeat(80));
    
    // Get student users
    const students = await prisma.userLogin.findMany({
      where: { 
        roles: { path: ['$[*].role_code'], array_contains: 'STUDENT' }
      },
      select: {
        username: true,
        roles: true,
        student_details: {
          select: {
            name: true,
            enrollment_number: true
          }
        }
      },
      take: 3
    });
    
    console.log('\n👨‍🎓 STUDENT CREDENTIALS:');
    console.log('-'.repeat(80));
    students.forEach((user, i) => {
      console.log(`\n${i + 1}. Username: ${user.username}`);
      console.log(`   Password: password123`);
      console.log(`   Name: ${user.student_details?.name || 'N/A'}`);
      console.log(`   Enrollment: ${user.student_details?.enrollment_number || 'N/A'}`);
    });
    
    // Get guard/security users
    const guards = await prisma.userLogin.findMany({
      where: { 
        OR: [
          { roles: { path: ['$[*].role_code'], array_contains: 'SECURITY_GUARD' } },
          { roles: { path: ['$[*].role_code'], array_contains: 'ENTRY_GUARD' } },
          { roles: { path: ['$[*].role_code'], array_contains: 'EXIT_GUARD' } }
        ]
      },
      select: {
        username: true,
        roles: true,
        employee_details: {
          select: {
            name: true
          }
        }
      },
      take: 3
    });
    
    console.log('\n\n👮 GUARD/SECURITY CREDENTIALS:');
    console.log('-'.repeat(80));
    if (guards.length > 0) {
      guards.forEach((user, i) => {
        const roleCode = user.roles?.[0]?.role_code || 'GUARD';
        console.log(`\n${i + 1}. Username: ${user.username}`);
        console.log(`   Password: password123`);
        console.log(`   Name: ${user.employee_details?.name || 'N/A'}`);
        console.log(`   Role: ${roleCode}`);
      });
    } else {
      console.log('\n   No guard users found. Using admin:');
    }
    
    // Get admin users
    const admins = await prisma.userLogin.findMany({
      where: { 
        OR: [
          { roles: { path: ['$[*].role_code'], array_contains: 'ADMIN' } },
          { roles: { path: ['$[*].role_code'], array_contains: 'SUPER_ADMIN' } }
        ]
      },
      select: {
        username: true,
        roles: true
      },
      take: 2
    });
    
    console.log('\n\n👑 ADMIN CREDENTIALS:');
    console.log('-'.repeat(80));
    admins.forEach((user, i) => {
      const roleCode = user.roles?.[0]?.role_code || 'ADMIN';
      console.log(`\n${i + 1}. Username: ${user.username}`);
      console.log(`   Password: password123`);
      console.log(`   Role: ${roleCode}`);
    });
    
    // Get faculty users
    const faculty = await prisma.userLogin.findMany({
      where: { 
        roles: { path: ['$[*].role_code'], array_contains: 'FACULTY' }
      },
      select: {
        username: true,
        roles: true,
        employee_details: {
          select: {
            name: true,
            designation: true
          }
        }
      },
      take: 3
    });
    
    console.log('\n\n👨‍🏫 FACULTY CREDENTIALS:');
    console.log('-'.repeat(80));
    faculty.forEach((user, i) => {
      console.log(`\n${i + 1}. Username: ${user.username}`);
      console.log(`   Password: password123`);
      console.log(`   Name: ${user.employee_details?.name || 'N/A'}`);
      console.log(`   Designation: ${user.employee_details?.designation || 'N/A'}`);
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('\n📝 Note: Default password for all users is "password123"\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

getCredentials();
