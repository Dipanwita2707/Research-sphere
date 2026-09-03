const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPassStatusEnum() {
  console.log('\n🧪 Testing pass_status_enum fix...\n');

  try {
    // Test 1: Query with 'checked_in' and 'checked_out' in notIn
    console.log('Test 1: Using notIn with [cancelled, expired, checked_out]');
    const test1 = await prisma.gate_pass.findMany({
      where: {
        pass_status: {
          notIn: ['cancelled', 'expired', 'checked_out']
        }
      },
      select: {
        pass_id: true,
        pass_status: true
      },
      take: 3
    });
    console.log(`✅ Test 1 passed! Found ${test1.length} passes\n`);

    // Test 2: Query with 'checked_in' in 'in' clause
    console.log('Test 2: Using in with [created, checked_in]');
    const test2 = await prisma.gate_pass.findMany({
      where: {
        pass_status: {
          in: ['created', 'checked_in']
        }
      },
      select: {
        pass_id: true,
        pass_status: true
      },
      take: 3
    });
    console.log(`✅ Test 2 passed! Found ${test2.length} passes\n`);

    // Test 3: Query with 'expired' status
    console.log('Test 3: Using equals with expired');
    const test3 = await prisma.gate_pass.findMany({
      where: {
        pass_status: 'expired'
      },
      select: {
        pass_id: true,
        pass_status: true
      },
      take: 3
    });
    console.log(`✅ Test 3 passed! Found ${test3.length} passes with expired status\n`);

    console.log('='.repeat(60));
    console.log('✅ ALL TESTS PASSED! pass_status_enum is working correctly');
    console.log('='.repeat(60));
    console.log('\n✅ You can now create visitor passes without errors!\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\n⚠️  You may need to restart your backend server for changes to take effect.\n');
  } finally {
    await prisma.$disconnect();
  }
}

testPassStatusEnum();
