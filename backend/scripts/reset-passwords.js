/**
 * Reset passwords for HOD, Dean, and Mentor
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function resetPasswords() {
  try {
    console.log('🔧 Resetting passwords...\n');

    const users = [
      { email: 'hod@gmail.com', password: 'hod123', name: 'HOD' },
      { email: 'dean@gmail.com', password: 'dean123', name: 'Dean' },
      { email: 'mentor@gmail.com', password: 'mentor123', name: 'Mentor' },
    ];

    for (const user of users) {
      const existing = await prisma.userLogin.findUnique({
        where: { email: user.email },
        select: { id: true, uid: true, email: true },
      });

      if (!existing) {
        console.log(`❌ ${user.name} user not found: ${user.email}`);
        continue;
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(user.password, 12);

      // Update user
      await prisma.userLogin.update({
        where: { id: existing.id },
        data: { passwordHash: hashedPassword },
      });

      console.log(`✅ ${user.name} password reset successfully`);
      console.log(`   Email: ${existing.email}`);
      console.log(`   UID: ${existing.uid}`);
      console.log(`   New Password: ${user.password}`);
      console.log('');
    }

    console.log('🎉 All passwords reset successfully!\n');
    console.log('📋 Login Credentials:');
    console.log('   HOD: UID = HOD101, Password = hod123');
    console.log('   Dean: UID = DEAN101, Password = dean123');
    console.log('   Mentor: UID = MENTOR101, Password = mentor123');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

resetPasswords();
