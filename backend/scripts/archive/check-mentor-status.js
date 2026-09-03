const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMentorStatus() {
  try {
    const mentor = await prisma.userLogin.findUnique({
      where: { email: 'mentor@gmail.com' },
      select: {
        id: true,
        uid: true,
        email: true,
        role: true,
        status: true
      }
    });
    
    console.log('👤 Mentor User Status Check:\n');
    console.log('   UUID:', mentor?.id);
    console.log('   UID:', mentor?.uid);
    console.log('   Email:', mentor?.email);
    console.log('   Role:', mentor?.role);
    console.log('   Status:', mentor?.status);
    console.log('');
    
    if (mentor?.status !== 'active') {
      console.log('❌ ISSUE FOUND: User status is NOT active!');
      console.log('   This will cause automatic logout when accessing protected pages.');
      console.log('   The protect middleware checks: if (user.status !== "active")');
      console.log('');
      console.log('🔧 Fixing user status...');
      
      await prisma.userLogin.update({
        where: { id: mentor.id },
        data: { status: 'active' }
      });
      
      console.log('✅ Status updated to "active"');
    } else {
      console.log('✅ Status is already "active" - no issue here');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkMentorStatus();
