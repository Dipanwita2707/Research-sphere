const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabaseData() {
  try {
    console.log('\n🔍 Checking Database Data...\n');
    
    const userCount = await prisma.userLogin.count();
    const studentCount = await prisma.student_details.count();
    const employeeCount = await prisma.employee_details.count();
    const hostelCount = await prisma.hostel.count();
    const roomCount = await prisma.hostelRoom.count();
    
    console.log('📊 Database Status:');
    console.log(`   Users: ${userCount}`);
    console.log(`   Students: ${studentCount}`);
    console.log(`   Employees: ${employeeCount}`);
    console.log(`   Guest Houses: ${hostelCount}`);
    console.log(`   Rooms: ${roomCount}\n`);
    
    if (userCount === 0) {
      console.log('⚠️  NO USERS FOUND IN DATABASE!');
      console.log('📝 Need to run seed files to populate data.\n');
    } else {
      console.log('✅ Database has data. Fetching sample users...\n');
      
      const sampleUsers = await prisma.userLogin.findMany({
        take: 5,
        select: {
          username: true,
          roles: true,
          student_details: {
            select: { name: true }
          },
          employee_details: {
            select: { name: true }
          }
        }
      });
      
      console.log('Sample Users:');
      sampleUsers.forEach((user, i) => {
        const name = user.student_details?.name || user.employee_details?.name || 'N/A';
        const role = user.roles?.[0]?.role_code || 'No Role';
        console.log(`   ${i + 1}. ${user.username} - ${name} (${role})`);
      });
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseData();
