const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSatyamCheckout() {
  try {
    console.log('🔍 Checking Satyam\'s cancelled pass...\n');
    
    // Find Satyam's cancelled pass
    const pass = await prisma.gate_pass.findFirst({
      where: {
        visitor_name: { contains: 'Satyam', mode: 'insensitive' },
        pass_status: 'cancelled'
      },
      orderBy: {
        created_at: 'desc'
      }
    });
    
    if (!pass) {
      console.log('❌ No cancelled pass found for Satyam');
      console.log('💡 Make sure the pass is cancelled first!');
      return;
    }
    
    console.log('✅ Found Satyam\'s cancelled pass!\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 PASS DETAILS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Pass ID: ${pass.pass_id}`);
    console.log(`Visitor: ${pass.visitor_name}`);
    console.log(`Status: ${pass.pass_status}`);
    console.log(`Cancelled At: ${pass.cancellation_time ? new Date(pass.cancellation_time).toLocaleString() : 'N/A'}`);
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔐 CHECKOUT CREDENTIALS (Use these for checkout!)');
    console.log('═══════════════════════════════════════════════════════════');
    
    if (pass.checkout_unique_id) {
      console.log(`✅ Checkout ID: ${pass.checkout_unique_id}`);
    } else {
      console.log('❌ No Checkout ID found!');
    }
    
    if (pass.checkout_verification_code) {
      console.log(`✅ Checkout Verification Code: ${pass.checkout_verification_code}`);
      console.log('   ⬆️  USE THIS CODE FOR CHECKOUT! ⬆️');
    } else {
      console.log('❌ No Checkout Verification Code found!');
      console.log('⚠️  This pass was cancelled before the new system was implemented.');
      console.log('💡 You need to cancel the pass again to generate new checkout credentials.');
    }
    
    if (pass.checkout_qr_expires_at) {
      const expiryTime = new Date(pass.checkout_qr_expires_at);
      const now = new Date();
      const isExpired = now > expiryTime;
      
      console.log(`\n⏰ Checkout QR Expires: ${expiryTime.toLocaleString()}`);
      
      if (isExpired) {
        const expiredMinutes = Math.floor((now - expiryTime) / (1000 * 60));
        console.log(`❌ EXPIRED ${expiredMinutes} minutes ago!`);
        console.log('💡 QR code expired. You need to cancel the pass again to get new credentials.');
      } else {
        const remainingMinutes = Math.floor((expiryTime - now) / (1000 * 60));
        console.log(`✅ Still valid! ${remainingMinutes} minutes remaining`);
      }
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📝 HOW TO CHECKOUT:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('1. Go to: http://localhost:3000/admin/gate-entry/verify');
    console.log('2. Search for pass ID or visitor name "Satyam"');
    console.log('3. Click "Record Emergency Checkout" button');
    console.log('4. Choose one option:');
    console.log('   Option A: Click "Enter Code"');
    if (pass.checkout_verification_code) {
      console.log(`             → Enter code: ${pass.checkout_verification_code}`);
    }
    console.log('   Option B: Click "Scan Checkout QR"');
    console.log('             → Scan the checkout QR shown on pass details');
    console.log('5. Click "Verify & Record Exit"');
    console.log('6. ✅ Checkout complete!\n');
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('⚠️  IMPORTANT NOTES:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('• DO NOT use the original verification code for checkout!');
    if (pass.verification_code && pass.checkout_verification_code) {
      console.log(`  ❌ Original code (check-in): ${pass.verification_code} - DON'T use this`);
      console.log(`  ✅ Checkout code: ${pass.checkout_verification_code} - USE this`);
    }
    console.log('• Checkout credentials are valid for 1 hour only');
    console.log('• If expired, cancel the pass again to get new credentials\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSatyamCheckout();
