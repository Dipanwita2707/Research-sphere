const { PrismaClient } = require('@prisma/client');
const QRCode = require('qrcode');
const prisma = new PrismaClient();

async function regenerateCheckoutForSatyam() {
  try {
    console.log('\n🔄 Regenerating checkout for Satyam\'s cancelled pass...\n');

    // Find Satyam's cancelled pass
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

    console.log('✅ Found pass:', pass.pass_id);

    // Generate new checkout unique ID
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    
    // Get count for sequence
    const checkoutCountToday = await prisma.gate_pass.count({
      where: {
        checkout_unique_id: {
          not: null
        }
      }
    });

    const sequence = String(checkoutCountToday + 1).padStart(3, '0');
    const checkoutUniqueId = `CHECKOUT-${dateStr}-${sequence}`;

    console.log('🆔 New Checkout Unique ID:', checkoutUniqueId);

    // Generate QR data
    const timestamp = Date.now();
    const expiresAt = new Date(timestamp + 60 * 60 * 1000); // 1 hour

    const checkoutData = {
      type: 'CHECKOUT',
      checkout_id: checkoutUniqueId,
      original_pass_id: pass.pass_id,
      timestamp: timestamp,
      expiresAt: expiresAt.toISOString()
    };

    // Generate QR code
    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(checkoutData), {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      width: 300
    });

    // Update pass in database
    const updatedPass = await prisma.gate_pass.update({
      where: { id: pass.id },
      data: {
        checkout_unique_id: checkoutUniqueId,
        checkout_qr_code: qrCodeDataURL,
        checkout_qr_expires_at: expiresAt
      }
    });

    console.log('\n✅ Successfully updated pass!');
    console.log('\n' + '='.repeat(80));
    console.log('📋 CHECKOUT DETAILS');
    console.log('='.repeat(80));
    console.log('Original Pass ID:', pass.pass_id);
    console.log('New Checkout ID:', checkoutUniqueId);
    console.log('Verification Code:', pass.verification_code);
    console.log('Expires At:', expiresAt.toLocaleString());
    console.log('\n📱 FOR GUARD TO USE:');
    console.log('1. Scan checkout QR code OR');
    console.log('2. Enter checkout ID:', checkoutUniqueId, 'OR');
    console.log('3. Enter verification code:', pass.verification_code);
    console.log('\n' + '='.repeat(80) + '\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

regenerateCheckoutForSatyam();
