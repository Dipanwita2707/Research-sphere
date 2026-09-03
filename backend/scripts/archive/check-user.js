const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
  try {
    const user = await prisma.userLogin.findUnique({
      where: { uid: '1234567' },
      select: { 
        uid: true, 
        email: true, 
        role: true, 
        status: true,
        passwordHash: true
      }
    });
    
    console.log('User 123456:', JSON.stringify(user, null, 2));
    
    if (user) {
      console.log('Password hash exists:', !!user.passwordHash);
      console.log('Status:', user.status);
      console.log('Role:', user.role);
    } else {
      console.log('User not found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();