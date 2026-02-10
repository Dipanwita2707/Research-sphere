const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkClub() {
  try {
    const uuid = '47a251b9-d24d-470e-b2d1-fc4cc8ece869';
    
    console.log('🔍 Searching for club with UUID:', uuid);
    
    const club = await prisma.club.findUnique({
      where: { id: uuid },
      include: {
        category: true,
        facultyFacilitator: true,
        viceChairperson: true
      }
    });
    
    if (!club) {
      console.log('\n❌ No club found with this UUID');
      
      // Check all clubs
      const allClubs = await prisma.club.findMany({
        select: {
          id: true,
          clubId: true,
          name: true
        }
      });
      
      console.log('\n📋 All clubs in database:');
      allClubs.forEach(c => {
        console.log(`   UUID: ${c.id}`);
        console.log(`   Club ID: ${c.clubId}`);
        console.log(`   Name: ${c.name}`);
        console.log('');
      });
    } else {
      console.log('\n✅ Club found:');
      console.log('   UUID:', club.id);
      console.log('   Club ID:', club.clubId);
      console.log('   Name:', club.name);
      console.log('   Status:', club.status);
      console.log('   Faculty:', club.facultyFacilitator?.email);
      console.log('   Vice Chair:', club.viceChairperson?.email);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkClub();
