const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPassCancellation() {
  console.log('\n🧪 Testing Pass Cancellation Logic...\n');

  try {
    // Test 1: Find a created pass with hostel booking
    console.log('Test 1: Finding passes with hostel bookings...');
    const passes = await prisma.gate_pass.findMany({
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
      },
      take: 1
    });

    if (passes.length === 0) {
      console.log('⚠️  No passes with hostel booking found for testing');
      return;
    }

    const pass = passes[0];
    console.log(`✅ Found pass: ${pass.pass_id}`);
    console.log(`   Status: ${pass.pass_status}`);
    console.log(`   Has hostel booking: ${!!pass.hostel_booking}`);

    if (pass.hostel_booking) {
      const booking = pass.hostel_booking;
      console.log(`\n   Hostel Booking Details:`);
      console.log(`   - Room: ${booking.room?.room_number || booking.room_number}`);
      console.log(`   - Hostel: ${booking.room?.hostel?.name || booking.hostel_name}`);
      console.log(`   - Check-in: ${booking.check_in_date}`);
      console.log(`   - Check-out: ${booking.check_out_date}`);
      console.log(`   - Total Price: ₹${booking.total_price}`);
      console.log(`   - Booking Status: ${booking.booking_status}`);

      // Test 2: Calculate refund based on time
      const now = new Date();
      const checkInDate = new Date(booking.check_in_date);
      const timeUntilCheckIn = checkInDate.getTime() - now.getTime();
      const hoursUntilCheckIn = timeUntilCheckIn / (1000 * 60 * 60);
      const daysUntilCheckIn = hoursUntilCheckIn / 24;

      let refundPercent = 0;
      let appliedSlab = '';

      if (daysUntilCheckIn >= 3) {
        refundPercent = 90;
        appliedSlab = '3+ days before check-in';
      } else if (daysUntilCheckIn >= 1) {
        refundPercent = 70;
        appliedSlab = '1-3 days before check-in';
      } else if (hoursUntilCheckIn >= 2) {
        refundPercent = 40;
        appliedSlab = '2-24 hours before check-in';
      } else {
        refundPercent = 0;
        appliedSlab = 'Less than 2 hours before check-in';
      }

      const originalAmount = parseFloat(booking.total_price) || 0;
      const cancellationFeePercent = 100 - refundPercent;
      const cancellationFeeAmount = (originalAmount * cancellationFeePercent) / 100;
      const refundAmount = originalAmount - cancellationFeeAmount;

      console.log(`\n📊 Refund Calculation:`);
      console.log(`   Time until check-in: ${daysUntilCheckIn.toFixed(2)} days (${hoursUntilCheckIn.toFixed(2)} hours)`);
      console.log(`   Applied slab: ${appliedSlab}`);
      console.log(`   Refund percentage: ${refundPercent}%`);
      console.log(`   Original amount: ₹${originalAmount.toFixed(2)}`);
      console.log(`   Cancellation fee: ₹${cancellationFeeAmount.toFixed(2)} (${cancellationFeePercent}%)`);
      console.log(`   Refund amount: ₹${refundAmount.toFixed(2)}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Pass cancellation logic test completed successfully!');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testPassCancellation();
