/**
 * Manually trigger club creation from approved noting
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function manuallyCreateClub() {
  try {
    console.log('🔧 Manually creating club from approved noting...\n');

    // Get the noting
    const noting = await prisma.note.findFirst({
      where: {
        notingId: 'DSW-CLB-2026-00001',
      },
    });

    if (!noting) {
      console.log('❌ Noting not found');
      return;
    }

    console.log('📋 Noting:', noting.notingId);
    console.log('   Club Name:', noting.clubName);
    console.log('   Status:', noting.status);

    if (noting.status !== 'approved') {
      console.log('❌ Noting is not approved yet');
      return;
    }

    // Get the DSW noting integration service
    const dswNotingService = require('../src/modules/dsw/services/notingIntegrationService');
    
    console.log('\n🔄 Calling processApprovedClubCreationNoting...');
    
    // Use HOD as the approver
    const hodUser = await prisma.userLogin.findUnique({
      where: { email: 'hod@gmail.com' },
    });

    const club = await dswNotingService.processApprovedClubCreationNoting(noting, hodUser.id);
    
    console.log('✅ Club created successfully!');
    console.log('   Club ID:', club.clubId);
    console.log('   Name:', club.name);
    console.log('   Status:', club.status);

  } catch (error) {
    console.error('❌ Error during club creation:', error.message);
    console.error('\nFull error:');
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

manuallyCreateClub();
