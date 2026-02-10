const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkHODRole() {
  try {
    const hod = await prisma.userLogin.findUnique({
      where: { uid: 'HOD101' },
      select: {
        id: true,
        uid: true,
        email: true,
        role: true,
        status: true
      }
    });
    
    console.log('👤 HOD User:');
    console.log('   UID:', hod?.uid);
    console.log('   Email:', hod?.email);
    console.log('   Role:', hod?.role);
    console.log('   Status:', hod?.status);
    console.log('');
    
    const allowedRoles = ['student', 'faculty', 'staff', 'admin', 'superadmin'];
    const isAllowed = allowedRoles.includes(hod?.role);
    
    console.log('📋 DSW VIEW_CLUB Permission Check:');
    console.log('   Allowed roles:', allowedRoles.join(', '));
    console.log('   HOD role:', hod?.role);
    console.log('   Is allowed?', isAllowed ? '✅ YES' : '❌ NO');
    console.log('');
    
    if (!isAllowed) {
      console.log('🔴 PROBLEM FOUND!');
      console.log('   HOD role is NOT in the allowed list for VIEW_CLUB permission');
      console.log('   This causes 403 Forbidden error on DSW pages');
      console.log('');
      console.log('🔧 SOLUTION: Change HOD role to "faculty" or "staff"');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkHODRole();
