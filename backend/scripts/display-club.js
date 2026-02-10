const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function displayClub() {
  try {
    console.log('🔍 Fetching club data...\n');
    
    const clubs = await prisma.club.findMany({
      include: {
        category: true,
        facultyFacilitator: true,
        viceChairperson: true
      }
    });
    
    if (clubs.length === 0) {
      console.log('❌ No clubs found');
      return;
    }
    
    clubs.forEach(club => {
      console.log('✅ CLUB CREATED SUCCESSFULLY!\n');
      console.log('═══════════════════════════════════════');
      console.log('📋 Club ID:', club.clubId);
      console.log('🏷️  Name:', club.name);
      console.log('📁 Category:', club.category?.name || 'N/A');
      console.log('📝 Purpose:', club.purpose);
      console.log('📊 Status:', club.status);
      console.log('🗓️  Created:', club.createdAt.toLocaleString());
      console.log('\n👤 Faculty Facilitator:');
      console.log('   Name:', club.facultyFacilitator?.fullName || 'N/A');
      console.log('   Email:', club.facultyFacilitator?.email || 'N/A');
      console.log('\n👥 Vice Chairperson:');
      console.log('   Name:', club.viceChairperson?.fullName || 'N/A');
      console.log('   Email:', club.viceChairperson?.email || 'N/A');
      console.log('   Role:', club.viceChairperson?.role || 'N/A');
      console.log('═══════════════════════════════════════\n');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

displayClub();
