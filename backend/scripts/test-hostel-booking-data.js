const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testHostelBookingData() {
  try {
    console.log('🔍 Testing hostel booking data in pass fetch...\n');
    
    // Fetch all passes with hostel bookings
    const passes = await prisma.gate_pass.findMany({
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
    
    console.log(`📊 Found ${passes.length} passes with stay_required=true\n`);
    
    if (passes.length === 0) {
      console.log('✅ No passes with hostel bookings to test.');
      console.log('💡 Create a pass with hostel booking and run this test again.\n');
      return;
    }
    
    passes.forEach((pass, index) => {
      console.log(`${index + 1}. Pass ID: ${pass.pass_id}`);
      console.log(`   Visitor: ${pass.visitor_name}`);
      console.log(`   Status: ${pass.pass_status}`);
      console.log(`   Stay Required: ${pass.stay_required}`);
      
      if (pass.hostel_booking) {
        console.log(`   ✅ Hostel Booking Found:`);
        console.log(`      • Booking ID: ${pass.hostel_booking.id}`);
        console.log(`      • Room: ${pass.hostel_booking.room?.room_number} (${pass.hostel_booking.room?.hostel?.name})`);
        console.log(`      • Check-in: ${pass.hostel_booking.check_in_date.toISOString().split('T')[0]}`);
        console.log(`      • Check-out: ${pass.hostel_booking.check_out_date.toISOString().split('T')[0]}`);
        console.log(`      • Total Price: ₹${pass.hostel_booking.total_price}`);
        console.log(`      • Booking Status: ${pass.hostel_booking.booking_status}`);
        console.log(`      • Payment Status: ${pass.hostel_booking.payment_status}`);
      } else {
        console.log(`   ⚠️  No hostel booking linked (stay_required=true but no booking)`);
      }
      console.log('');
    });
    
    console.log('✅ Test complete!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testHostelBookingData();
