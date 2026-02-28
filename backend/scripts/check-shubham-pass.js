const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkShubhamPass() {
  try {
    console.log('🔍 Checking Shubham\'s pass...\n');
    
    const pass = await prisma.gate_pass.findFirst({
      where: {
        visitor_name: {
          contains: 'shubham',
          mode: 'insensitive'
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    if (!pass) {
      console.log('❌ No pass found for Shubham');
      return;
    }

    console.log('✅ Found Shubham\'s pass!');
    console.log('\n=== PASS DETAILS ===');
    console.log('Pass ID:', pass.pass_id);
    console.log('Visitor:', pass.visitor_name);
    console.log('Status:', pass.pass_status);
    console.log('Mobile:', pass.mobile_number);
    
    if (pass.pass_status === 'cancelled') {
      console.log('\n=== CHECKOUT CREDENTIALS ===');
      console.log('✅ Checkout ID:', pass.checkout_unique_id);
      console.log('✅ Checkout Code:', pass.checkout_verification_code);
      console.log('⏰ Expires At:', pass.checkout_qr_expires_at);
      
      if (pass.checkout_qr_expires_at) {
        const now = new Date();
        const expiry = new Date(pass.checkout_qr_expires_at);
        const diffMs = expiry - now;
        const minutes = Math.floor(diffMs / 60000);
        const seconds = Math.floor((diffMs % 60000) / 1000);
        console.log(`⏱️  Remaining: ${minutes} min ${seconds} sec`);
      }
    } else {
      console.log('\n⚠️  Pass not cancelled yet');
      console.log('Current status:', pass.pass_status);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkShubhamPass();
