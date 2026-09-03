/**
 * Verify HOD credentials and check password hash
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function verifyCredentials() {
  try {
    console.log('🔍 Checking HOD credentials in database...\n');

    // Get HOD user with all details
    const hod = await prisma.userLogin.findUnique({
      where: { email: 'hod@gmail.com' },
      select: {
        id: true,
        email: true,
        uid: true,
        passwordHash: true,
        role: true,
        employeeDetails: {
          select: {
            displayName: true,
            empId: true,
          },
        },
      },
    });

    if (!hod) {
      console.log('❌ HOD user not found with email: hod@gmail.com');
      
      // Search by UID
      const hodByUid = await prisma.userLogin.findUnique({
        where: { uid: 'HOD101' },
      });
      
      if (hodByUid) {
        console.log('✅ Found user with UID HOD101');
        console.log('   Email:', hodByUid.email);
      }
      return;
    }

    console.log('✅ HOD user found:');
    console.log('   Email:', hod.email);
    console.log('   UID:', hod.uid);
    console.log('   Role:', hod.role);
    console.log('   Display Name:', hod.employeeDetails?.displayName);
    console.log('   Password hash:', hod.passwordHash ? hod.passwordHash.substring(0, 20) + '...' : 'NULL');

    // Test password
    console.log('\n🔐 Testing passwords:');
    
    const passwords = ['hod123', 'HOD123', 'hod@123'];
    
    for (const pwd of passwords) {
      const isValid = await bcrypt.compare(pwd, hod.passwordHash);
      console.log(`   "${pwd}": ${isValid ? '✅ VALID' : '❌ Invalid'}`);
    }

    // Check if UID is unique
    console.log('\n🔍 Checking UID uniqueness:');
    const usersWithSameUid = await prisma.userLogin.findMany({
      where: { uid: hod.uid },
      select: { id: true, email: true, uid: true },
    });
    
    console.log(`   Found ${usersWithSameUid.length} user(s) with UID "${hod.uid}"`);
    if (usersWithSameUid.length > 1) {
      console.log('   ⚠️ WARNING: Multiple users have the same UID!');
      usersWithSameUid.forEach(u => {
        console.log(`      - ${u.email} (${u.id})`);
      });
    }

    // Get all faculty users for reference
    console.log('\n📊 All users with role "faculty":');
    const faculty = await prisma.userLogin.findMany({
      where: { role: 'faculty' },
      select: {
        email: true,
        uid: true,
        employeeDetails: {
          select: {
            displayName: true,
            empId: true,
          },
        },
      },
      take: 20,
    });

    faculty.forEach(f => {
      console.log(`   - Email: ${f.email}`);
      console.log(`     UID: ${f.uid || 'NULL'}`);
      console.log(`     Name: ${f.employeeDetails?.displayName || 'Not set'}`);
      console.log('');
    });

    console.log('\n💡 Try logging in with:');
    console.log(`   Login ID: ${hod.uid || hod.email}`);
    console.log('   Password: hod123');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyCredentials();
