const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Fix passes that are marked as expired but have future end dates
 * This script will:
 * 1. Find passes with status='expired' but visit_end_date or visit_date is in the future
 * 2. Revert their status back to 'created' or 'checked_in' based on actual_entry_time
 * 3. Update checkout_qr_expires_at to correct value (midnight after end date)
 */

async function fixWronglyExpiredPasses() {
  try {
    console.log('\n🔧 Fixing wrongly expired passes...\n');

    // Get today's date at midnight IST
    const today = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const todayIST = new Date(today.getTime() + istOffset);
    todayIST.setUTCHours(0, 0, 0, 0);

    console.log('📅 Today (IST):', todayIST.toISOString().split('T')[0]);
    console.log('');

    // Find all passes marked as expired
    const expiredPasses = await prisma.gate_pass.findMany({
      where: {
        OR: [
          { pass_status: 'expired' },
          { qr_status: 'expired' }
        ]
      },
      select: {
        id: true,
        pass_id: true,
        visit_date: true,
        visit_end_date: true,
        pass_status: true,
        qr_status: true,
        actual_entry_time: true,
        checkout_qr_expires_at: true
      }
    });

    console.log(`📊 Found ${expiredPasses.length} expired passes`);
    console.log('');

    // Filter passes that should NOT be expired (future dates)
    const passesToFix = expiredPasses.filter(pass => {
      const endDate = pass.visit_end_date || pass.visit_date;
      return endDate >= todayIST;
    });

    if (passesToFix.length === 0) {
      console.log('✅ No wrongly expired passes found. All good!');
      return;
    }

    console.log(`🔍 Found ${passesToFix.length} wrongly expired passes:\n`);

    // Fix each pass
    for (const pass of passesToFix) {
      const endDate = pass.visit_end_date || pass.visit_date;
      const endDateStr = new Date(endDate).toISOString().split('T')[0];
      
      console.log(`  📌 Pass ID: ${pass.pass_id}`);
      console.log(`     Visit Date: ${new Date(pass.visit_date).toISOString().split('T')[0]}`);
      if (pass.visit_end_date) {
        console.log(`     End Date: ${endDateStr} (extended)`);
      }
      console.log(`     Current Status: ${pass.pass_status} / QR: ${pass.qr_status}`);

      // Calculate correct checkout QR expiry (midnight of day AFTER end date)
      const checkoutQrExpiry = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
      
      // Determine correct pass status
      let newPassStatus = 'created';
      let newQrStatus = 'active';
      
      if (pass.actual_entry_time) {
        newPassStatus = 'checked_in';
      }

      // Update the pass
      await prisma.gate_pass.update({
        where: { id: pass.id },
        data: {
          pass_status: newPassStatus,
          qr_status: newQrStatus,
          status: newPassStatus === 'created' ? 'active' : 'checked_in', // Legacy field
          checkout_qr_expires_at: checkoutQrExpiry
        }
      });

      console.log(`     ✅ Fixed: Status → ${newPassStatus}, QR → ${newQrStatus}`);
      console.log(`     ✅ Checkout expires: ${checkoutQrExpiry.toISOString()}`);
      console.log('');
    }

    console.log(`\n✨ Successfully fixed ${passesToFix.length} passes!`);
    console.log('\n📋 Summary:');
    console.log(`   Total expired passes: ${expiredPasses.length}`);
    console.log(`   Wrongly expired (fixed): ${passesToFix.length}`);
    console.log(`   Actually expired (correct): ${expiredPasses.length - passesToFix.length}`);

  } catch (error) {
    console.error('❌ Error fixing passes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixWronglyExpiredPasses();
