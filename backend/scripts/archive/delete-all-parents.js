const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteAllParents() {
  try {
    console.log('\n🗑️  Deleting all parent records...\n');

    const result = await prisma.parentDetails.deleteMany({});

    console.log(`✅ Deleted ${result.count} parent records\n`);

  } catch (error) {
    console.error('❌ Error deleting parents:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllParents();
