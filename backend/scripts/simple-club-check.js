/**
 * Simple check - does club exist?
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkClub() {
  try {
    const clubs = await prisma.club.findMany({});
    
    console.log(`Found ${clubs.length} club(s) in database`);
    
    clubs.forEach(c => {
      console.log(`\n✅ Club: ${c.clubId}`);
      console.log(`   Name: ${c.name}`);
      console.log(`   Status: ${c.status}`);
      console.log(`   Noting ID: ${c.notingId || 'None'}`);
    });

    if (clubs.length === 0) {
      console.log('\n❌ No clubs found. Club creation failed.');
      console.log('\nTrying to create club now...');
      
      const noting = await prisma.note.findFirst({
        where: { notingId: 'DSW-CLB-2026-00001' },
      });

      if (noting && noting.status === 'approved') {
        const dswService = require('../src/modules/dsw/services/notingIntegrationService');
        const hodUser = await prisma.userLogin.findUnique({
          where: { email: 'hod@gmail.com' },
        });

        try {
          const club = await dswService.processApprovedClubCreationNoting(noting, hodUser.id);
          console.log('\n✅ Club created successfully!');
          console.log(`   Club ID: ${club.clubId}`);
          console.log(`   Name: ${club.name}`);
        } catch (error) {
          console.log(`\n❌ Error: ${error.message}`);
        }
      }
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    await prisma.$disconnect();
  }
}

checkClub();
