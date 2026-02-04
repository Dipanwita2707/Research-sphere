require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function seedTestUsers() {
  try {
    // Hash for password "Test@123" - same for all test users
    const passwordHash = await bcrypt.hash('Test@123', 12);
    
    // Create test users for all roles with easy-to-remember credentials
    const testUsers = [
      {
        uid: 'SUPER001',
        email: 'superadmin@sgt.edu',
        role: 'superadmin',
        passwordHash: passwordHash,
        employeeDetails: {
          create: {
            empId: 'SUPER001',
            firstName: 'Super',
            lastName: 'Admin',
            designation: 'Super Administrator',
            email: 'superadmin@sgt.edu',
            phoneNumber: '9876543210'
          }
        }
      },
      {
        uid: 'ADMIN001',
        email: 'admin@sgt.edu',
        role: 'admin',
        passwordHash: passwordHash,
        employeeDetails: {
          create: {
            empId: 'ADMIN001',
            firstName: 'Admin',
            lastName: 'User',
            designation: 'Administrator',
            email: 'admin@sgt.edu',
            phoneNumber: '9876543211'
          }
        }
      },
      {
        uid: 'STU001',
        email: 'student@sgt.edu',
        role: 'student',
        passwordHash: passwordHash,
        employeeDetails: {
          create: {
            empId: 'STU001',
            firstName: 'John',
            lastName: 'Student',
            designation: 'Student',
            email: 'student@sgt.edu',
            phoneNumber: '9876543212'
          }
        }
      },
      {
        uid: 'FAC001',
        email: 'faculty@sgt.edu',
        role: 'faculty',
        passwordHash: passwordHash,
        employeeDetails: {
          create: {
            empId: 'FAC001',
            firstName: 'Jane',
            lastName: 'Faculty',
            designation: 'Assistant Professor',
            email: 'faculty@sgt.edu',
            phoneNumber: '9876543213'
          }
        }
      },
      {
        uid: 'STF001',
        email: 'staff@sgt.edu',
        role: 'staff',
        passwordHash: passwordHash,
        employeeDetails: {
          create: {
            empId: 'STF001',
            firstName: 'Mike',
            lastName: 'Staff',
            designation: 'Technical Assistant',
            email: 'staff@sgt.edu',
            phoneNumber: '9876543214'
          }
        }
      },
      {
        uid: 'PAR001',
        email: 'parent@sgt.edu',
        role: 'parent',
        passwordHash: passwordHash,
        employeeDetails: {
          create: {
            empId: 'PAR001',
            firstName: 'Sarah',
            lastName: 'Parent',
            designation: 'Parent',
            email: 'parent@sgt.edu',
            phoneNumber: '9876543215'
          }
        }
      }
    ];

    console.log('\n🔐 Creating test users with credentials...\n');

    for (const userData of testUsers) {
      // Check if user already exists
      const existingUser = await prisma.userLogin.findFirst({
        where: { uid: userData.uid }
      });

      if (!existingUser) {
        await prisma.userLogin.create({
          data: userData
        });
        console.log(`✅ Created: ${userData.role.toUpperCase().padEnd(12)} | UID: ${userData.uid.padEnd(10)} | Email: ${userData.email}`);
      } else {
        console.log(`⚠️  Exists: ${userData.role.toUpperCase().padEnd(12)} | UID: ${userData.uid.padEnd(10)} | Email: ${userData.email}`);
      }
    }

    console.log('\n🎉 Test users seeded successfully!\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                    LOGIN CREDENTIALS FOR TESTING              ');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('Password for ALL users: Test@123\n');
    console.log('Role          | UID        | Email');
    console.log('─────────────────────────────────────────────────────────────');
    console.log('SUPERADMIN    | SUPER001   | superadmin@sgt.edu');
    console.log('ADMIN         | ADMIN001   | admin@sgt.edu');
    console.log('STUDENT       | STU001     | student@sgt.edu');
    console.log('FACULTY       | FAC001     | faculty@sgt.edu');
    console.log('STAFF         | STF001     | staff@sgt.edu');
    console.log('PARENT        | PAR001     | parent@sgt.edu');
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error seeding test users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedTestUsers();