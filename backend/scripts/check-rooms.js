const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRooms() {
  try {
    const rooms = await prisma.hostelRoom.findMany({
      include: {
        hostel: true,
        bookings: {
          where: {
            booking_status: {
              in: ['confirmed', 'pending']
            }
          }
        }
      }
    });
    
    console.log(`\n📊 Total hostel rooms: ${rooms.length}\n`);
    
    rooms.forEach((room, i) => {
      const activeBookings = room.bookings.filter(b => 
        b.booking_status === 'confirmed' || b.booking_status === 'pending'
      );
      
      console.log(`${i + 1}. Room ${room.room_number} - ${room.hostel.name}`);
      console.log(`   Available: ${room.is_available ? 'Yes' : 'No'}`);
      console.log(`   Price: ₹${room.price_per_night}/night`);
      console.log(`   Max Occupancy: ${room.max_occupancy}`);
      console.log(`   Active Bookings: ${activeBookings.length}`);
      
      if (activeBookings.length > 0) {
        activeBookings.forEach(booking => {
          console.log(`      • ${booking.check_in_date.toISOString().split('T')[0]} to ${booking.check_out_date.toISOString().split('T')[0]} (${booking.booking_status})`);
        });
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkRooms();
