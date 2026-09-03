const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Replicate transformation logic
function transformPassToFrontend(pass) {
  if (!pass) return null;
  
  const formatDateForFrontend = (date) => {
    if (!date) return null;
    if (date instanceof Date) return date.toISOString();
    return date;
  };
  
  return {
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
}

// Simulate the getAllPasses service call
async function testGetAllPassesAPI() {
  try {
    console.log('🔍 Testing getAllPasses API response...\n');
    
    // Fetch passes the same way the service does
    const passes = await prisma.gate_pass.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        user_login_gate_pass_created_by_idTouser_login: {
          select: {
            id: true,
            uid: true,
            employeeDetails: { select: { displayName: true } }
          }
        },
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
    
    const transformedPasses = passes.map(pass => transformPassToFrontend(pass));
    
    console.log('📊 getAllPasses response:');
    console.log('   Total passes:', transformedPasses.length);
    console.log('');
    
    // Show all passes
    transformedPasses.forEach((pass, index) => {
      console.log(`\n=== Pass ${index + 1} ===`);
      console.log('   passId:', pass.passId);
      console.log('   passStatus:', pass.passStatus);
      console.log('   visitorName:', pass.visitorName);
      console.log('   stayRequired:', pass.stayRequired);
      console.log('   hasHostelBooking:', !!pass.hostelBooking);
      
      if (pass.hostelBooking) {
        console.log('   ✅ Hostel Booking:');
        console.log('      totalPrice:', pass.hostelBooking.totalPrice);
        console.log('      bookingStatus:', pass.hostelBooking.bookingStatus);
        console.log('      paymentStatus:', pass.hostelBooking.paymentStatus);
        console.log('      roomNumber:', pass.hostelBooking.roomNumber);
        console.log('      hostelName:', pass.hostelBooking.hostelName);
      }
    });
    
    // Find pass with hostel booking
    const passWithBooking = transformedPasses.find(p => p.hostelBooking);
    if (passWithBooking) {
      console.log('\n\n📋 Full pass object with hostel booking:');
      console.log(JSON.stringify(passWithBooking, null, 2));
    }
    
    console.log('\n✅ Test complete!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testGetAllPassesAPI();
