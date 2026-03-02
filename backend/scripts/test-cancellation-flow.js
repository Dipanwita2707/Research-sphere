// Test cancellation flow for before/after check-in
// Run: node scripts/test-cancellation-flow.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCancellationFlow() {
  try {
    console.log('🧪 Testing Cancellation Flow\n');
    console.log('='.repeat(70));
    
    // Test 1: Find a pass in 'created' status (before check-in)
    console.log('\n📋 TEST 1: Before Check-In Cancellation');
    console.log('-'.repeat(70));
    
    const createdPass = await prisma.gate_pass.findFirst({
      where: { 
        pass_status: 'created',
        stay_required: true
      },
      include: {
        hostel_booking: {
          include: {
            room: {
              include: {
                hostel: true
              }
            }
          }
        }
      }
    });
    
    if (createdPass) {
      console.log('✅ Found pass in "created" status:');
      console.log('   Pass ID:', createdPass.pass_id);
      console.log('   Pass Status:', createdPass.pass_status);
      console.log('   Stay Required:', createdPass.stay_required);
      console.log('   Has Hostel Booking:', !!createdPass.hostel_booking);
      
      if (createdPass.hostel_booking) {
        console.log('   Hostel Booking Details:');
        console.log('     - Room:', createdPass.hostel_booking.room.room_number);
        console.log('     - Hostel:', createdPass.hostel_booking.room.hostel.name);
        console.log('     - Total Price: ₹', createdPass.hostel_booking.total_price);
        console.log('     - Booking Status:', createdPass.hostel_booking.booking_status);
      }
      
      console.log('\n   ✨ Expected Behavior on Cancellation:');
      console.log('   ❌ Should NOT generate checkout QR');
      console.log('   ✅ Should update pass status to "cancelled"');
      console.log('   ✅ Should create RefundTransaction (if hostel booking exists)');
      console.log('   ✅ Should update hostel booking status to "cancelled"');
      console.log('   📧 Should send WhatsApp + Email notification');
      console.log('\n   📱 Backend Response Should Include:');
      console.log('   {');
      console.log('     cancellation_type: "before_check_in",');
      console.log('     hostel_refund: {');
      console.log('       original_amount: 1000,');
      console.log('       refund_amount: 900,');
      console.log('       cancellation_fee_amount: 100,');
      console.log('       ...');
      console.log('     },');
      console.log('     checkout_qr: null  // ← No checkout QR!');
      console.log('   }');
      console.log('\n   💬 Expected Message:');
      console.log('   "Pass cancelled successfully. Visitor has been notified via WhatsApp and email."');
      
    } else {
      console.log('⚠️  No pass found in "created" status with hostel booking');
    }
    
    // Test 2: Find a pass in 'checked_in' status (after check-in)
    console.log('\n\n📋 TEST 2: After Check-In Cancellation');
    console.log('-'.repeat(70));
    
    const checkedInPass = await prisma.gate_pass.findFirst({
      where: { 
        pass_status: 'checked_in'
      }
    });
    
    if (checkedInPass) {
      console.log('✅ Found pass in "checked_in" status:');
      console.log('   Pass ID:', checkedInPass.pass_id);
      console.log('   Pass Status:', checkedInPass.pass_status);
      console.log('   Checked In At:', checkedInPass.actual_entry_time);
      
      console.log('\n   ✨ Expected Behavior on Cancellation:');
      console.log('   ✅ Should generate NEW checkout QR (1-hour validity)');
      console.log('   ✅ Should generate NEW checkout verification code');
      console.log('   ✅ Should update pass status to "cancelled"');
      console.log('   📧 Should send WhatsApp + Email with checkout QR');
      console.log('\n   📱 Backend Response Should Include:');
      console.log('   {');
      console.log('     cancellation_type: "after_check_in",');
      console.log('     checkout_qr: {');
      console.log('       checkout_unique_id: "CHECKOUT-20260227-001",');
      console.log('       checkout_verification_code: "123456",');
      console.log('       qr_code: "data:image/png...",');
      console.log('       expires_at: "2026-02-27T15:30:00Z",');
      console.log('       expires_in_minutes: 60');
      console.log('     }');
      console.log('   }');
      console.log('\n   💬 Expected Message:');
      console.log('   "Pass cancelled successfully. Emergency checkout QR code sent to visitor (valid for 1 hour)."');
      
    } else {
      console.log('⚠️  No pass found in "checked_in" status');
    }
    
    // Test 3: Verify refund config
    console.log('\n\n📋 TEST 3: Refund Configuration');
    console.log('-'.repeat(70));
    
    const refundConfig = await prisma.systemConfig.findUnique({
      where: { config_key: 'hostel_cancellation_refund_percent' }
    });
    
    if (refundConfig) {
      console.log('   ✅ Refund configuration found:');
      console.log('   Config Key:', refundConfig.config_key);
      console.log('   Config Value:', refundConfig.config_value + '%');
      console.log('   Description:', refundConfig.description || 'N/A');
      
      const refundPercent = parseFloat(refundConfig.config_value);
      const cancellationFeePercent = 100 - refundPercent;
      
      console.log('\n   💰 Example Calculation (₹1000 booking):');
      console.log('   Original Amount: ₹1000');
      console.log('   Cancellation Fee (' + cancellationFeePercent + '%): ₹' + (1000 * cancellationFeePercent / 100));
      console.log('   Refund Amount (' + refundPercent + '%): ₹' + (1000 * refundPercent / 100));
    } else {
      console.log('   ⚠️  Refund configuration not found');
      console.log('   Will use default: 90% refund');
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ TEST COMPLETE\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testCancellationFlow();
