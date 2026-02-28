/**
 * Create Student User for Gate Entry Testing
 * Run: node backend/create-student-user.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createStudentUser() {
  try {
    console.log('🔍 Checking for existing student user...\n');

    // Check if student already exists
    let student = await prisma.userLogin.findFirst({
      where: { uid: 'STU001' },
      include: {
        employeeDetails: true,
        centralDeptPermissions: {
          include: {
            centralDept: true
          }
        }
      }
    });

    if (student) {
      console.log('✅ Student user already exists:');
      console.log('═══════════════════════════════════════════');
      console.log(`   UID: ${student.uid}`);
      console.log(`   Email: ${student.email}`);
      console.log(`   Role: ${student.role}`);
      console.log(`   Display Name: ${student.employeeDetails?.displayName || 'Not Set'}`);
      console.log(`   Password: Test@123`);
      console.log('═══════════════════════════════════════════\n');
      
      if (student.centralDeptPermissions.length > 0) {
        console.log('✅ Gate Entry Permissions:');
        student.centralDeptPermissions.forEach(perm => {
          console.log(`   Department: ${perm.centralDept.name}`);
          console.log(`   Permissions: ${JSON.stringify(perm.permissions)}`);
        });
      } else {
        console.log('⚠️  No permissions assigned. Adding CREATE_PASS permission...');
        
        // Get Gate Entry department
        let gateEntryDept = await prisma.centralDepartment.findFirst({
          where: { departmentName: 'Gate Entry' }
        });
        
        if (!gateEntryDept) {
          gateEntryDept = await prisma.centralDepartment.create({
            data: {
              departmentCode: 'GATE-ENTRY',
              departmentName: 'Gate Entry',
              description: 'Gate Entry Pass Management'
            }
          });
          console.log('✅ Gate Entry department created');
        }
        
        // Assign CREATE_PASS permission
        await prisma.centralDepartmentPermission.create({
          data: {
            userId: student.id,
            centralDeptId: gateEntryDept.id,
            permissions: ['CREATE_PASS']
          }
        });
        
        console.log('✅ CREATE_PASS permission assigned');
      }
      
      console.log('\n📝 Ready to test! Login with:');
      console.log('   UID: STU001');
      console.log('   Password: Test@123\n');
      return;
    }

    console.log('➕ Creating new student user...\n');

    // Hash password
    const hashedPassword = await bcrypt.hash('Test@123', 10);

    // Create UserLogin
    student = await prisma.userLogin.create({
      data: {
        uid: 'STU001',
        email: 'student001@university.edu',
        password: hashedPassword,
        role: 'student',
        isActive: true,
        emailVerified: true
      }
    });

    console.log('✅ UserLogin created:', student.uid);

    // Create EmployeeDetails
    await prisma.employeeDetails.create({
      data: {
        userLoginId: student.id,
        displayName: 'Rahul Kumar (Student)',
        employeeId: 'STU001'
      }
    });

    console.log('✅ Employee details created');

    // Get Gate Entry department
    let gateEntryDept = await prisma.centralDepartment.findFirst({
      where: { departmentName: 'Gate Entry' }
    });

    if (!gateEntryDept) {
      console.log('⚠️  Gate Entry department not found. Creating...');
      gateEntryDept = await prisma.centralDepartment.create({
        data: {
          departmentCode: 'GATE-ENTRY',
          departmentName: 'Gate Entry',
          description: 'Gate Entry and Pass Management System'
        }
      });
      console.log('✅ Gate Entry department created');
    }

    // Assign Student permissions (CREATE_PASS only)
    await prisma.centralDepartmentPermission.create({
      data: {
        userId: student.id,
        centralDeptId: gateEntryDept.id,
        permissions: ['CREATE_PASS']
      }
    });

    console.log('✅ Permissions assigned: CREATE_PASS');

    console.log('\n═══════════════════════════════════════════');
    console.log('✅ STUDENT USER CREATED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════');
    console.log('📝 Login Credentials:');
    console.log('   UID: STU001');
    console.log('   Password: Test@123');
    console.log('   Role: student');
    console.log('   Name: Rahul Kumar (Student)');
    console.log('═══════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

createStudentUser();
