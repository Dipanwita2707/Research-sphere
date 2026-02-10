const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testStatisticsQuery() {
  try {
    console.log('📊 Testing Statistics Query (same as DSW dashboard)...\n');
    
    // Simulate what the statistics endpoint does
    const [totalClubs, activeClubs, totalCategories, pendingApprovals] = await Promise.all([
      prisma.club.count(),
      prisma.club.count({ where: { status: 'active' } }),
      prisma.clubCategory.count(),
      prisma.note.count({
        where: {
          category: 'administrative',
          subcategory: 'dsw_club_creation',
          status: 'pending'
        }
      })
    ]);
    
    console.log('✅ Statistics Retrieved Successfully:');
    console.log('   Total Clubs:', totalClubs);
    console.log('   Active Clubs:', activeClubs);
    console.log('   Total Categories:', totalCategories);
    console.log('   Pending Approvals:', pendingApprovals);
    console.log('');
    console.log('🎯 If you see this, the statistics query works fine!');
    console.log('   The DSW dashboard should load without issues.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('');
    console.error('🔴 This error would cause DSW dashboard to fail!');
  } finally {
    await prisma.$disconnect();
  }
}

testStatisticsQuery();
