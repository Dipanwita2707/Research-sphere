const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixGuardIssues() {
  try {
    console.log('\n========================================');
    console.log('Fixing GUARD001 & FAC001 Issues');
    console.log('========================================\n');

    // Issue 1: Add Employee Details for GUARD001
    console.log('📝 Fix 1: Adding Employee Details for GUARD001...');
    
    // Get UserLogin ID first
    const guardUser = await prisma.userLogin.findUnique({ where: { uid: 'GUARD001' } });
    if (!guardUser) {
      console.log('   ❌ GUARD001 user not found!');
      await prisma.$disconnect();
      return;
    }

    const guardEmployee = await prisma.employeeDetails.upsert({
      where: { empId: 'GUARD001' },
      update: {
        displayName: 'Security Guard',
        firstName: 'Security',
        lastName: 'Guard',
        designation: 'Security Guard',
        phoneNumber: '9876543210'
      },
      create: {
        userLoginId: guardUser.id,
        displayName: 'Security Guard',
        firstName: 'Security',
        lastName: 'Guard',
        empId: 'GUARD001',
        designation: 'Security Guard',
        phoneNumber: '9876543210',
        email: 'guard@sgt.edu'
      }
    });
    console.log(`   ✅ Employee details created/updated for GUARD001`);
    console.log(`      Display Name: ${guardEmployee.displayName}\n`);

    // Also fix FAC001
    console.log('📝 Fix 1b: Adding Employee Details for FAC001...');
    
    const facUser = await prisma.userLogin.findUnique({ where: { uid: 'FAC001' } });
    if (!facUser) {
      console.log('   ❌ FAC001 user not found!');
    } else {
      const facEmployee = await prisma.employeeDetails.upsert({
        where: { empId: 'FAC001' },
        update: {
          displayName: 'Test Faculty',
          firstName: 'Test',
          lastName: 'Faculty',
          designation: 'Assistant Professor',
          phoneNumber: '9876543211'
        },
        create: {
          userLoginId: facUser.id,
          displayName: 'Test Faculty',
          firstName: 'Test',
          lastName: 'Faculty',
          empId: 'FAC001',
          designation: 'Assistant Professor',
          phoneNumber: '9876543211',
          email: 'faculty@sgt.edu'
        }
      });
      console.log(`   ✅ Employee details created/updated for FAC001`);
      console.log(`      Display Name: ${facEmployee.displayName}\n`);
    }

    // Issue 2: Assign Gate Entry Department Permissions
    console.log('📝 Fix 2: Finding or Creating Gate Entry Department...');
    
    // Check if Gate Entry department exists
    let gateEntryDept = await prisma.centralDepartment.findFirst({
      where: {
        OR: [
          { departmentName: { contains: 'Gate Entry', mode: 'insensitive' } },
          { departmentType: { equals: 'gateEntry', mode: 'insensitive' } }
        ]
      }
    });

    if (!gateEntryDept) {
      console.log('   Creating Gate Entry department...');
      gateEntryDept = await prisma.centralDepartment.create({
        data: {
          departmentName: 'Gate Entry',
          departmentType: 'gateEntry',
          departmentCode: 'GATE-01',
          description: 'Gate Entry and Visitor Pass Management',
          isActive: true,
          contactEmail: 'gateentry@sgt.edu'
        }
      });
      console.log(`   ✅ Gate Entry department created: ${gateEntryDept.departmentName}`);
    } else {
      console.log(`   ✅ Gate Entry department found: ${gateEntryDept.departmentName}`);
    }

    // Assign permissions to GUARD001
    console.log('\n📝 Fix 3: Assigning Gate Entry Permissions to GUARD001...');
    
    const guardPermissions = [
      'gate_entry.create',
      'gate_entry.view_all',
      'gate_entry.verify',
      'gate_entry.cancel'
    ];

    // Check if permission already exists
    const existingGuardPerm = await prisma.centralDepartmentPermission.findUnique({
      where: {
        userId_centralDeptId: {
          userId: guardUser.id,
          centralDeptId: gateEntryDept.id
        }
      }
    });

    if (existingGuardPerm) {
      // Update existing
      await prisma.centralDepartmentPermission.update({
        where: { id: existingGuardPerm.id },
        data: { permissions: guardPermissions }
      });
      console.log('   ✅ Updated existing permissions');
    } else {
      // Create new
      await prisma.centralDepartmentPermission.create({
        data: {
          userId: guardUser.id,
          centralDeptId: gateEntryDept.id,
          permissions: guardPermissions
        }
      });
      console.log('   ✅ Created new permission assignment');
    }

    console.log(`   Assigned ${guardPermissions.length} permissions:`);
    guardPermissions.forEach(p => console.log(`      - ${p}`));

    // Assign permissions to FAC001
    console.log('\n📝 Fix 4: Assigning Gate Entry Permissions to FAC001...');
    
    if (!facUser) {
      console.log('   ⚠️  Skipping FAC001 (user not found)');
    } else {
      const facultyPermissions = [
        'gate_entry.create',
        'gate_entry.view_own',
        'gate_entry.cancel',
        'gate_entry.extend'
      ];

      const existingFacPerm = await prisma.centralDepartmentPermission.findUnique({
        where: {
          userId_centralDeptId: {
            userId: facUser.id,
            centralDeptId: gateEntryDept.id
          }
        }
      });

      if (existingFacPerm) {
        await prisma.centralDepartmentPermission.update({
          where: { id: existingFacPerm.id },
          data: { permissions: facultyPermissions }
        });
        console.log('   ✅ Updated existing permissions');
      } else {
        await prisma.centralDepartmentPermission.create({
          data: {
            userId: facUser.id,
            centralDeptId: gateEntryDept.id,
            permissions: facultyPermissions
          }
        });
        console.log('   ✅ Created new permission assignment');
      }

      console.log(`   Assigned ${facultyPermissions.length} permissions:`);
      facultyPermissions.forEach(p => console.log(`      - ${p}`));
    }

    console.log('\n========================================');
    console.log('✅ ALL FIXES COMPLETED!');
    console.log('========================================\n');
    console.log('Now you can:');
    console.log('1. Logout and login again as GUARD001');
    console.log('2. Check profile - should show "Security Guard"');
    console.log('3. Go to Gate Entry page - should see all passes');
    console.log('4. QR Scan button should be visible');
    console.log('5. Count should show 3 passes (not 0)\n');

    await prisma.$disconnect();
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

fixGuardIssues();
