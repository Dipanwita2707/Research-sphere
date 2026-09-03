const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const config = require('../src/shared/config/app.config');
const prisma = new PrismaClient();

async function checkMentorToken() {
  try {
    const mentor = await prisma.userLogin.findUnique({
      where: { uid: 'MENTOR101' },
      select: {
        id: true,
        uid: true,
        email: true,
        role: true,
        status: true
      }
    });
    
    if (!mentor) {
      console.log('❌ Mentor user not found!');
      return;
    }
    
    console.log('👤 Mentor User:');
    console.log('   UUID:', mentor.id);
    console.log('   UID:', mentor.uid);
    console.log('   Email:', mentor.email);
    console.log('   Role:', mentor.role);
    console.log('   Status:', mentor.status);
    console.log('');
    
    // Generate a fresh token
    const token = jwt.sign(
      { id: mentor.id, role: mentor.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expire }
    );
    
    console.log('🔑 Fresh JWT Token Generated:');
    console.log('   Token (first 50 chars):', token.substring(0, 50) + '...');
    console.log('   Expires in:', config.jwt.expire);
    console.log('');
    console.log('📋 Instructions:');
    console.log('   1. Open browser and go to localhost:3000/login');
    console.log('   2. Logout if logged in');
    console.log('   3. Login again with credentials:');
    console.log('      Username: MENTOR101');
    console.log('      Password: mentor123');
    console.log('   4. This will generate a fresh token');
    console.log('   5. Then navigate to /dsw dashboard');
    console.log('');
    console.log('✅ This will fix the 401 error!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkMentorToken();
