/**
 * Seed script to create test users for Gate Entry module
 * - Admin user (full access)
 * - Guard user (full access)
 * - Faculty user (limited access - create & view only)
 * - Student user (no access)
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Gate Entry test users...\n');

  // Password for all test users
  const testPassword = 'Test@123';
  const hashedPassword = await bcrypt.hash(testPassword, 12);

  const testUsers = [
    {
      username: 'admin_gate_test',
      email: 'admin.gate@test.com',
      password: hashedPassword,
      role: 'admin',
      employeeDetails: {
        firstName: 'Admin',
        lastName: 'Gate Test',
        displayName: 'Admin Gate Test',
        designation: 'System Administrator',
        email: 'admin.gate@test.com',
        phoneNumber: '+91-9876543210',
        empId: 'ADM001',
      }
    },
    {
      username: 'guard_gate_test',
      email: 'guard.gate@test.com',
      password: hashedPassword,
      role: 'staff',
      employeeDetails: {
        firstName: 'Security',
        lastName: 'Guard',
        displayName: 'Security Guard',
        designation: 'Security Guard',
        email: 'guard.gate@test.com',
        phoneNumber: '+91-9876543211',
        empId: 'GRD001',
      }
    },
    {
      username: 'faculty_gate_test',
      email: 'faculty.gate@test.com',
      password: hashedPassword,
      role: 'faculty',
      employeeDetails: {
        firstName: 'Faculty',
        lastName: 'Member',
        displayName: 'Faculty Member',
        designation: 'Assistant Professor',
        email: 'faculty.gate@test.com',
        phoneNumber: '+91-9876543212',
        empId: 'FAC001',
      }
    },
    {
      username: 'student_gate_test',
      email: 'student.gate@test.com',
      password: hashedPassword,
      role: 'student',
      employeeDetails: {
        firstName: 'Student',
        lastName: 'Test',
        displayName: 'Student Test',
        designation: 'Student',
        email: 'student.gate@test.com',
        phoneNumber: '+91-9876543213',
        empId: 'STU001',
      }
    },
  ];

  for (const userData of testUsers) {
    try {
      // Check if user already exists
      const existingUser = await prisma.userLogin.findUnique({
        where: { uid: userData.username }
      });

      if (existingUser) {
        console.log(`ℹ️  User '${userData.username}' already exists, skipping...`);
        continue;
      }

      // Create user with employee details
      const user = await prisma.userLogin.create({
        data: {
          uid: userData.username,
          email: userData.email,
          passwordHash: userData.password,
          status: 'active',
          role: userData.role,
          employeeDetails: {
            create: {
              firstName: userData.employeeDetails.firstName,
              lastName: userData.employeeDetails.lastName,
              displayName: userData.employeeDetails.displayName,
              designation: userData.employeeDetails.designation,
              email: userData.employeeDetails.email,
              phoneNumber: userData.employeeDetails.phoneNumber,
              empId: userData.employeeDetails.empId,
              isActive: true,
            }
          }
        },
        include: {
          employeeDetails: true
        }
      });

      console.log(`✅ Created ${userData.role} user: ${user.uid} (${user.employeeDetails.designation})`);
      
    } catch (error) {
      console.error(`❌ Error creating user ${userData.username}:`, error.message);
    }
  }

  console.log('\n✅ Test users seeded successfully!\n');
  console.log('📋 Login Credentials (all users have same password):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n1️⃣  ADMIN (Full Access - All Features)');
  console.log('   Username: admin_gate_test');
  console.log('   Password: Test@123');
  console.log('   Email: admin.gate@test.com');
  
  console.log('\n2️⃣  GUARD (Full Access - All Features)');
  console.log('   Username: guard_gate_test');
  console.log('   Password: Test@123');
  console.log('   Email: guard.gate@test.com');
  
  console.log('\n3️⃣  FACULTY (Limited Access - Create & View Only)');
  console.log('   Username: faculty_gate_test');
  console.log('   Password: Test@123');
  console.log('   Email: faculty.gate@test.com');
  
  console.log('\n4️⃣  STUDENT (No Access - Module Hidden)');
  console.log('   Username: student_gate_test');
  console.log('   Password: Test@123');
  console.log('   Email: student.gate@test.com');
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding test users:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
