const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function showVerificationCodes() {
  console.log('\n📋 Verification Codes for All Passes:\n');
  console.log('='.repeat(90));

  try {
    const passes = await prisma.gate_pass.findMany({
      orderBy: {
        created_at: 'desc'
      },
      take: 10,
      select: {
        pass_id: true,
        visitor_name: true,
        pass_status: true,
        verification_code: true,
        checkout_verification_code: true,
        actual_entry_time: true,
        cancellation_time: true
      }
    });

    if (passes.length === 0) {
      console.log('No passes found.');
      return;
    }

    passes.forEach((pass, index) => {
      console.log(`\n${index + 1}. Pass ID: ${pass.pass_id}`);
      console.log(`   Visitor: ${pass.visitor_name}`);
      console.log(`   Status: ${pass.pass_status}`);
      
      if (pass.verification_code) {
        console.log(`   ✅ Entry Code: ${pass.verification_code} (6-digit)`);
      } else {
        console.log(`   ❌ Entry Code: Not available`);
      }
      
      if (pass.checkout_verification_code) {
        console.log(`   🚪 Checkout Code: ${pass.checkout_verification_code} (6-digit)`);
      } else {
        console.log(`   ❌ Checkout Code: Not available`);
      }
      
      if (pass.actual_entry_time) {
        console.log(`   📥 Checked in: ${pass.actual_entry_time}`);
      }
      
      if (pass.cancellation_time) {
        console.log(`   🚫 Cancelled: ${pass.cancellation_time}`);
      }
    });

    console.log('\n' + '='.repeat(90));
    console.log('\n✅ Codes displayed successfully!');
    console.log('\n📝 Note:');
    console.log('   - Entry Code: Used when visitor first enters (during check-in)');
    console.log('   - Checkout Code: Generated when pass is cancelled after check-in');
    console.log('   - Both codes are now visible in the All Passes table view\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

showVerificationCodes();
