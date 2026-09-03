const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkGuardPermissions() {
  try {
    console.log('\n========================================');
    console.log('Checking GUARD001 Permissions & Details');
    console.log('========================================\n');

    // Get guard user with all details
    const guard = await prisma.userLogin.findUnique({
      where: { uid: 'GUARD001' },
      include: {
        employeeDetails: true,
        centralDeptPermissions: {
          include: {
            centralDept: true
          }
        }
      }
    });

    if (!guard) {
      console.log('❌ GUARD001 not found in database!');
      return;
    }

    console.log('📋 Basic Info:');
    console.log(`   UID: ${guard.uid}`);
    console.log(`   Email: ${guard.email}`);
    console.log(`   Role: ${guard.role}`);
    console.log(`   Status: ${guard.status}`);

    console.log('\n👤 Employee Details:');
    if (guard.employeeDetails) {
      console.log(`   Display Name: ${guard.employeeDetails.displayName || '❌ NOT SET'}`);
      console.log(`   First Name: ${guard.employeeDetails.firstName || 'N/A'}`);
      console.log(`   Last Name: ${guard.employeeDetails.lastName || 'N/A'}`);
      console.log(`   Emp ID: ${guard.employeeDetails.empId || 'N/A'}`);
    } else {
      console.log('   ❌ NO EMPLOYEE DETAILS FOUND!');
    }

    console.log('\n🎭 Assigned Role Templates (JSON):');
    if (guard.assignedRoleIds && Array.isArray(guard.assignedRoleIds) && guard.assignedRoleIds.length > 0) {
      console.log(`   ✅ Role IDs: ${guard.assignedRoleIds.join(', ')}`);
    } else {
      console.log('   ❌ NO ROLE TEMPLATES ASSIGNED! (assignedRoleIds is empty)');
    }

    console.log('\n🔐 Central Department Permissions:');
    if (guard.centralDeptPermissions.length > 0) {
      guard.centralDeptPermissions.forEach(perm => {
        console.log(`   📁 Department: ${perm.centralDept?.departmentName || 'Unknown'} (${perm.centralDept?.departmentType || 'N/A'})`);
        console.log(`      Permissions (${perm.permissions?.length || 0}):`);
        if (perm.permissions && Array.isArray(perm.permissions)) {
          perm.permissions.forEach(p => console.log(`         - ${p}`));
        }
        console.log('');
      });
    } else {
      console.log('   ❌ NO DEPARTMENT PERMISSIONS ASSIGNED!');
    }

    // Check gate passes created by admin that guard should see
    console.log('\n📋 Gate Passes in System:');
    const allPasses = await prisma.gate_pass.findMany({
      select: {
        pass_id: true,
        pass_status: true,
        created_by_id: true,
        user_login_gate_pass_created_by_idTouser_login: {
          select: { uid: true, email: true }
        }
      }
    });

    console.log(`   Total passes: ${allPasses.length}`);
    if (allPasses.length > 0) {
      allPasses.forEach(pass => {
        console.log(`   - ${pass.pass_id} | Status: ${pass.pass_status} | Created by: ${pass.user_login_gate_pass_created_by_idTouser_login.uid}`);
      });
    }

    console.log('\n========================================');
    console.log('⚠️  ISSUES FOUND:');
    console.log('========================================');
    
    const issues = [];
    if (!guard.employeeDetails) {
      issues.push('1. Employee details missing - Profile shows "Staff" instead of name');
    }
    if (!guard.centralDeptPermissions || guard.centralDeptPermissions.length === 0) {
      issues.push('2. Department permissions NOT assigned - Guard cannot access Gate Entry');
    }
    if (allPasses.length > 0 && guard.centralDeptPermissions.length === 0) {
      issues.push('3. Gate passes exist but guard has no permission to view them');
    }

    if (issues.length > 0) {
      issues.forEach(issue => console.log(`   ❌ ${issue}`));
      console.log('\n🔧 Need to run fix script!');
    } else {
      console.log('   ✅ Everything looks good!');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkGuardPermissions();
