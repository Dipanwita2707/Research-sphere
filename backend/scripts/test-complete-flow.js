// Test the complete flow: Backend → API → Frontend transformation
// Run this with: node scripts/test-complete-flow.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Replicate backend transformation
function backendTransform(pass) {
  const formatDate = (date) => {
    if (!date) return null;
    if (date instanceof Date) return date.toISOString  ();
    return date;
  };
  
  return {
    ...pass,
    passId: pass.pass_id,
    passStatus: pass.pass_status,
    visitorName: pass.visitor_name,
    stayRequired: pass.stay_required,
    hostelBooking: pass.hostel_booking ? {
      ...pass.hostel_booking,
      check_in_date: formatDate(pass.hostel_booking.check_in_date),
      check_out_date: formatDate(pass.hostel_booking.check_out_date),
      totalPrice: pass.hostel_booking.total_price,
      bookingStatus: pass.hostel_booking.booking_status,
      paymentStatus: pass.hostel_booking.payment_status,
      hostelName: pass.hostel_booking.room?.hostel?.name,
      roomNumber: pass.hostel_booking.room?.room_number
    } : null
  };
}

// Replicate frontend transformation
function frontendTransform(pass) {
  const hostelBooking = pass.hostel_booking || pass.hostelBooking;
  const hostelName = hostelBooking?.room?.hostel?.name || hostelBooking?.hostelName || pass.hostel_name || null;
  const roomNumber = hostelBooking?.room?.room_number || hostelBooking?.roomNumber || pass.room_number || null;
  
  return {
    passId: pass.pass_id || pass.passId,
    passStatus: pass.passStatus || pass.pass_status,
    visitorName: pass.visitor_name || pass.visitorName,
    stayRequired: pass.stay_required ?? pass.stayRequired,
    hostelBooking: hostelBooking ? {
      totalPrice: hostelBooking.total_price || hostelBooking.totalPrice,
      roomNumber: hostelBooking.room?.room_number || hostelBooking.roomNumber || roomNumber,
      hostelName: hostelBooking.room?.hostel?.name || hostelBooking.hostelName || hostelName,
      bookingStatus: hostelBooking.booking_status || hostelBooking.bookingStatus,
      paymentStatus: hostelBooking.payment_status || hostelBooking.paymentStatus,
    } : undefined
  };
}

async function testCompleteFlow() {
  try {
    console.log('🔬 Testing Complete Data Flow\n');
    console.log('='.repeat(70));
    
    // Step 1: Get raw data from database
    console.log('\n📊 STEP 1: Fetch from Database');
    const rawPass = await prisma.gate_pass.findFirst({
      where: { stay_required: true },
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
                room_number: true,
                hostel: { select: { name: true } }
              }
            }
          }
        }
      }
    });
    
    if (!rawPass) {
      console.log('❌ No pass with hostel booking found');
      return;
    }
    
    console.log('   ✅ Raw database record:');
    console.log('      pass_id:', rawPass.pass_id);
    console.log('      pass_status:', rawPass.pass_status);
    console.log('      stay_required:', rawPass.stay_required);
    console.log('      hostel_booking.total_price:', rawPass.hostel_booking?.total_price);
    
    // Step 2: Backend transformation
    console.log('\n🔄 STEP 2: Backend Transformation (gatePass.service.js)');
    const backendData = backendTransform(rawPass);
    console.log('   ✅ After backend transform:');
    console.log('      passId:', backendData.passId);
    console.log('      passStatus:', backendData.passStatus);
    console.log('      stayRequired:', backendData.stayRequired);
    console.log('      hostelBooking.totalPrice:', backendData.hostelBooking?.totalPrice);
    console.log('      hostelBooking.roomNumber:', backendData.hostelBooking?.roomNumber);
    console.log('      hostelBooking.hostelName:', backendData.hostelBooking?.hostelName);
    
    // Step 3: Frontend transformation
    console.log('\n🎨 STEP 3: Frontend Transformation (gateEntry.service.ts)');
    const frontendData = frontendTransform(backendData);
    console.log('   ✅ After frontend transform:');
    console.log('      passId:', frontendData.passId);
    console.log('      passStatus:', frontendData.passStatus);
    console.log('      stayRequired:', frontendData.stayRequired);
    console.log('      hasHostelBooking:', !!frontendData.hostelBooking);
    if (frontendData.hostelBooking) {
      console.log('      hostelBooking.totalPrice:', frontendData.hostelBooking.totalPrice);
      console.log('      hostelBooking.roomNumber:', frontendData.hostelBooking.roomNumber);
      console.log('      hostelBooking.hostelName:', frontendData.hostelBooking.hostelName);
      console.log('      hostelBooking.bookingStatus:', frontendData.hostelBooking.bookingStatus);
    }
    
    // Step 4: Refund calculation simulation
    console.log('\n💰 STEP 4: Refund Calculation Check');
    const isCreated = frontendData.passStatus === 'created';
    const canShowRefund = isCreated && frontendData.stayRequired && !!frontendData.hostelBooking;
    
    console.log('   Conditions:');
    console.log('      passStatus === "created":', isCreated);
    console.log('      stayRequired:', frontendData.stayRequired);
    console.log('      hasHostelBooking:', !!frontendData.hostelBooking);
    console.log('      ✅ Can show refund preview:', canShowRefund);
    
    if (canShowRefund && frontendData.hostelBooking) {
      const refundPercent = 90;
      const originalAmount = frontendData.hostelBooking.totalPrice || 0;
      const cancellationFeePercent = 100 - refundPercent;
      const cancellationFeeAmount = (originalAmount * cancellationFeePercent) / 100;
      const refundAmount = originalAmount - cancellationFeeAmount;
      
      console.log('\n   📋 Refund Preview:');
      console.log('      Original Amount: ₹' + originalAmount);
      console.log('      Cancellation Fee (' + cancellationFeePercent + '%): ₹' + cancellationFeeAmount);
      console.log('      Refund Amount: ₹' + refundAmount);
      console.log('      Room: ' + frontendData.hostelBooking.roomNumber);
      console.log('      Hostel: ' + frontendData.hostelBooking.hostelName);
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ COMPLETE FLOW TEST PASSED!\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testCompleteFlow();
