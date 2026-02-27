const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updatePassStatus() {
  try {
    // Update all pending passes back to active
    const result = await prisma.gatePass.updateMany({
      where: {
        status: 'pending'
      },
      data: {
        status: 'active'
      }
    });

    console.log(`✅ Updated ${result.count} passes from 'pending' to 'active'`);
  } catch (error) {
    console.error('❌ Error updating passes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updatePassStatus();
