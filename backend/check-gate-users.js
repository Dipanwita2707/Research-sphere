const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.userLogin.findMany({
      where: {
        OR: [
          { email: 'guard@sgt.edu' },
          { email: 'staff@sgt.edu' },
          { email: 'faculty@sgt.edu' }
        ]
      },
      select: {
        uid: true,
        email: true,
        role: true,
        passwordHash: true,
        employeeDetails: {
          select: {
            displayName: true,
            empId: true
          }
        }
      }
    });

    console.log('\n========================================');
    console.log('Gate Entry Test Users in Database');
    console.log('========================================\n');

    if (users.length === 0) {
      console.log('❌ No users found with these emails!');
      console.log('\nSearching for ANY staff/faculty users...\n');
      
      const anyUsers = await prisma.userLogin.findMany({
        where: {
          OR: [
            { role: 'staff' },
            { role: 'faculty' }
          ]
        },
        take: 5,
        select: {
          uid: true,
          email: true,
          role: true,
          passwordHash: true,
          employeeDetails: {
            select: {
              displayName: true,
              empId: true
            }
          }
        }
      });

      console.log(`Found ${anyUsers.length} staff/faculty users:\n`);
      anyUsers.forEach(u => {
        console.log(`[${u.role.toUpperCase()}] ${u.email}`);
        console.log(`  UID: ${u.uid}`);
        console.log(`  Name: ${u.employeeDetails?.displayName || 'N/A'}`);
        console.log(`  Password: ${u.passwordHash ? 'Set (hashed)' : 'NOT SET'}`);
        console.log('');
      });
    } else {
      users.forEach(u => {
        console.log(`✅ ${u.email.toUpperCase()}`);
        console.log(`   UID: ${u.uid}`);
        console.log(`   Role: ${u.role}`);
        console.log(`   Name: ${u.employeeDetails?.displayName || 'N/A'}`);
        console.log(`   Emp ID: ${u.employeeDetails?.empId || 'N/A'}`);
        console.log(`   Password: ${u.passwordHash ? 'Set (bcrypt hash)' : '❌ NOT SET'}`);
        console.log('');
      });

      console.log('\n========================================');
      console.log('🔐 Password Information');
      console.log('========================================\n');
      console.log('Passwords are bcrypt hashed in database.');
      console.log('You need to either:');
      console.log('1. Use password reset feature');
      console.log('2. Check password creation script');
      console.log('3. Set new password via SQL');
      console.log('\nDefault test passwords are usually: "password123"');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkUsers();
