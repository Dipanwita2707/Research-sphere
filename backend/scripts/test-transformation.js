const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Replicate the transformation logic
function transformPassToFrontend(pass) {
  if (!pass) return null;
  
  const formatDateForFrontend = (date) => {
    if (!date) return null;
    if (date instanceof Date) {
      return date.toISOString();
    }
    return date;
  };
  
  const transformed = {
    ...pass,
    passId: pass.pass_id,
    passStatus: pass.pass_status,
    visitorName: pass.visitor_name,
    mobileNumber: pass.mobile_number,
    stayRequired: pass.stay_required,
    hostelBooking: pass.hostel_booking ? {
      ...pass.hostel_booking,
      check_in_date: formatDateForFrontend(pass.hostel_booking.check_in_date),
      check_out_date: formatDateForFrontend(pass.hostel_booking.check_out_date),
      totalPrice: pass.hostel_booking.total_price,
      bookingStatus: pass.hostel_booking.booking_status,
      paymentStatus: pass.hostel_booking.payment_status,
      hostelName: pass.hostel_booking.room?.hostel?.name,
      roomNumber: pass.hostel_booking.room?.room_number
    } : null
  };
  
  return transformed;
}

async function testTransformation() {
  try {
    console.log('🔍 Testing pass transformation...\n');
    
    // Fetch pass from database
    const pass = await prisma.gate_pass.findFirst({
      where: {
        stay_required: true
      },
      include: {
        hostel_booking: {
          select: {
            id: true,
            check_in_date: true,
            check_out_date: true,
            total_price: true,
            booking_status: true,
            payment_status: true,
            room: {
              select: {
                id: true,
                room_number: true,
                hostel: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    });
    
    if (!pass) {
      console.log('❌ No pass with hostel booking found');
      return;
    }
    
    console.log('📊 Raw database pass:');
    console.log('   pass_id:', pass.pass_id);
    console.log('   pass_status:', pass.pass_status);
    console.log('   stay_required:', pass.stay_required);
    console.log('   hostel_booking:', pass.hostel_booking ? 'EXISTS' : 'NULL');
    if (pass.hostel_booking) {
      console.log('   total_price:', pass.hostel_booking.total_price);
      console.log('   booking_status:', pass.hostel_booking.booking_status);
      console.log('   payment_status:', pass.hostel_booking.payment_status);
    }
    console.log('');
    
    // Transform using local function
    const transformed = transformPassToFrontend(pass);
    
    console.log('✨ Transformed pass (frontend format):');
    console.log('   passId:', transformed.passId);
    console.log('   passStatus:', transformed.passStatus);
    console.log('   stayRequired:', transformed.stayRequired);
    console.log('   hostelBooking:', transformed.hostelBooking ? 'EXISTS' : 'NULL');
    if (transformed.hostelBooking) {
      console.log('   hostelBooking.totalPrice:', transformed.hostelBooking.totalPrice);
      console.log('   hostelBooking.bookingStatus:', transformed.hostelBooking.bookingStatus);
      console.log('   hostelBooking.paymentStatus:', transformed.hostelBooking.paymentStatus);
      console.log('   hostelBooking.roomNumber:', transformed.hostelBooking.roomNumber);
      console.log('   hostelBooking.hostelName:', transformed.hostelBooking.hostelName);
    }
    console.log('');
    
    // Test refund preview condition
    const canShowRefund = transformed.passStatus === 'created' && transformed.stayRequired && transformed.hostelBooking;
    console.log('🎯 Refund preview condition check:');
    console.log('   passStatus === "created":', transformed.passStatus === 'created');
    console.log('   stayRequired:', transformed.stayRequired);
    console.log('   hostelBooking exists:', !!transformed.hostelBooking);
    console.log('   ✅ Should show refund preview:', canShowRefund);
    
    if (canShowRefund) {
      const refundPercent = 90;
      const originalAmount = transformed.hostelBooking.totalPrice || 0;
      const cancellationFeePercent = 100 - refundPercent;
      const cancellationFeeAmount = (originalAmount * cancellationFeePercent) / 100;
      const refundAmount = originalAmount - cancellationFeeAmount;
      
      console.log('');
      console.log('💰 Refund calculation:');
      console.log('   Original Amount: ₹' + originalAmount);
      console.log('   Cancellation Fee (' + cancellationFeePercent + '%): ₹' + cancellationFeeAmount);
      console.log('   Refund Amount: ₹' + refundAmount);
    }
    
    console.log('\n✅ Test complete!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testTransformation();
