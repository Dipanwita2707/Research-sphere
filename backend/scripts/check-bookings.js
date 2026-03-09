const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBookings() {
  try {
    console.log('🔍 Checking hostel bookings in database...\n');
    
    const allBookings = await prisma.hostelBooking.findMany({
      include: {
        room: {
          include: {
            hostel: true
          }
        },
        gate_pass: {
          select: {
            pass_id: true,
            visitor_name: true,
            pass_status: true
          }
        }
      }
    });
    
    console.log(`📊 Total hostel bookings: ${allBookings.length}\n`);
    
    if (allBookings.length === 0) {
      console.log('✅ No hostel bookings found. Database is clean!\n');
      return;
    }
    
    console.log('📋 Hostel bookings found:');
    console.log('═══════════════════════════════════════════════════════════');
    
    allBookings.forEach((booking, index) => {
      console.log(`\n${index + 1}. Booking ID: ${booking.id}`);
      console.log(`   Room: ${booking.room.room_number} (${booking.room.hostel.name})`);
      console.log(`   Check-in: ${booking.check_in_date.toISOString().split('T')[0]}`);
      console.log(`   Check-out: ${booking.check_out_date.toISOString().split('T')[0]}`);
      console.log(`   Booking Status: ${booking.booking_status}`);
      console.log(`   Payment Status: ${booking.payment_status}`);
      
      if (booking.gate_pass) {
        console.log(`   Linked Pass: ${booking.gate_pass.pass_id} (${booking.gate_pass.visitor_name})`);
        console.log(`   Pass Status: ${booking.gate_pass.pass_status}`);
      } else {
        console.log(`   ⚠️  ORPHANED BOOKING (no linked pass)!`);
      }
      console.log('-----------------------------------------------------------');
    });
    
    // Check specifically for bookings with 'confirmed' or 'pending' status
    const activeBookings = allBookings.filter(b => 
      b.booking_status === 'confirmed' || b.booking_status === 'pending'
    );
    
    console.log(`\n⚡ Active bookings (confirmed/pending): ${activeBookings.length}`);
    
    if (activeBookings.length > 0) {
      console.log('\n⚠️  These bookings are blocking room availability!');
      activeBookings.forEach((booking, index) => {
        console.log(`   ${index + 1}. Room ${booking.room.room_number} - ${booking.booking_status}`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkBookings();
