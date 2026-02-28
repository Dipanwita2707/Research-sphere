const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCancelledPass() {
  try {
    console.log('\n🔍 Checking cancelled pass for Satyam...\n');

    const pass = await prisma.gate_pass.findFirst({
      where: {
        visitor_name: {
          contains: 'satyam',
          mode: 'insensitive'
        },
        pass_status: 'cancelled'
      },
      orderBy: {
        cancellation_time: 'desc'
      }
    });

    if (!pass) {
      console.log('❌ No cancelled pass found for Satyam');
      return;
    }

    console.log('✅ Found cancelled pass:\n');
    console.log('Pass ID:', pass.pass_id);
    console.log('Visitor Name:', pass.visitor_name);
    console.log('Mobile:', pass.mobile);
    console.log('Status:', pass.pass_status);
    console.log('Cancelled At:', pass.cancellation_time);
    console.log('\n📱 CHECKOUT QR CODE DATA:');
    
    if (pass.checkout_qr_code) {
      // Extract JSON data from QR code (it's a data URL)
      try {
        // The QR code is a Data URL, we need to decode it to see the actual data
        console.log('\n✅ Checkout QR exists!');
        console.log('QR Data URL Length:', pass.checkout_qr_code.length);
        console.log('Expires At:', pass.checkout_qr_expires_at);
        
        // Check if expired
        const now = new Date();
        const expiresAt = new Date(pass.checkout_qr_expires_at);
        const isExpired = now > expiresAt;
        const minutesRemaining = Math.floor((expiresAt - now) / (1000 * 60));
        
        console.log('\n⏰ VALIDITY:');
        console.log('Current Time:', now.toLocaleString());
        console.log('Expires At:', expiresAt.toLocaleString());
        console.log('Status:', isExpired ? '❌ EXPIRED' : '✅ VALID');
        console.log('Remaining Time:', isExpired ? 'Expired' : `${minutesRemaining} minutes`);
        
        // For guard to scan, they need to scan the QR code image
        // But we can show the verification code
        console.log('\n🔢 VERIFICATION CODE (for manual entry):');
        console.log('Code:', pass.verification_code || 'Not available');
        
        console.log('\n📝 INSTRUCTIONS FOR GUARD:');
        console.log('1. Guard can scan the checkout QR code sent to visitor\'s email/WhatsApp');
        console.log('2. OR Guard can enter verification code:', pass.verification_code);
        console.log('3. Verification Code is 6 digits that visitor can provide');
        
      } catch (err) {
        console.error('Error parsing QR code:', err);
      }
    } else {
      console.log('❌ No checkout QR code found!');
    }

    console.log('\n' + '='.repeat(60) + '\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCancelledPass();
