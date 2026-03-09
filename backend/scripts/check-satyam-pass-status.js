const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPass() {
  try {
    const pass = await prisma.gate_pass.findFirst({
      where: {
        visitor_name: {
          contains: 'satyam',
          mode: 'insensitive'
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    if (!pass) {
      console.log('❌ No pass found for Satyam');
      return;
    }

    console.log('\n=== PASS STATUS ===');
    console.log('Pass ID:', pass.pass_id);
    console.log('Status:', pass.pass_status);
    console.log('Created:', pass.created_at);
    console.log('Checked In:', pass.actual_entry_time);
    console.log('Cancelled:', pass.cancellation_time);
    console.log('\n=== CHECKOUT INFO ===');
    console.log('Checkout Unique ID:', pass.checkout_unique_id);
    console.log('Checkout Verification Code:', pass.checkout_verification_code);
    console.log('Checkout QR Code:', pass.checkout_qr_code ? 'EXISTS' : 'NULL');
    console.log('Checkout QR Expires At:', pass.checkout_qr_expires_at);
    
    if (pass.checkout_qr_expires_at) {
      const now = new Date();
      const expiryTime = new Date(pass.checkout_qr_expires_at);
      const diffMs = expiryTime - now;
      const diffMinutes = Math.floor(diffMs / 60000);
      const diffSeconds = Math.floor((diffMs % 60000) / 1000);
      
      console.log('\n=== TIME CALCULATION ===');
      console.log('Current Time:', now.toLocaleString('en-IN'));
      console.log('Expiry Time:', expiryTime.toLocaleString('en-IN'));
      console.log('Difference:', diffMinutes, 'min', diffSeconds, 'sec');
      console.log('Is Expired?', diffMs <= 0 ? '❌ YES' : '✅ NO');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPass();
