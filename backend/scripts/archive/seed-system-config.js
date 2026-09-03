const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedSystemConfig() {
  try {
    console.log('🌱 Seeding system configuration...');

    // Insert default hostel cancellation refund percentage
    const config = await prisma.systemConfig.upsert({
      where: { config_key: 'hostel_cancellation_refund_percent' },
      update: {},
      create: {
        config_key: 'hostel_cancellation_refund_percent',
        config_value: '90',
        config_type: 'PERCENTAGE',
        description: 'Refund percentage for before check-in hostel booking cancellation. Example: 90 means 90% refund, 10% cancellation fee.'
      }
    });

    console.log('✅ System config seeded successfully:', config.config_key, '=', config.config_value);
    console.log('📝 This means visitors will get', config.config_value + '% refund when cancelling before check-in');
    console.log('💰 Cancellation fee will be', (100 - parseFloat(config.config_value)) + '%');

  } catch (error) {
    console.error('❌ Error seeding system config:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedSystemConfig();
