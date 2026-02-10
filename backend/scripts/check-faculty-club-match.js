const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkFacultyAndClub() {
  try {
    // Get mentor user
    const mentor = await prisma.userLogin.findUnique({
      where: { email: 'mentor@gmail.com' },
      select: {
        id: true,
        uid: true,
        email: true
      }
    });
    
    console.log('👤 Mentor User:');
    console.log('   UUID:', mentor?.id);
    console.log('   UID:', mentor?.uid);
    console.log('   Email:', mentor?.email);
    console.log('');
    
    // Get club
    const club = await prisma.club.findFirst({
      select: {
        id: true,
        clubId: true,
        name: true,
        facultyFacilitatorId: true,
        viceChairpersonId: true,
        facultyFacilitator: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });
    
    console.log('🏛️  Club:');
    console.log('   UUID:', club?.id);
    console.log('   Club ID:', club?.clubId);
    console.log('   Name:', club?.name);
    console.log('   Faculty Facilitator ID:', club?.facultyFacilitatorId);
    console.log('   Vice Chairperson ID:', club?.viceChairpersonId);
    console.log('');
    
    if (club?.facultyFacilitator) {
      console.log('   Faculty (from relation):');
      console.log('     UUID:', club.facultyFacilitator.id);
      console.log('     Email:', club.facultyFacilitator.email);
    }
    
    console.log('');
    console.log('✅ Match Check:');
    console.log('   Mentor UUID === Club Faculty ID?', mentor?.id === club?.facultyFacilitatorId);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkFacultyAndClub();
