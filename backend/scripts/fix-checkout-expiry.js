const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPassExpiry() {
  try {
    console.log('🔧 Fixing checkout expiry time for Satyam\'s pass...\n');

    // Reset the pass to cancelled status (not checked_out) and add expiry time
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    
    const updatedPass = await prisma.gate_pass.update({
      where: {
        pass_id: 'UNI-PASS-20260219-001'
      },
      data: {
        pass_status: 'cancelled',
        status: 'cancelled',
        qr_status: 'cancelled',
        actual_exit_time: null, // Reset exit time
        checkout_qr_expires_at: expiresAt
      }
    });

    console.log('✅ Pass fixed!');
    console.log('Pass ID:', updatedPass.pass_id);
    console.log('Status:', updatedPass.pass_status);
    console.log('Checkout ID:', updatedPass.checkout_unique_id);
    console.log('Checkout Code:', updatedPass.checkout_verification_code);
    console.log('Expires At:', updatedPass.checkout_qr_expires_at);
    
    const diffMs = expiresAt - Date.now();
    const diffMin = Math.floor(diffMs / 60000);
    const diffSec = Math.floor((diffMs % 60000) / 1000);
    console.log(`\n⏰ Remaining: ${diffMin} min ${diffSec} sec`);
    
    console.log('\n📝 Now search for "satyam" on the verify page!');
    console.log('✅ The countdown timer should show:', diffMin, 'min', diffSec, 'sec');
    console.log('✅ The "Record Checkout" button should be visible');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixPassExpiry();
