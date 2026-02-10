const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testMyClubsQuery() {
  try {
    // Simulate mentor user
    const mentorUser = {
      id: '09db27f9-00ef-48ae-b695-94796234d2f6',
      uid: 'MENTOR101',
      email: 'mentor@gmail.com'
    };
    
    console.log('🔍 Testing "My Clubs" query for mentor...\n');
    
    // Simulate the exact query used in getClubs service
    const where = {
      OR: [
        { facultyFacilitatorId: mentorUser.id },
        { viceChairpersonId: mentorUser.id },
        {
          members: {
            some: {
              studentId: mentorUser.id,
              isActive: true,
            },
          },
        },
      ],
    };
    
    console.log('Query WHERE clause:', JSON.stringify(where, null, 2));
    console.log('');
    
    const clubs = await prisma.club.findMany({
      where,
      select: {
        id: true,
        clubId: true,
        name: true,
        status: true,
        facultyFacilitatorId: true
      }
    });
    
    console.log(`✅ Found ${clubs.length} club(s):`);
    clubs.forEach(club => {
      console.log('');
      console.log('   Club ID:', club.clubId);
      console.log('   Name:', club.name);
      console.log('   Status:', club.status);
      console.log('   Faculty ID:', club.facultyFacilitatorId);
      console.log('   Matches Mentor?', club.facultyFacilitatorId === mentorUser.id);
    });
    
    if (clubs.length === 0) {
      console.log('\n❌ No clubs found! This is the problem.');
      console.log('   The query should have found the club where mentorUser.id === facultyFacilitatorId');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testMyClubsQuery();
