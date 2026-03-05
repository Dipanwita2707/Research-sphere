const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupDuplicates() {
  try {
    console.log('\n🔍 Checking for duplicate parent records...\n');

    const parents = await prisma.parentDetails.findMany({
      orderBy: [
        { studentId: 'asc' },
        { relationship: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    console.log(`📊 Total parent records found: ${parents.length}\n`);

    // Group by studentId + relationship + email
    const groups = {};
    parents.forEach(parent => {
      const key = `${parent.studentId}-${parent.relationship}-${parent.email}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(parent);
    });

    // Find duplicates (groups with more than 1 record)
    const duplicates = Object.values(groups).filter(group => group.length > 1);
    
    console.log(`🔎 Found ${duplicates.length} duplicate groups\n`);

    let deletedCount = 0;

    for (const group of duplicates) {
      // Keep the first record (oldest), delete the rest
      const toKeep = group[0];
      const toDelete = group.slice(1);

      console.log(`📌 Duplicate found for: ${toKeep.firstName} ${toKeep.lastName} (${toKeep.relationship})`);
      console.log(`   Student ID: ${toKeep.studentId}`);
      console.log(`   Keeping record: ${toKeep.id} (created: ${toKeep.createdAt})`);
      console.log(`   Deleting ${toDelete.length} duplicate(s):\n`);

      for (const dup of toDelete) {
        console.log(`   ❌ Deleting: ${dup.id} (created: ${dup.createdAt})`);
        await prisma.parentDetails.delete({
          where: { id: dup.id }
        });
        deletedCount++;
      }
      console.log('');
    }

    console.log('='.repeat(80));
    console.log(`✅ Cleanup complete!`);
    console.log(`   Deleted: ${deletedCount} duplicate records`);
    console.log(`   Remaining: ${parents.length - deletedCount} parent records`);
    console.log('='.repeat(80) + '\n');

    // Verify final count
    const finalCount = await prisma.parentDetails.count();
    console.log(`📊 Final verification: ${finalCount} parent records in database\n`);

  } catch (error) {
    console.error('❌ Error cleaning up duplicates:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDuplicates();
