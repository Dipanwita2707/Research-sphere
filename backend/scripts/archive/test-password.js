const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPassword() {
  try {
    const user = await prisma.userLogin.findUnique({
      where: { uid: '1234567' },
      select: { 
        uid: true, 
        passwordHash: true
      }
    });
    
    if (!user) {
      console.log('User not found');
      return;
    }
    
    console.log('Testing password for user:', user.uid);
    
    // Test different possible passwords
    const passwords = ['1234567', 'password123', 'faculty123', 'student123'];
    
    for (const password of passwords) {
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      console.log(`Password "${password}": ${isMatch ? 'MATCH' : 'NO MATCH'}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testPassword();